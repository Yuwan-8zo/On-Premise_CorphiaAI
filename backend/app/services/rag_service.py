"""
RAG ?å?æ¨¡ç?

å¯¦ä??‘é??²å??‡æª¢ç´¢å???
"""

import logging
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

# ?¨å? ChromaDB å®¢æˆ¶ç«?
_chroma_client = None
_embedding_model = None


class RAGService:
    """RAG æª¢ç´¢?å?"""
    
    COLLECTION_NAME = "corphia_documents"
    
    def __init__(self):
        self.client = None
        self.collection = None
        self.embed_model = None
        self._initialized = False
    
    async def initialize(self) -> bool:
        """
        ?å???RAG ?å?
        
        Returns:
            bool: ?¯å¦?å??–æ???
        """
        if self._initialized:
            return True
        
        try:
            import chromadb
            from chromadb.config import Settings as ChromaSettings
            
            # ?å???ChromaDB
            logger.info("æ­?œ¨?å???ChromaDB...")
            
            self.client = chromadb.Client(ChromaSettings(
                persist_directory=settings.chroma_persist_directory,
                anonymized_telemetry=False,
            ))
            
            # ?–å??–å»ºç«?Collection
            self.collection = self.client.get_or_create_collection(
                name=self.COLLECTION_NAME,
                metadata={"description": "Corphia AI ?‡ä»¶?‘é??²å?"}
            )
            
            logger.info(f"??ChromaDB ?å??–å??ï?Collection: {self.COLLECTION_NAME}")
            
            # ?å???Embedding æ¨¡å?
            await self._init_embedding_model()
            
            self._initialized = True
            return True
            
        except ImportError:
            logger.warning("chromadb ?ªå?è£ï?RAG ?Ÿèƒ½å°‡è¢«?œç”¨")
            self._initialized = True
            return False
        except Exception as e:
            logger.error(f"RAG ?å??å??–å¤±?? {e}")
            self._initialized = True
            return False
    
    async def _init_embedding_model(self):
        """?å???Embedding æ¨¡å?"""
        try:
            from sentence_transformers import SentenceTransformer
            
            logger.info("æ­?œ¨è¼‰å…¥ Embedding æ¨¡å?...")
            
            # ä½¿ç”¨å¤šè?è¨€æ¨¡å?
            self.embed_model = SentenceTransformer(
                "paraphrase-multilingual-MiniLM-L12-v2"
            )
            
            logger.info("??Embedding æ¨¡å?è¼‰å…¥å®Œæ?")
            
        except ImportError:
            logger.warning("sentence-transformers ?ªå?è£ï?å°‡ä½¿?¨ç°¡?®ç??‡å??¹é?")
        except Exception as e:
            logger.warning(f"Embedding æ¨¡å?è¼‰å…¥å¤±æ?: {e}")
    
    def get_embedding(self, text: str) -> list[float]:
        """
        ?–å??‡å??„å??è¡¨ç¤?
        
        Args:
            text: è¼¸å…¥?‡å?
            
        Returns:
            list[float]: ?‘é?
        """
        if self.embed_model is None:
            # ä½¿ç”¨ç°¡å–®?„é?æ¹Šä??ºå??€
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
        ?°å??‡ä»¶?°å??å„²å­?
        
        Args:
            doc_id: ?‡ä»¶ ID
            chunks: ?‡ä»¶?†å??—è¡¨
            metadatas: æ¯å€‹å?å¡Šç??ƒè???
            
        Returns:
            int: ?°å??„å?å¡Šæ•¸??
        """
        if not self._initialized:
            await self.initialize()
        
        if self.collection is None:
            logger.warning("ChromaDB ?ªå?å§‹å?ï¼Œç„¡æ³•æ–°å¢æ?ä»?)
            return 0
        
        try:
            # ?Ÿæ? Chunk IDs
            chunk_ids = [f"{doc_id}_chunk_{i}" for i in range(len(chunks))]
            
            # ?Ÿæ??‘é?
            embeddings = [self.get_embedding(chunk) for chunk in chunks]
            
            # æº–å??ƒè???
            if metadatas is None:
                metadatas = [{"document_id": doc_id, "chunk_index": i} for i in range(len(chunks))]
            else:
                for i, meta in enumerate(metadatas):
                    meta["document_id"] = doc_id
                    meta["chunk_index"] = i
            
            # ?°å???Collection
            self.collection.add(
                ids=chunk_ids,
                embeddings=embeddings,
                documents=chunks,
                metadatas=metadatas,
            )
            
            logger.info(f"å·²æ–°å¢æ?ä»?{doc_id}ï¼Œå…± {len(chunks)} ?‹å?å¡?)
            return len(chunks)
            
        except Exception as e:
            logger.error(f"?°å??‡ä»¶å¤±æ?: {e}")
            raise
    
    async def search(
        self,
        query: str,
        tenant_id: Optional[str] = None,
        n_results: int = 5,
    ) -> list[dict]:
        """
        ?œå??¸é??‡ä»¶
        
        Args:
            query: ?¥è©¢?‡å?
            tenant_id: ç§Ÿæˆ¶ IDï¼ˆç”¨?¼é?æ¿¾ï?
            n_results: ?å‚³çµæ??¸é?
            
        Returns:
            list[dict]: ?œå?çµæ?
        """
        if not self._initialized:
            await self.initialize()
        
        if self.collection is None:
            return []
        
        try:
            # ?Ÿæ??¥è©¢?‘é?
            query_embedding = self.get_embedding(query)
            
            # å»ºç??æ¿¾æ¢ä»¶
            where_filter = None
            if tenant_id:
                where_filter = {"tenant_id": tenant_id}
            
            # ?·è??œå?
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=n_results,
                where=where_filter,
                include=["documents", "metadatas", "distances"],
            )
            
            # ?´ç?çµæ?
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
            logger.error(f"?œå?å¤±æ?: {e}")
            return []
    
    async def delete_document(self, doc_id: str) -> bool:
        """
        ?ªé™¤?‡ä»¶
        
        Args:
            doc_id: ?‡ä»¶ ID
            
        Returns:
            bool: ?¯å¦?å?
        """
        if self.collection is None:
            return False
        
        try:
            # ?ªé™¤è©²æ?ä»¶ç??€?‰å?å¡?
            self.collection.delete(
                where={"document_id": doc_id}
            )
            
            logger.info(f"å·²åˆª?¤æ?ä»? {doc_id}")
            return True
            
        except Exception as e:
            logger.error(f"?ªé™¤?‡ä»¶å¤±æ?: {e}")
            return False
    
    def build_context(
        self,
        search_results: list[dict],
        max_length: int = 2000,
    ) -> str:
        """
        å»ºæ? RAG ä¸Šä???
        
        Args:
            search_results: ?œå?çµæ?
            max_length: ?€å¤§é•·åº?
            
        Returns:
            str: ?¼å??–ç?ä¸Šä???
        """
        if not search_results:
            return ""
        
        context_parts = []
        current_length = 0
        
        for i, result in enumerate(search_results, 1):
            content = result.get("content", "")
            metadata = result.get("metadata", {})
            
            # ?¼å??–å???
            source_info = f"[ä¾†æ? {i}]"
            if "filename" in metadata:
                source_info += f" {metadata['filename']}"
            
            chunk_text = f"{source_info}\n{content}\n"
            
            if current_length + len(chunk_text) > max_length:
                break
            
            context_parts.append(chunk_text)
            current_length += len(chunk_text)
        
        return "\n---\n".join(context_parts)


# ?¨å? RAG ?å?å¯¦ä?
_rag_instance = None


def get_rag_service() -> RAGService:
    """?–å? RAG ?å??®ä?"""
    global _rag_instance
    if _rag_instance is None:
        _rag_instance = RAGService()
    return _rag_instance
