"""
對話模型
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import String, Boolean, DateTime, ForeignKey, Integer, func
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.tenant import Tenant
    from app.models.user import User
    from app.models.message import Message
    from app.models.folder import Folder


class Conversation(Base):
    """對話資料表"""
    
    __tablename__ = "conversations"
    
    # 主鍵
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    
    # 外鍵
    tenant_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    folder_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("folders.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    
    # 對話資訊
    title: Mapped[str] = mapped_column(String(255), default="新對話")
    model: Mapped[str] = mapped_column(String(50), default="default")
    
    # 設定
    settings: Mapped[dict] = mapped_column(JSON, default=dict)
    
    # 統計
    message_count: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    
    # 狀態
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # 時間戳
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=func.now(),
        nullable=False,
        index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=func.now(),
        onupdate=func.now(),
        nullable=False,
        index=True
    )
    
    # 關聯
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
