"""
文件分塊模型

儲存文件的分塊內容，用於 RAG 向量檢索
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import String, DateTime, ForeignKey, Integer, Text, func
from sqlalchemy.dialects.postgresql import JSONB as JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.document import Document


class DocumentChunk(Base):
    """文件分塊資料表"""
    
    __tablename__ = "document_chunks"
    
    # 主鍵
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    
    # 外鍵
    document_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False
    )
    
    # 分塊資訊
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    
    # 向量資料 (對應 pgvector)
    embedding: Mapped[list[float]] = mapped_column(Vector(384), nullable=True)
    
    # 元資料 (頁碼、位置等)
    chunk_metadata: Mapped[dict] = mapped_column(JSON, default=dict)
    
    # 時間戳
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=func.now(),
        nullable=False
    )
    
    # 關聯
    document: Mapped["Document"] = relationship(
        "Document",
        back_populates="chunks"
    )
    
    def __repr__(self) -> str:
        return f"<DocumentChunk(id={self.id}, index={self.chunk_index})>"
