"""
RAG 服務模組

實作向量儲存與檢索功能 (基於 PostgreSQL + pgvector)
"""

import logging
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.models.document_chunk import DocumentChunk
from app.models.document import Document

logger = logging.getLogger(__name__)

# 全域 Embedding 模型
_embedding_model = None

class RAGService:
    """RAG 檢索服務"""
    
    def __init__(self):
        self.embed_model = None
        self._initialized = False
    
    async def initialize(self) -> bool:
        """
        初始化 RAG 服務 (載入 Embedding 模型)
        
        Returns:
            bool: 是否初始化成功
        """
        if self._initialized:
            return True
        
        try:
            # 初始化 Embedding 模型
            await self._init_embedding_model()
            
            self._initialized = True
            return True
            
        except Exception as e:
            logger.error(f"RAG 服務初始化失敗: {e}")
            self._initialized = True
            return False
    
    async def _init_embedding_model(self):
        """初始化 Embedding 模型"""
        try:
            from sentence_transformers import SentenceTransformer
            
            logger.info("正在載入 Embedding 模型...")
            
            # 使用多語言模型，其維度應為 384
            self.embed_model = SentenceTransformer(
                "paraphrase-multilingual-MiniLM-L12-v2"
            )
            
            logger.info("✅ Embedding 模型載入完成")
            
        except ImportError:
            logger.warning("sentence-transformers 未安裝，將使用簡單的文字匹配")
        except Exception as e:
            logger.warning(f"Embedding 模型載入失敗: {e}")
    
    async def get_embedding(self, text: str) -> list[float]:
        """
        取得文字的向量表示（非同步，避免阻塞 event loop）

        Args:
            text: 輸入文字

        Returns:
            list[float]: 向量
        """
        if self.embed_model is None:
            # 使用簡單的雜湊作為回退（長度必須對應資料庫設計的 384 維度）
            import hashlib
            hash_obj = hashlib.sha512(text.encode())
            # SHA-512 gives 64 bytes -> we need 384 floats.
            base_val = [float(b) / 255.0 for b in hash_obj.digest()]  # 64 floats
            return (base_val * 6)[:384]

        # NOTE: sentence_transformers.encode() 是同步 CPU 密集型操作，
        # 必須以 asyncio.to_thread() 包裝，避免阻塞 async event loop
        import asyncio
        embedding = await asyncio.to_thread(self.embed_model.encode, text)
        return embedding.tolist()

    async def search(
        self,
        db: AsyncSession,
        query: str,
        tenant_id: Optional[str] = None,
        n_results: int = 5,
        document_ids: Optional[list[str]] = None,
    ) -> list[dict]:
        """
        搜尋相關文件 (基於 pgvector)
        
        Args:
            db: 資料庫 Session
            query: 查詢文字
            tenant_id: 租戶 ID（用於過濾）
            n_results: 回傳結果數量
            document_ids: 指定要搜尋的文件 ID 列表
            
        Returns:
            list[dict]: 搜尋結果
        """
        if not self._initialized:
            await self.initialize()
        
        # 如果提供了 document_ids 但為空列表，直接返回空結果（不執行無意義搜索）
        if document_ids is not None and len(document_ids) == 0:
            return []
        
        try:
            # 生成查詢向量
            query_embedding = await self.get_embedding(query)
            
            # 建立基本的查詢
            stmt = select(DocumentChunk).join(Document, DocumentChunk.document_id == Document.id)
            
            # 加入過濾條件
            if tenant_id:
                stmt = stmt.where(Document.tenant_id == tenant_id)
            if document_ids:
                stmt = stmt.where(DocumentChunk.document_id.in_(document_ids))
            
            # 使用 pgvector 的 cosine_distance 進行排序
            # L2 distance: DocumentChunk.embedding.l2_distance(query_embedding)
            # Cosine distance: DocumentChunk.embedding.cosine_distance(query_embedding)
            stmt = stmt.order_by(DocumentChunk.embedding.cosine_distance(query_embedding)).limit(n_results)
            
            # 執行搜尋
            result = await db.execute(stmt)
            chunks = result.scalars().all()
            
            # 整理結果
            search_results = []
            for chunk in chunks:
                # 這裡暫時沒有精確的 distance 值如果我們只抓 scalars
                # 但順序是按照最相似排列的
                search_results.append({
                    "chunk_id": chunk.id,
                    "content": chunk.content,
                    "metadata": chunk.chunk_metadata or {},
                    "score": 1.0, # 假設為高相對分數
                })
            
            return search_results
            
        except Exception as e:
            logger.error(f"搜尋失敗: {e}")
            return []
    
    def build_context(
        self,
        search_results: list[dict],
        max_length: int = 2000,
    ) -> str:
        """
        建構 RAG 上下文
        
        Args:
            search_results: 搜尋結果
            max_length: 最大長度
            
        Returns:
            str: 格式化的上下文
        """
        if not search_results:
            return ""
        
        context_parts = []
        current_length = 0
        
        for i, result in enumerate(search_results, 1):
            content = result.get("content", "")
            metadata = result.get("metadata", {})
            
            # 格式化引用
            source_info = f"[來源 {i}]"
            if "filename" in metadata:
                source_info += f" {metadata['filename']}"
            
            chunk_text = f"{source_info}\n{content}\n"
            
            if current_length + len(chunk_text) > max_length:
                break
            
            context_parts.append(chunk_text)
            current_length += len(chunk_text)
        
        return "\n---\n".join(context_parts)


# 全域 RAG 服務實例
_rag_instance = None


def get_rag_service() -> RAGService:
    """取得 RAG 服務單例"""
    global _rag_instance
    if _rag_instance is None:
        _rag_instance = RAGService()
    return _rag_instance
