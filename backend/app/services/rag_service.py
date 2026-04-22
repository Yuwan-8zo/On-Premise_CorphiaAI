"""
RAG 服務模組

實作向量儲存與檢索功能 (基於 PostgreSQL + pgvector)
"""

import logging
import re
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func

from app.core.config import settings
from app.models.document_chunk import DocumentChunk
from app.models.document import Document

logger = logging.getLogger(__name__)

# 全域 Embedding 模型
_embedding_model = None


# ── 關鍵字斷詞輔助（粗糙但零依賴）─────────────────────────────
# 支援中英混排：
#   英文 → 以空白 / 標點斷開
#   中文 → 連續 CJK 字元整塊保留 + 二字 bigram 拆分
# 2024+ 的向量模型早已能處理中文，但 hybrid 用關鍵字 re-rank 時，
# 光靠整句子當 token 會命中率 0；這裡給一個實用的中間解。
_CJK_RE = re.compile(r"[\u4e00-\u9fff]+")
_ASCII_WORD_RE = re.compile(r"[A-Za-z0-9_\-]+")


def _tokenize_query(query: str, min_len: int = 2, max_tokens: int = 32) -> list[str]:
    """把 query 斷成若干 token（小寫化、去重、長度過濾）。"""
    q = query.strip()
    if not q:
        return []

    tokens: list[str] = []

    # 英文 / 數字詞
    for m in _ASCII_WORD_RE.findall(q):
        if len(m) >= min_len:
            tokens.append(m.lower())

    # 中文：整塊 + bigram
    for cjk in _CJK_RE.findall(q):
        if len(cjk) >= min_len:
            tokens.append(cjk)
        # bigram 補漏，讓「資料主權」也能命中「資料」「料主」「主權」
        for i in range(len(cjk) - 1):
            tokens.append(cjk[i : i + 2])

    # 去重並保留順序
    seen: set[str] = set()
    uniq: list[str] = []
    for t in tokens:
        if t not in seen:
            seen.add(t)
            uniq.append(t)
        if len(uniq) >= max_tokens:
            break
    return uniq

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
        similarity_threshold: float = 0.3,
    ) -> list[dict]:
        """
        搜尋相關文件 (基於 pgvector)
        
        Args:
            db: 資料庫 Session
            query: 查詢文字
            tenant_id: 租戶 ID（用於過濾）
            n_results: 回傳結果數量
            document_ids: 指定要搜尋的文件 ID 列表
            similarity_threshold: 最低相似度門檻（0~1），低於此值的結果會被過濾
            
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
            
            # 計算 cosine distance 並用 add_columns 取回數值
            cosine_dist = DocumentChunk.embedding.cosine_distance(query_embedding)
            
            # 建立查詢，包含 distance 欄位
            stmt = (
                select(DocumentChunk, cosine_dist.label("distance"))
                .join(Document, DocumentChunk.document_id == Document.id)
            )
            
            # 加入過濾條件
            if tenant_id:
                stmt = stmt.where(Document.tenant_id == tenant_id)
            if document_ids:
                stmt = stmt.where(DocumentChunk.document_id.in_(document_ids))
            
            # 按 cosine distance 排序（越小越相似）
            stmt = stmt.order_by(cosine_dist).limit(n_results)
            
            # 執行搜尋
            result = await db.execute(stmt)
            rows = result.all()
            
            # 整理結果，將 cosine distance 轉為相似度分數 (1 - distance)
            search_results = []
            for row in rows:
                chunk = row[0]
                distance = float(row[1])
                similarity = round(1.0 - distance, 4)
                
                # 過濾低相似度結果
                if similarity < similarity_threshold:
                    continue
                
                search_results.append({
                    "chunk_id": chunk.id,
                    "content": chunk.content,
                    "metadata": chunk.chunk_metadata or {},
                    "score": similarity,
                    "distance": round(distance, 4),
                })
            
            return search_results
            
        except Exception as e:
            logger.error(f"搜尋失敗: {e}")
            return []
    
    async def hybrid_search(
        self,
        db: AsyncSession,
        query: str,
        tenant_id: Optional[str] = None,
        n_results: int = 5,
        document_ids: Optional[list[str]] = None,
        similarity_threshold: float = 0.25,
        bm25_weight: Optional[float] = None,
    ) -> list[dict]:
        """
        混合檢索 (Hybrid Search) = 向量相似度 + 關鍵字（BM25-ish）

        差異化：純向量檢索容易把「意思接近但關鍵字不同」的片段排上去，
              偶爾會漏掉文件裡明明有的專有名詞（例如「SOP 編號 A-123」）。
              這裡對每個候選 chunk 同時算：
                - vec_score  = 1 - cosine_distance
                - kw_score   = 歸一化後的關鍵字 token 命中率
              最後以 bm25_weight 做線性組合。

        設計取捨：
        - 我們不依賴 PostgreSQL 全文索引（tsvector），因為中文斷詞成本高
          且中小企業 DB 通常未配置 ts_config。
        - 採用應用層 token 命中計數，準確度略輸 BM25 但零外部依賴。

        Args:
            bm25_weight: 0~1，預設由 settings.rag_bm25_weight 控制。
                         0 = 全靠向量；1 = 全靠關鍵字。
        """
        if bm25_weight is None:
            bm25_weight = settings.rag_bm25_weight
        bm25_weight = max(0.0, min(1.0, bm25_weight))
        vec_weight = 1.0 - bm25_weight

        # 候選召回：先拿向量 Top-K*3，再用關鍵字 re-rank
        oversample = max(n_results * 3, n_results + 5)

        # ── 1) 向量召回 ─────────────────────────────────────
        vector_hits = await self.search(
            db=db,
            query=query,
            tenant_id=tenant_id,
            n_results=oversample,
            document_ids=document_ids,
            similarity_threshold=0.0,  # 下面自己過濾
        )

        if not vector_hits:
            return []

        # ── 2) 關鍵字召回（補漏）──────────────────────────
        # 這段可選：如果向量已足夠就跳過。為保險起見仍額外抓 5 個關鍵字命中。
        tokens = _tokenize_query(query)
        keyword_hits: list[dict] = []
        if tokens:
            try:
                conditions = [
                    DocumentChunk.content.ilike(f"%{t}%") for t in tokens
                ]
                kw_stmt = (
                    select(DocumentChunk)
                    .join(Document, DocumentChunk.document_id == Document.id)
                    .where(or_(*conditions))
                )
                if tenant_id:
                    kw_stmt = kw_stmt.where(Document.tenant_id == tenant_id)
                if document_ids:
                    kw_stmt = kw_stmt.where(DocumentChunk.document_id.in_(document_ids))
                kw_stmt = kw_stmt.limit(oversample)

                result = await db.execute(kw_stmt)
                for chunk in result.scalars().all():
                    keyword_hits.append({
                        "chunk_id": chunk.id,
                        "content": chunk.content,
                        "metadata": chunk.chunk_metadata or {},
                        "score": 0.0,
                        "distance": None,
                    })
            except Exception as e:
                logger.warning(f"關鍵字召回失敗（fallback 純向量）: {e}")

        # ── 3) 合併 + re-rank ─────────────────────────────
        merged: dict[str, dict] = {}
        for hit in vector_hits + keyword_hits:
            cid = hit["chunk_id"]
            if cid not in merged:
                merged[cid] = dict(hit)

        # 關鍵字分數：token 命中數 / token 總數
        for hit in merged.values():
            content_lower = hit["content"].lower()
            if tokens:
                matched = sum(1 for t in tokens if t in content_lower)
                hit["kw_score"] = round(matched / len(tokens), 4)
            else:
                hit["kw_score"] = 0.0
            hit["vec_score"] = hit.get("score", 0.0)
            hit["hybrid_score"] = round(
                vec_weight * hit["vec_score"] + bm25_weight * hit["kw_score"],
                4,
            )

        # 排序並過濾
        ranked = sorted(
            merged.values(), key=lambda x: x["hybrid_score"], reverse=True
        )
        ranked = [r for r in ranked if r["hybrid_score"] >= similarity_threshold]
        return ranked[:n_results]

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
