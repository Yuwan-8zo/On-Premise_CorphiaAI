"""
資安閘道的管理：哪幾道開著、各擋了幾次、語意檢查的兩條門檻（後台「資安閘道」分頁）

  - 開關與門檻：預設值在 core/config.py（可用 .env 覆寫）；管理者在後台改過的值存在
    .runtime/security_gates.json，啟動時套回 settings，重開機後照樣有效
  - 命中次數：從稽核紀錄算（近 7 天，另算前 7 天給「比上週」）。語意比對與模型複查攔下的
    也寫成 dlp_hit／prompt_injection_blocked，靠 details.method 分出是哪一關
  - 語意分數：每則訊息的語意比對分數（只有兩個數字，不存提問內容）留最近 SCORE_KEEP 筆，
    後台的門檻規劃器拿來預覽「門檻改成這樣，會有多少則放行／複查／攔阻」
"""
import json
import logging
import os
from collections import deque
from dataclasses import dataclass
from datetime import timedelta
from pathlib import Path
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.tenancy import scope_audit
from app.core.time_utils import utc_now_naive
from app.models.audit_log import AuditLog
from app.models.user import User
from app.services.audit_service import AuditAction

logger = logging.getLogger(__name__)

RUNTIME_DIR = Path(__file__).resolve().parents[3] / ".runtime"
GATES_FILE = "security_gates.json"
SCORES_FILE = "semantic_scores.json"
SCORE_KEEP = 600              # 門檻規劃器看最近幾則
WINDOW_DAYS = 7               # 命中次數的期間（另算前一段同樣長度來比較）

# 判定方式（message_guard 寫進稽核 details.method 的字）
SEMANTIC_METHOD = "語意比對"
JUDGE_METHODS = ("模型複查", "模型複查失敗")


@dataclass(frozen=True)
class Gate:
    key: str
    setting: str                 # settings 上的開關欄位
    actions: tuple[str, ...]     # 這一關寫的稽核動作
    methods: Optional[tuple[str, ...]]  # 只算 details.method 是這些的；None＝只算沒有 method 的（規則那一關）
    counted: bool = True         # 這一關會不會寫稽核（不寫的就不顯示次數）


# 順序＝訊息經過的順序（送進模型前五關，加上文件片段與模型回答兩道）
GATES: tuple[Gate, ...] = (
    Gate("pii", "enable_pii_masking", (AuditAction.PII_DETECTED,), None),
    Gate("dlp", "enable_dlp", (AuditAction.DLP_HIT,), None),
    Gate("injection", "enable_prompt_injection_guard", (AuditAction.PROMPT_INJECTION_BLOCKED,), None),
    Gate("semantic", "enable_semantic_guard",
         (AuditAction.DLP_HIT, AuditAction.PROMPT_INJECTION_BLOCKED), (SEMANTIC_METHOD,)),
    Gate("llm_judge", "enable_llm_judge",
         (AuditAction.DLP_HIT, AuditAction.PROMPT_INJECTION_BLOCKED), JUDGE_METHODS),
    Gate("context", "enable_context_guard", (), None, counted=False),
    Gate("output", "enable_output_guard", (), None, counted=False),
)
GATE_BY_KEY = {g.key: g for g in GATES}
# 第五關（模型複查）只在第四關覺得可疑時才會跑：第四關關掉，第五關也不會被用到
DEPENDS_ON = {"llm_judge": "semantic"}

THRESHOLD_FIELDS = ("semantic_guard_block", "semantic_guard_review")
THRESHOLD_STEP = 0.01


def _runtime_path(name: str) -> Path:
    return RUNTIME_DIR / name


def _testing() -> bool:
    # 測試時不讀也不寫專案的 .runtime（不然測試會改到真正的設定）
    return bool(os.environ.get("PYTEST_CURRENT_TEST"))


# ── 開關與門檻 ──────────────────────────────────────────────────────────

def current_config() -> dict[str, Any]:
    return {
        "enabled": {g.key: bool(getattr(settings, g.setting)) for g in GATES},
        "semantic_block": round(float(settings.semantic_guard_block), 2),
        "semantic_review": round(float(settings.semantic_guard_review), 2),
        "semantic_margin": round(float(settings.semantic_guard_margin), 2),
    }


def _apply(data: dict[str, Any]) -> None:
    for key, on in (data.get("enabled") or {}).items():
        gate = GATE_BY_KEY.get(key)
        if gate is not None and isinstance(on, bool):
            setattr(settings, gate.setting, on)
    if "semantic_block" in data:
        settings.semantic_guard_block = float(data["semantic_block"])
    if "semantic_review" in data:
        settings.semantic_guard_review = float(data["semantic_review"])


def validate_update(enabled: Optional[dict[str, bool]], block: Optional[float], review: Optional[float]) -> dict[str, Any]:
    """檢查要改的值；不合理就丟 ValueError（訊息直接顯示給管理者）"""
    out: dict[str, Any] = {}
    if enabled:
        unknown = [k for k in enabled if k not in GATE_BY_KEY]
        if unknown:
            raise ValueError(f"沒有這個閘道：{', '.join(unknown)}")
        out["enabled"] = {k: bool(v) for k, v in enabled.items()}
    cur = current_config()
    new_block = cur["semantic_block"] if block is None else round(float(block), 2)
    new_review = cur["semantic_review"] if review is None else round(float(review), 2)
    if block is not None or review is not None:
        if not (0 < new_review < new_block <= 1):
            raise ValueError("門檻要滿足：0 ＜ 送模型複查 ＜ 直接攔阻 ≤ 1")
        out["semantic_block"] = new_block
        out["semantic_review"] = new_review
    return out


