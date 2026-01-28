"""
?‡ä»¶?†å?æ¨¡å?

?²å??‡ä»¶?„å?å¡Šå…§å®¹ï??¨æ–¼ RAG ?‘é?æª¢ç´¢
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import String, DateTime, ForeignKey, Integer, Text, func
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.connection import Base

if TYPE_CHECKING:
    from database.models.document import Document


class DocumentChunk(Base):
    """?‡ä»¶?†å?è³‡æ?è¡?""
    
    __tablename__ = "document_chunks"
    
    # ä¸»éµ
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    
    # å¤–éµ
    document_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False
    )
    
    # ?†å?è³‡è?
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    
    # ?‘é? ID (å°æ? ChromaDB)
    vector_id: Mapped[str] = mapped_column(String(36), nullable=True)
    
    # ?ƒè???(?ç¢¼?ä?ç½®ç?)
    chunk_metadata: Mapped[dict] = mapped_column(JSON, default=dict)
    
    # ?‚é???
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=func.now(),
        nullable=False
    )
    
    # ?œè¯
    document: Mapped["Document"] = relationship(
        "Document",
        back_populates="chunks"
    )
    
    def __repr__(self) -> str:
        return f"<DocumentChunk(id={self.id}, index={self.chunk_index})>"
