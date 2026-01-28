"""
ç§Ÿæˆ¶æ¨¡å?

?¯æ´å¤šç??¶é???
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, List

from sqlalchemy import String, Boolean, DateTime, Text, func
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.connection import Base

if TYPE_CHECKING:
    from database.models.user import User
    from database.models.conversation import Conversation
    from database.models.document import Document


class Tenant(Base):
    """ç§Ÿæˆ¶è³‡æ?è¡?""
    
    __tablename__ = "tenants"
    
    # ä¸»éµ
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    
    # ?ºæœ¬è³‡è?
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    
    # è¨­å? (JSON)
    settings: Mapped[dict] = mapped_column(JSON, default=dict)
    
    # ?€??
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
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
    users: Mapped[List["User"]] = relationship(
        "User",
        back_populates="tenant",
        cascade="all, delete-orphan"
    )
    conversations: Mapped[List["Conversation"]] = relationship(
        "Conversation",
        back_populates="tenant",
        cascade="all, delete-orphan"
    )
    documents: Mapped[List["Document"]] = relationship(
        "Document",
        back_populates="tenant",
        cascade="all, delete-orphan"
    )
    
    def __repr__(self) -> str:
        return f"<Tenant(id={self.id}, name={self.name})>"
