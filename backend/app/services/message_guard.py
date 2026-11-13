"""
使用者訊息安全閘道：即時串流（WebSocket）與一般 API 送訊息共用，兩條路一定經過同一套檢查。

依序三層：
  1. 個資遮罩（PII）：命中就改用遮罩後的文字，後面的檢查、模型、資料庫都不接觸原值
  2. 違禁詞（DLP）：命中直接攔阻，不送模型
  3. 提示詞注入（Prompt Injection）：高風險攔阻；其他淨化後繼續

每一層命中都寫稽核紀錄，並透過 emit 把事件交給呼叫端（WebSocket 直接送給前端；一般 API 收集起來）。
回傳：要送進模型的文字；None ＝ 已攔阻（最後一個事件的 type 是 dlp_block 或 injection_block）。

另外放兩個共用小工具：
  - clamp_generation_params：前端送來的生成參數（溫度、長度、語言）限制在合理範圍
"""
import logging
from typing import Any, Awaitable, Callable, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.services.audit_service import AuditAction, AuditResource, write_audit_log
from app.services.dlp_service import check_dlp
from app.services.pii_masking_service import mask_pii
from app.services.prompt_guard_service import check_prompt_injection

logger = logging.getLogger(__name__)

Emit = Callable[[dict], Awaitable[None]]

SUPPORTED_LANGUAGES = ("zh-TW", "en-US", "ja-JP")
MAX_TOKENS_LIMIT = 4096


def clamp_generation_params(data: dict) -> dict:
    """溫度 0～2、回覆長度 1～4096、語言只接受支援的三種；格式不對就用預設值"""
    def num(value: Any, default: float, low: float, high: float) -> float:
        try:
            v = float(value)
        except (TypeError, ValueError):
            return default
        return min(max(v, low), high)

    language = data.get("language")
    return {
        "use_rag": bool(data.get("use_rag", True)),
        "web_search": bool(data.get("web_search", False)),
        # 深度研究：這一題多查幾輪、寫成有出處的報告（services/chat_service.py）
        "research": bool(data.get("research", False)),
        "temperature": num(data.get("temperature"), 0.7, 0.0, 2.0),
        "max_tokens": int(num(data.get("max_tokens"), 2048, 1, MAX_TOKENS_LIMIT)),
        "language": language if language in SUPPORTED_LANGUAGES else "zh-TW",
    }


async def screen_user_message(
    db: AsyncSession,
    text: str,
    *,
    conversation_id: str,
    tenant_id: Optional[str],
    user_id: str,
    user_email: Optional[str],
    ip_address: Optional[str],
    emit: Emit,
) -> Optional[str]:
    async def audit(action: str, description: str, details: dict) -> None:
        try:
            await write_audit_log(
                db=db,
                action=action,
                resource_type=AuditResource.CONVERSATION,
                resource_id=conversation_id,
                user_id=user_id,
                user_email=user_email,
                ip_address=ip_address,
                tenant_id=tenant_id,
                description=description,
                details=details,
            )
        except Exception as e:  # 稽核失敗不能擋住主流程
            logger.warning("安全閘道寫稽核失敗: %s", e)

    processed = text

    # 1. 個資遮罩
    if settings.enable_pii_masking:
        mask_result = mask_pii(processed)
        if mask_result["has_pii"]:
            await emit({
                "type": "pii_warning",
                "message": f"已自動遮罩 {len(mask_result['mask_map'])} 項敏感資訊。",
                # 遮罩後的整句（不含原值），前端用來立刻替換畫面上的使用者訊息
                "masked_text": mask_result["masked_text"],
                "mask_map": [
                    {k: m[k] for k in ("original_preview", "masked", "type", "label")}
                    for m in mask_result["mask_map"]
                ],
            })
            await audit(
                AuditAction.PII_DETECTED,
                f"訊息中偵測到 {len(mask_result['mask_map'])} 個個資片段並已遮罩",
                {"pii_types": [m.get("type") for m in mask_result["mask_map"]]},
            )
            processed = mask_result["masked_text"]

    # 2. 違禁詞：攔阻
    dlp_result = check_dlp(processed)
    if dlp_result["blocked"]:
        count = len(dlp_result.get("matched_terms", []))
        await emit({"type": "dlp_block", "message": dlp_result["reason"], "matched_terms_count": count})
        await audit(AuditAction.DLP_HIT, f"DLP 偵測到 {count} 個違禁詞並已攔阻", {"matched_terms_count": count})
        return None

    # 3. 提示詞注入：高風險攔阻，其他淨化後繼續
    if settings.enable_prompt_injection_guard:
        guard = check_prompt_injection(processed)
        if guard["is_suspicious"]:
            await emit({
                "type": "injection_warning",
                "message": "偵測到可疑的 Prompt Injection 模式，已自動淨化。",
                "risk_level": guard["risk_level"],
                "matched_patterns": guard["matched_patterns"],
            })
            await audit(
                AuditAction.PROMPT_INJECTION_BLOCKED,
                f"偵測到 Prompt Injection 攻擊模式：{guard.get('risk_level')}",
                {"risk_level": guard.get("risk_level"), "matched_patterns": guard.get("matched_patterns", [])},
            )
            # 只靠淨化時，模型仍可能照做並洩漏系統提示，所以高風險直接不送
            if guard["risk_level"] == "high":
                await emit({
                    "type": "injection_block",
                    "message": "偵測到高風險提示詞注入攻擊，請求已攔阻，未送入 AI 模型。",
                    "risk_level": guard["risk_level"],
                })
                return None
            processed = guard["sanitized_text"]

    return processed
