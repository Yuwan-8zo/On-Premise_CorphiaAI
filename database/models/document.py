"""
?‡ä»¶æ¨¡å?
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import String, DateTime, ForeignKey, Integer, BigInteger, Text, func
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.connection import Base

if TYPE_CHECKING:
    from database.models.tenant import Tenant
    from database.models.user import User
    from database.models.document_chunk import DocumentChunk


class DocumentStatus(str, Enum):
    """?‡ä»¶?•ç??€??""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Document(Base):
    """?‡ä»¶è³‡æ?è¡?""
    
    __tablename__ = "documents"
    
    # ä¸»éµ
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    
    # å¤–éµ
    tenant_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False
    )
    uploaded_by: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )
    
    # æª”æ?è³‡è?
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    
    # ?•ç??€??
    status: Mapped[str] = mapped_column(
        String(20),
        default=DocumentStatus.PENDING.value,
        nullable=False
    )
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # ?•ç?çµæ?
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    
    # ?ƒè???
    metadata: Mapped[dict] = mapped_column(JSON, default=dict)
    
    # ?‚é???
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=func.now(),
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=func.now(),
        onupdate=func.now(),
        nullable=False
    )
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # ?œè¯
    tenant: Mapped["Tenant"] = relationship(
        "Tenant",
        back_populates="documents"
    )
    uploaded_by_user: Mapped["User"] = relationship(
        "User",
        back_populates="documents"
    )
    chunks: Mapped[List["DocumentChunk"]] = relationship(
        "DocumentChunk",
        back_populates="document",
        cascade="all, delete-orphan"
    )
    
    def __repr__(self) -> str:
        return f"<Document(id={self.id}, filename={self.filename})>"