def save_update(update: dict[str, Any]) -> dict[str, Any]:
    """套用並存檔（只存管理者改過的值，沒改的照 .env／預設）"""
    _apply(update)
    if _testing():
        return current_config()
    path = _runtime_path(GATES_FILE)
    try:
        old = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        old = {}
    # 舊檔只用來知道「哪些項目改過」；名稱只取程式裡定義的閘道，數值一律取目前套用中的設定，
    # 不把檔案內容原樣寫回去
    old_enabled = old.get("enabled") if isinstance(old, dict) else None
    changed = {g.key for g in GATES if isinstance(old_enabled, dict) and g.key in old_enabled}
    changed |= {g.key for g in GATES if g.key in update.get("enabled", {})}
    cfg = current_config()
    saved: dict[str, Any] = {}
    if changed:
        saved["enabled"] = {g.key: cfg["enabled"][g.key] for g in GATES if g.key in changed}
    for k in ("semantic_block", "semantic_review"):
        if k in update or (isinstance(old, dict) and k in old):
            saved[k] = cfg[k]
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(saved, ensure_ascii=False, indent=2), encoding="utf-8")
    except OSError as e:
        logger.warning("資安閘道設定存檔失敗（這次開機內仍有效）: %s", e)
    return current_config()


def load_saved() -> None:
    """啟動時把後台改過的開關與門檻套回去"""
    if _testing():
        return
    path = _runtime_path(GATES_FILE)
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return
    except (OSError, ValueError) as e:
        logger.warning("資安閘道設定檔讀不到，用預設值: %s", e)
        return
    try:
        _apply(data)
        logger.info("已套用後台設定的資安閘道開關與門檻")
    except (TypeError, ValueError) as e:
        logger.warning("資安閘道設定檔內容不對，用預設值: %s", e)


# ── 命中次數 ────────────────────────────────────────────────────────────

def _gate_of(action: str, details: Any) -> Optional[str]:
    method = details.get("method") if isinstance(details, dict) else None
    for g in GATES:
        if not g.counted or action not in g.actions:
            continue
        if g.methods is None and method is None:
            return g.key
        if g.methods is not None and method in g.methods:
            return g.key
    return None


async def gate_hits(db: AsyncSession, viewer: User, tz_offset_min: int = 0) -> dict[str, dict[str, Any]]:
    """各閘道近 WINDOW_DAYS 天、前一段同長度的命中次數，和每天的次數（看得到的租戶）
    tz_offset_min：瀏覽器所在時區比 UTC 快幾分鐘（台灣 480），「哪一天」照使用者的日期分"""
    now = utc_now_naive()
    start = now - timedelta(days=WINDOW_DAYS * 2)
    split = now - timedelta(days=WINDOW_DAYS)
    actions = sorted({a for g in GATES for a in g.actions})
    q = scope_audit(
        select(AuditLog.action, AuditLog.details, AuditLog.created_at)
        .where(AuditLog.created_at >= start, AuditLog.action.in_(actions)),
        viewer,
    )
    shift = timedelta(minutes=max(-840, min(840, int(tz_offset_min))))
    today = (now + shift).date()
    # daily／daily_previous：每天幾次（舊到新），後台趨勢圖用虛線對照前一段
    out = {g.key: {"hits": 0, "previous": 0, "daily": [0] * WINDOW_DAYS, "daily_previous": [0] * WINDOW_DAYS}
           for g in GATES if g.counted}
    for action, details, created in (await db.execute(q)).all():
        key = _gate_of(action, details)
        if key is None:
            continue
        day = (today - (created + shift).date()).days   # 0＝今天
        if created >= split:
            out[key]["hits"] += 1
            if 0 <= day < WINDOW_DAYS:
                out[key]["daily"][WINDOW_DAYS - 1 - day] += 1
        else:
            out[key]["previous"] += 1
            if WINDOW_DAYS <= day < WINDOW_DAYS * 2:
                out[key]["daily_previous"][WINDOW_DAYS * 2 - 1 - day] += 1
    return out


# ── 語意分數（門檻規劃器用） ──────────────────────────────────────────────

_scores: deque = deque(maxlen=SCORE_KEEP)
_scores_loaded = False


def _load_scores() -> None:
    global _scores_loaded
    if _scores_loaded:
        return
    _scores_loaded = True
    if _testing():
        return
    try:
        rows = json.loads(_runtime_path(SCORES_FILE).read_text(encoding="utf-8"))
        for r in rows[-SCORE_KEEP:]:
            _scores.append((float(r[0]), float(r[1])))
    except (OSError, ValueError, TypeError, IndexError):
        pass


def record_score(score: float, normal: float) -> None:
    """記一則語意比對分數（最像的攻擊範例、最像的正常範例），不記提問內容"""
    _load_scores()
    _scores.append((round(float(score), 3), round(float(normal), 3)))
    if _testing():
        return
    try:
        path = _runtime_path(SCORES_FILE)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(list(_scores)), encoding="utf-8")
    except OSError as e:
        logger.debug("語意分數存檔失敗（不影響檢查）: %s", e)


def recent_scores() -> list[tuple[float, float]]:
    _load_scores()
    return list(_scores)


def _reset_scores_for_tests() -> None:
    global _scores_loaded
    _scores.clear()
    _scores_loaded = True
