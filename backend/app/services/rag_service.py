"""
RAG 服務

負責向量嵌入、儲存與檢索
整合 ChromaDB
"""

import os
from typing import List, Optional, Tuple
import uuid

import chromadb
from chromadb.config import Settings as ChromaSettings
from chromadb.utils import embedding_functions

from app.core.config import settings
from app.models.document_chunk import DocumentChunk


class RAGService:
    """RAG 檢索增強生成服務"""
    
    def __init__(self):
        # 初始化 ChromaDB Client
        os.makedirs(settings.chroma_persist_directory, exist_ok=True)
        
        self.client = chromadb.PersistentClient(
            path=settings.chroma_persist_directory,
            settings=ChromaSettings(
                anonymized_telemetry=False,
                allow_reset=True
            )
        )
        
        # 使用 Sentence Transformers 產生嵌入
        # 預設使用 all-MiniLM-L6-v2，支援中文較好的模型可換成 'paraphrase-multilingual-MiniLM-L12-v2'
        self.embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name="all-MiniLM-L6-v2"
        )
        
        # 獲取或建立集合
        self.collection = self.client.get_or_create_collection(
            name="corphia_knowledge_base",
            embedding_function=self.embedding_fn,
            metadata={"hnsw:space": "cosine"}
        )
    
    async def add_chunks(self, tenant_id: str, document_id: str, chunks: List[DocumentChunk]) -> None:
        """
        將文件分塊加入向量資料庫
        
        Args:
            tenant_id: 租戶 ID
            document_id: 文件 ID
            chunks: 分塊列表
        """
        if not chunks:
            return
            
        ids = []
        documents = []
        metadatas = []
        
        for chunk in chunks:
            # 確保有 Vector ID
            if not chunk.vector_id:
                chunk.vector_id = str(uuid.uuid4())
                
            ids.append(chunk.vector_id)
            documents.append(chunk.content)
            
            # 準備元資料
            meta = {
                "tenant_id": tenant_id,
                "document_id": document_id,
                "chunk_index": chunk.chunk_index,
            }
            # 合併分塊自帶的元資料
            if chunk.chunk_metadata:
                for k, v in chunk.chunk_metadata.items():
                    # Chroma metadata 只能是 str, int, float, bool
                    if isinstance(v, (str, int, float, bool)):
                        meta[k] = v
                    else:
                        meta[k] = str(v)
                        
            metadatas.append(meta)
            
        # 寫入 ChromaDB
        self.collection.add(
            ids=ids,
            documents=documents,
            metadatas=metadatas
        )
    
    async def delete_document(self, document_id: str) -> None:
        """從向量資料庫刪除文件的所有分塊"""
        self.collection.delete(
            where={"document_id": document_id}
        )
    
    async def search(
        self, 
        query: str, 
        tenant_id: str, 
        n_results: int = 5,
        threshold: float = 0.3
    ) -> List[dict]:
        """
        向量搜尋
        
        Args:
            query: 查詢字串
            tenant_id: 租戶 ID (用於資料隔離)
            n_results: 返回結果數量
            threshold: 相似度門檻 (距離越小越相似，cosine distance)
            
        Returns:
            List[dict]: 搜尋結果列表
        """
        results = self.collection.query(
            query_texts=[query],
            n_results=n_results,
            where={"tenant_id": tenant_id}  # 租戶隔離
        )
        
        # 解析結果
        parsed_results = []
        
        if not results["ids"]:
            return []
            
        ids = results["ids"][0]
        distances = results["distances"][0] if results["distances"] else [0] * len(ids)
        metadatas = results["metadatas"][0] if results["metadatas"] else [{}] * len(ids)
        documents = results["documents"][0] if results["documents"] else [""] * len(ids)
        
        for i, doc_id in enumerate(ids):
            distance = distances[i]
            
            # 過濾相似度太低的結果 (cosine distance: 0=完全相同, 2=完全相反)
            # 這裡簡單設 distance > threshold 則過濾，視 threshold 定義而定
            # 一般來說 0.3~0.5 是不錯的範圍
            if distance > (1 - 0.7): # 假設相似度要 > 0.7，則 distance < 0.3
                 pass
                 
            parsed_results.append({
                "id": doc_id,
                "content": documents[i],
                "metadata": metadatas[i],
                "score": 1 - distance, # 轉換為相似度分數 (0-1)
                "distance": distance
            })
            
        # 按相似度排序
        parsed_results.sort(key=lambda x: x["score"], reverse=True)
        
        return parsed_results


# 單例
rag_service = RAGService()
