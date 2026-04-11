"""
RAG 服務模組

實作向量儲存與檢索功能
"""

import logging
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

# 全域 ChromaDB 客戶端
_chroma_client = None
_embedding_model = None


class RAGService:
    """RAG 檢索服務"""
    
    COLLECTION_NAME = "corphia_documents"
    
    def __init__(self):
        self.client = None
        self.collection = None
        self.embed_model = None
        self._initialized = False
    
    async def initialize(self) -> bool:
        """
        初始化 RAG 服務
        
        Returns:
            bool: 是否初始化成功
        """
        if self._initialized:
            return True
        
        try:
            import chromadb
            from chromadb.config import Settings as ChromaSettings
            
            # 初始化 ChromaDB
            logger.info("正在初始化 ChromaDB...")
            
            self.client = chromadb.Client(ChromaSettings(
                persist_directory=settings.chroma_persist_directory,
                anonymized_telemetry=False,
            ))
            
            # 取得或建立 Collection
            self.collection = self.client.get_or_create_collection(
                name=self.COLLECTION_NAME,
                metadata={"description": "Corphia AI 文件向量儲存"}
            )
            
            logger.info(f"✅ ChromaDB 初始化完成，Collection: {self.COLLECTION_NAME}")
            
            # 初始化 Embedding 模型
            await self._init_embedding_model()
            
            self._initialized = True
            return True
            
        except ImportError:
            logger.warning("chromadb 未安裝，RAG 功能將被停用")
            self._initialized = True
            return False
        except Exception as e:
            logger.error(f"RAG 服務初始化失敗: {e}")
            self._initialized = True
            return False
    
    async def _init_embedding_model(self):
        """初始化 Embedding 模型"""
        try:
            from sentence_transformers import SentenceTransformer
            
            logger.info("正在載入 Embedding 模型...")
            
            # 使用多語言模型
            self.embed_model = SentenceTransformer(
                "paraphrase-multilingual-MiniLM-L12-v2"
            )
            
            logger.info("✅ Embedding 模型載入完成")
            
        except ImportError:
            logger.warning("sentence-transformers 未安裝，將使用簡單的文字匹配")
        except Exception as e:
            logger.warning(f"Embedding 模型載入失敗: {e}")
    
    def get_embedding(self, text: str) -> list[float]:
        """
        取得文字的向量表示
        
        Args:
            text: 輸入文字
            
        Returns:
            list[float]: 向量
        """
        if self.embed_model is None:
            # 使用簡單的雜湊作為回退
            import hashlib
            hash_obj = hashlib.md5(text.encode())
            return [float(b) / 255.0 for b in hash_obj.digest()]
        
        embedding = self.embed_model.encode(text)
        return embedding.tolist()
    
    async def add_document(
        self,
        doc_id: str,
        chunks: list[str],
        metadatas: Optional[list[dict]] = None,
    ) -> int:
        """
        新增文件到向量儲存
        
        Args:
            doc_id: 文件 ID
            chunks: 文件分塊列表
            metadatas: 每個分塊的元資料
            
        Returns:
            int: 新增的分塊數量
        """
        if not self._initialized:
            await self.initialize()
        
        if self.collection is None:
            logger.warning("ChromaDB 未初始化，無法新增文件")
            return 0
        
        try:
            # 生成 Chunk IDs
            chunk_ids = [f"{doc_id}_chunk_{i}" for i in range(len(chunks))]
            
            # 生成向量
            embeddings = [self.get_embedding(chunk) for chunk in chunks]
            
            # 準備元資料
            if metadatas is None:
                metadatas = [{"document_id": doc_id, "chunk_index": i} for i in range(len(chunks))]
            else:
                for i, meta in enumerate(metadatas):
                    meta["document_id"] = doc_id
                    meta["chunk_index"] = i
            
            # 新增到 Collection
            self.collection.add(
                ids=chunk_ids,
                embeddings=embeddings,
                documents=chunks,
                metadatas=metadatas,
            )
            
            logger.info(f"已新增文件 {doc_id}，共 {len(chunks)} 個分塊")
            return len(chunks)
            
        except Exception as e:
            logger.error(f"新增文件失敗: {e}")
            raise
    
    async def search(
        self,
        query: str,
        tenant_id: Optional[str] = None,
        n_results: int = 5,
        document_ids: Optional[list[str]] = None,
    ) -> list[dict]:
        """
        搜尋相關文件
        
        Args:
            query: 查詢文字
            tenant_id: 租戶 ID（用於過濾）
            n_results: 回傳結果數量
            document_ids: 指定要搜尋的文件 ID 列表
            
        Returns:
            list[dict]: 搜尋結果
        """
        if not self._initialized:
            await self.initialize()
        
        if self.collection is None:
            return []
            
        # 如果提供了 document_ids 但為空列表，直接返回空結果（不執行無意義搜索）
        if document_ids is not None and len(document_ids) == 0:
            return []
        
        try:
            # 生成查詢向量
            query_embedding = self.get_embedding(query)
            
            # 建立過濾條件
            where_conditions = []
            if tenant_id:
                where_conditions.append({"tenant_id": tenant_id})
            if document_ids:
                where_conditions.append({"document_id": {"$in": document_ids}})
                
            where_filter = None
            if len(where_conditions) == 1:
                where_filter = where_conditions[0]
            elif len(where_conditions) > 1:
                where_filter = {"$and": where_conditions}
            
            # 執行搜尋
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=n_results,
                where=where_filter,
                include=["documents", "metadatas", "distances"],
            )
            
            # 整理結果
            search_results = []
            if results and results["ids"]:
                for i, chunk_id in enumerate(results["ids"][0]):
                    search_results.append({
                        "chunk_id": chunk_id,
                        "content": results["documents"][0][i] if results["documents"] else "",
                        "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
                        "score": 1 - results["distances"][0][i] if results["distances"] else 0,
                    })
            
            return search_results
            
        except Exception as e:
            logger.error(f"搜尋失敗: {e}")
            return []
    
    async def delete_document(self, doc_id: str) -> bool:
        """
        刪除文件
        
        Args:
            doc_id: 文件 ID
            
        Returns:
            bool: 是否成功
        """
        if self.collection is None:
            return False
        
        try:
            # 刪除該文件的所有分塊
            self.collection.delete(
                where={"document_id": doc_id}
            )
            
            logger.info(f"已刪除文件: {doc_id}")
            return True
            
        except Exception as e:
            logger.error(f"刪除文件失敗: {e}")
            return False
    
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
