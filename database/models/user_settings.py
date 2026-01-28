"""
ä½¿ç”¨?…è¨­å®šæ¨¡??
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import String, DateTime, ForeignKey, func
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.connection import Base

if TYPE_CHECKING:
    from database.models.user import User


class UserSettings(Base):
    """ä½¿ç”¨?…è¨­å®šè??™è¡¨"""
    
    __tablename__ = "user_settings"
    
    # ä¸»éµ
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    
    # å¤–éµ (ä¸€å°ä?)
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False
    )
    
    # ä»‹é¢è¨­å?
    theme: Mapped[str] = mapped_column(String(20), default="light")
    language: Mapped[str] = mapped_column(String(10), default="zh-TW")
    
    # å°è©±è¨­å?
    default_model: Mapped[str] = mapped_column(String(50), default="default")
    temperature: Mapped[float] = mapped_column(default=0.7)
    max_tokens: Mapped[int] = mapped_column(default=2048)
    
    # ?¶ä?è¨­å? (JSON)
    preferences: Mapped[dict] = mapped_column(JSON, default=dict)
    
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
    user: Mapped["User"] = relationship(
        "User",
        back_populates="settings"
    )
    
    def __repr__(self) -> str:
        return f"<UserSettings(user_id={self.user_id})>"
