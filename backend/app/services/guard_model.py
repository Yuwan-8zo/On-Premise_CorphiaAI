"""
資安專用模型（Qwen3Guard-Gen，阿里通義，Apache-2.0）

模型複查（第 5 層）之前先問這個專門判斷「安不安全」的小模型（0.6B，約 1 GB 記憶體）：
  - 判定「不安全」→ 直接攔阻（越獄、提示詞注入算 injection；個資類算 secret）
  - 判定「安全」或「有爭議」→ 回 None，照舊交給原本的本機模型複查
所以加了它只會多擋、不會少擋；它擋下的會在稽核紀錄寫「資安模型複查」，跟原本的「模型複查」分開統計。

模型用獨立的 llama-server 行程跑（自己一個 LlamaEngine），不佔使用者選的模型名額，
也不會因為使用者切換模型被關掉。模型檔不在、引擎不能用、逾時、看不懂回答 → 回 None（略過這一關，不影響其他關卡）。

Qwen3Guard-Gen 的輸出格式（判斷使用者提問時）：
    Safety: Safe|Unsafe|Controversial
    Categories: Violent|Non-violent Illegal Acts|Sexual Content or Sexual Acts|PII|
                Suicide & Self-Harm|Unethical Acts|Politically Sensitive Topics|Copyright Violation|Jailbreak|None
"""
from __future__ import annotations

import asyncio
import atexit
import logging
import re
from pathlib import Path
from typing import Optional

import httpx

from app.core.config import settings
from app.services.llm_engine import REPO_ROOT, LlamaEngine

logger = logging.getLogger(__name__)

SAFE = "safe"
INJECTION = "injection"
SECRET = "secret"

_SAFETY_RE = re.compile(r"Safety:\s*(Safe|Unsafe|Controversial)", re.IGNORECASE)
_CATEGORY_RE = re.compile(r"Categories:\s*(.+)", re.IGNORECASE)
# 這幾類算「索取機密／個資」（走 DLP 那一關的訊息）；其他不安全類別都算攻擊（提示詞注入那一關）
_SECRET_CATEGORIES = ("pii", "personally identifiable")

_engine: Optional[LlamaEngine] = None
_lock = asyncio.Lock()


def model_path() -> Path:
    p = Path(settings.guard_model_path)
    return p if p.is_absolute() else REPO_ROOT / p


def available() -> bool:
    return settings.enable_guard_model and model_path().is_file()


def parse_verdict(output: str) -> Optional[str]:
    """把 Qwen3Guard 的回答換成 safe／injection／secret；「有爭議」或看不懂回 None（交給下一關）"""
    m = _SAFETY_RE.search(output or "")
    if not m:
        return None
    safety = m.group(1).lower()
    if safety == "safe":
        return SAFE
    if safety != "unsafe":
        return None  # Controversial：不自己決定
    cat = _CATEGORY_RE.search(output or "")
    categories = (cat.group(1) if cat else "").lower()
    return SECRET if any(k in categories for k in _SECRET_CATEGORIES) else INJECTION


async def _ensure():
    global _engine
    async with _lock:
        if _engine is None:
            _engine = LlamaEngine()
            atexit.register(_engine.stop_all)  # 後端或測試腳本結束時一起關，不留孤兒行程
        m, _ = await asyncio.to_thread(_engine.ensure, str(model_path()), True)
        return m


async def guard_check(text: str) -> Optional[str]:
    """回 safe／injection／secret；不能用或拿不準回 None"""
    if not available() or not (text or "").strip():
        return None
    try:
        m = await _ensure()
        async with httpx.AsyncClient(timeout=settings.guard_model_timeout) as client:
            r = await client.post(
                f"{m.base_url}/v1/chat/completions",
                headers=m.headers,
                json={
                    "messages": [{"role": "user", "content": text[:2000]}],
                    "temperature": 0.0,
                    "max_tokens": 64,
                },
            )
        r.raise_for_status()
        content = r.json()["choices"][0]["message"].get("content") or ""
    except Exception as e:  # 這一關壞掉不能讓整個系統不能用
        logger.warning("資安模型複查失敗，交給下一關: %s", e)
        return None
    return parse_verdict(content)


def shutdown() -> None:
    if _engine is not None:
        _engine.stop_all()


__all__ = ["guard_check", "parse_verdict", "available", "model_path", "shutdown", "SAFE", "INJECTION", "SECRET"]
