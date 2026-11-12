"""
應用啟動階段狀態 — API 先就緒，LLM/RAG 背景預熱。

讓 /api/v1/health 在資料庫就緒後即可回 200，不必等 GGUF + Embedding 載完。
"""

from __future__ import annotations

import asyncio
import logging
from enum import Enum

logger = logging.getLogger(__name__)


class ServiceState(str, Enum):
    LOADING = "loading"
    READY = "ready"
    UNAVAILABLE = "unavailable"
    ERROR = "error"


_api_ready = False
_llm_state = ServiceState.LOADING
_rag_state = ServiceState.LOADING
_warmup_started = False
_warmup_task: asyncio.Task | None = None


def mark_api_ready() -> None:
    global _api_ready
    _api_ready = True


def is_llm_ready() -> bool:
    return _llm_state == ServiceState.READY


def is_rag_ready() -> bool:
    return _rag_state == ServiceState.READY


async def warm_ai_services() -> None:
    """背景載入 LLM 與 RAG；失敗時標記 unavailable，不阻擋 API。"""
    global _llm_state, _rag_state

    from app.services.llm_service import get_llm_service
    from app.services.rag_service import get_rag_service

    _llm_state = ServiceState.LOADING
    try:
        llm = get_llm_service()
        await llm.initialize()
        if not llm._initialized:
            _llm_state = ServiceState.ERROR
        elif llm.use_llama_cpp and llm._llama_instance is not None:
            try:
                await llm.generate("hi", max_tokens=1, temperature=0.0)
            except Exception as warm_exc:
                logger.warning("LLM 預熱推論略過: %s", warm_exc)
            _llm_state = ServiceState.READY
            logger.info("LLM 背景預熱完成")
        else:
            from app.core.config import settings as _settings
            if _settings.allow_simulated_llm:
                # 只在開發/測試明確允許時才用模擬回覆
                _llm_state = ServiceState.READY
                logger.warning("LLM 以模擬模式運行（未掛載 GGUF，ALLOW_SIMULATED_LLM=true）")
            else:
                # 正式/展示：沒有真實模型就標記錯誤，絕不用假回答
                _llm_state = ServiceState.ERROR
                logger.error("LLM 未掛載 GGUF 模型，已停用模擬回覆；請檢查 ai_model/ 後重新啟動")
    except Exception as exc:
        logger.error("LLM 背景初始化失敗: %s", exc, exc_info=True)
        _llm_state = ServiceState.ERROR

    _rag_state = ServiceState.LOADING
    try:
        rag = get_rag_service()
        ok = await rag.initialize()
        _rag_state = ServiceState.READY if ok else ServiceState.UNAVAILABLE
        if ok:
            logger.info("RAG Embedding 背景載入完成")
        else:
            logger.warning("RAG Embedding 未就緒，檢索功能可能受限")
    except Exception as exc:
        logger.error("RAG 背景初始化失敗: %s", exc, exc_info=True)
        _rag_state = ServiceState.ERROR

    # Keep the other configured models (e.g. 7B) loaded too, so switching is instant.
    try:
        await get_llm_service().preload_models()
    except Exception as exc:
        logger.error("預先載入其他模型失敗: %s", exc, exc_info=True)


def start_background_warmup() -> None:
    """在 lifespan 內呼叫一次，啟動背景預熱 task。"""
    global _warmup_started, _warmup_task
    if _warmup_started:
        return
    _warmup_started = True
    _warmup_task = asyncio.create_task(warm_ai_services())


def build_health_payload() -> dict:
    """組 health 回應；API 就緒即 status=ok。"""
    if not _api_ready:
        return {
            "status": "starting",
            "version": "2.3.0",
            "database": "connecting",
            "llm": ServiceState.LOADING.value,
            "rag": ServiceState.LOADING.value,
        }

    try:
        from app.services.llm_service import get_llm_service
        models = get_llm_service().get_model_states()
    except Exception:
        models = []
    return {
        "status": "ok",
        "version": "2.3.0",
        "database": "connected",
        "llm": _llm_state.value,
        "rag": _rag_state.value,
        "models": models,
    }
