"""
訊息模型
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Optional

from sqlalchemy import String, DateTime, ForeignKey, Integer, Text, func
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.conversation import Conversation


class MessageRole(str, Enum):
    """訊息角色"""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class Message(Base):
    """訊息資料表"""
    
    __tablename__ = "messages"
    
    # 主鍵
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    
    # 外鍵
    conversation_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # 訊息內容
    role: Mapped[str] = mapped_column(
        String(20),
        nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Token 統計
    tokens: Mapped[int] = mapped_column(Integer, default=0)
    
    # RAG 來源引用 (JSON 陣列)
    sources: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    
    # 使用者評分 (1-5)
    rating: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # 時間戳
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=func.now(),
        nullable=False,
        index=True
    )
    
    # 關聯
    conversation: Mapped["Conversation"] = relationship(
        "Conversation",
        back_populates="messages"
    )
    
    def __repr__(self) -> str:
        return f"<Message(id={self.id}, role={self.role})>"
