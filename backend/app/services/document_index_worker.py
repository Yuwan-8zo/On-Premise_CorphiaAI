"""
文件向量化背景工作 — 限制並發並等待 RAG 就緒。
"""

from __future__ import annotations

import asyncio
import logging

logger = logging.getLogger(__name__)

_MAX_CONCURRENT = 2
_semaphore = asyncio.Semaphore(_MAX_CONCURRENT)
_RAG_WAIT_SEC = 180


async def run_document_index(document_id: str) -> None:
    """排程執行文件分塊與向量化。"""
    async with _semaphore:
        from app.services.boot_service import is_rag_ready

        waited = 0
        while not is_rag_ready() and waited < _RAG_WAIT_SEC:
            await asyncio.sleep(2)
            waited += 2

        if not is_rag_ready():
            logger.warning("RAG 未就緒，文件 %s 索引延後可能失敗", document_id)

        from app.core.database import async_session_maker
        from app.services.document_service import DocumentService

        async with async_session_maker() as db:
            doc_service = DocumentService(db)
            await doc_service.process_document(document_id)
