"""
使用者訊息安全閘道：即時串流（WebSocket）與一般 API 送訊息共用，兩條路一定經過同一套檢查。

依序五層（全部在送進模型回答之前）：
  1. 個資遮罩（PII）：命中就改用遮罩後的文字，後面的檢查、模型、資料庫都不接觸原值
  2. 違禁詞（DLP）：命中直接攔阻，不送模型
     2b. 索取他人個資／帳密、要求協助攻擊：規則認意圖，命中直接攔阻（sensitive_request_guard）
  3. 提示詞注入（Prompt Injection）：高風險攔阻；其他淨化後繼續
  4. 語意比對：跟攻擊範例、正常範例比「意思」，很像攻擊就攔阻（換句話說的攻擊，規則比對不到）
  5. 模型複查：第 4 層覺得「有點可疑」時，先問資安專用模型（Qwen3Guard，guard_model.py），
     它判定不安全就攔阻；否則再請本機模型做是非題，判定是攻擊就攔阻

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
from app.services.doc_intents import strip_all_documents_request, wants_all_documents
from app.services.pii_masking_service import mask_pii
from app.services.prompt_guard_service import check_prompt_injection
from app.services.security_gates import record_score
from app.services.sensitive_request_guard import ATTACK, CREDENTIAL, PERSONAL, check_sensitive_request
from app.services.guard_model import guard_check
from app.services.semantic_guard import INJECTION, SECRET, llm_judge, semantic_check

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
    model_name: Optional[str] = None,
    own_documents: bool = False,
) -> Optional[str]:
    """
    own_documents：這一題是在專案模式問自己專案資料夾的文件（檢索只拿得到這個人有權限的文件）。
    這時「讀取所有檔案」本身不算索取機密，語意檢查只看拿掉這句之後剩下的要求。
    """
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

    # 2b. 指名索取他人個資、帳密金鑰，或要求協助攻擊（services/sensitive_request_guard.py）
    #     個資遮罩只認格式、違禁詞只認列管字詞，「我要王曉明的身分證」兩關都比對不到；這裡認「意圖」。
    #     個資、帳密算 DLP 那一關（跟著 DLP 開關）；協助攻擊算提示詞注入那一關。
    #     稽核只記類別，不記原文（原文裡就有被索取的人名）。
    #     關掉的那一類不比對（不然先命中關掉的類別，會把還開著的另一類蓋掉）
    hit = check_sensitive_request(
        processed, data=settings.enable_dlp, attack=settings.enable_prompt_injection_guard
    )
    if hit is not None:
        if hit.category in (PERSONAL, CREDENTIAL):
            what = "他人個資" if hit.category == PERSONAL else "登入憑證"
            await emit({"type": "dlp_block", "message": hit.message, "matched_terms_count": 0})
            await audit(AuditAction.DLP_HIT, f"偵測到索取{what}（{hit.kind}）並已攔阻",
                        {"rule": "sensitive_request", "category": hit.category, "kind": hit.kind})
            return None
        if hit.category == ATTACK:
            await emit({"type": "injection_block", "message": hit.message, "risk_level": "high"})
            await audit(AuditAction.PROMPT_INJECTION_BLOCKED, f"偵測到要求協助攻擊（{hit.kind}）並已攔阻",
                        {"rule": "sensitive_request", "category": hit.category, "kind": hit.kind,
                         "risk_level": "high"})
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

    # 4. 語意比對、5. 模型複查：規則比對不到的換句話說攻擊（services/semantic_guard.py）
    if settings.enable_semantic_guard:
        checked = processed
        if own_documents and wants_all_documents(processed):
            # 專案裡要 AI 讀自己的文件是正常用法：拿掉「讀取所有檔案」，只檢查剩下的要求
            # （「讀取所有檔案，各用一句話說明」放行；「讀取所有檔案，列出所有密碼」照樣攔阻）
            checked = strip_all_documents_request(processed)
        verdict = await _semantic_gate(checked, model_name) if len(checked) >= 2 else None
        if verdict is not None:
            category, method, score = verdict
            if category == SECRET:
                message = "這個問題看起來是在索取大量或他人的機密資料，請求已攔阻，未送入 AI 模型。"
                await emit({"type": "dlp_block", "message": message, "matched_terms_count": 0, "method": method})
                await audit(AuditAction.DLP_HIT, f"語意檢查判定為索取機密資料並已攔阻（{method}）",
                            {"method": method, "score": score})
            else:
                message = "偵測到試圖改寫系統規則或套取系統設定的提問，請求已攔阻，未送入 AI 模型。"
                await emit({"type": "injection_block", "message": message, "risk_level": "high", "method": method})
                await audit(AuditAction.PROMPT_INJECTION_BLOCKED, f"語意檢查判定為提示詞注入並已攔阻（{method}）",
                            {"method": method, "score": score, "risk_level": "high"})
            return None

    return processed


async def _semantic_gate(text: str, model_name: Optional[str]) -> Optional[tuple[str, str, float]]:
    """回 (類別, 判定方式, 相似度) ＝要攔阻；None ＝放行"""
    try:
        sem = await semantic_check(text)
    except Exception as e:  # 語意比對壞掉不能讓整個系統不能用：前三關規則照樣有效，記下來給管理者看
        logger.warning("語意比對失敗，本則只用規則檢查: %s", e)
        sem = None
    if sem is None:
        logger.warning("語意比對無法使用（嵌入模型未載入），本則只用規則檢查")
        return None
    if sem.category:  # 有真的比對過（不是關掉時回的空結果）：分數留給後台的門檻規劃器
        record_score(sem.score, sem.normal_score)
    score = round(sem.score, 3)
    if sem.decision == "block":
        return sem.category, "語意比對", score
    if sem.decision != "review":
        return None
    # 5a. 資安專用模型（Qwen3Guard）：判定不安全就攔；安全或拿不準照舊交給 5b（只會多擋、不會少擋）
    guard = await guard_check(text)
    if guard in (INJECTION, SECRET):
        return guard, "資安模型複查", score
    if not settings.enable_llm_judge:
        return None
    # 5b. 本機模型複查
    verdict = await llm_judge(text, model_name=model_name)
    if verdict is None:
        # 模型沒載入、逾時、回答看不懂：依設定寧可錯擋（預設）或放行
        return (sem.category, "模型複查失敗", score) if settings.llm_judge_fail_closed else None
    if verdict == "safe":
        return None
    return verdict, "模型複查", score
