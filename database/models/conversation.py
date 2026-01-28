"""
å°è©±æ¨¡å?
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import String, Boolean, DateTime, ForeignKey, Integer, func
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.connection import Base

if TYPE_CHECKING:
    from database.models.tenant import Tenant
    from database.models.user import User
    from database.models.message import Message
    from database.models.folder import Folder


class Conversation(Base):
    """å°è©±è³‡æ?è¡?""
    
    __tablename__ = "conversations"
    
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
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )
    folder_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("folders.id", ondelete="SET NULL"),
        nullable=True
    )
    
    # å°è©±è³‡è?
    title: Mapped[str] = mapped_column(String(255), default="?°å?è©?)
    model: Mapped[str] = mapped_column(String(50), default="default")
    
    # è¨­å?
    settings: Mapped[dict] = mapped_column(JSON, default=dict)
    
    # çµ±è?
    message_count: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    
    # ?€??
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
    
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
    
    # ?œè¯
    tenant: Mapped["Tenant"] = relationship(
        "Tenant",
        back_populates="conversations"
    )
    user: Mapped["User"] = relationship(
        "User",
        back_populates="conversations"
    )
    folder: Mapped[Optional["Folder"]] = relationship(
        "Folder",
        back_populates="conversations"
    )
    messages: Mapped[List["Message"]] = relationship(
        "Message",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.created_at"
    )
    
    def __repr__(self) -> str:
        return f"<Conversation(id={self.id}, title={self.title})>"
