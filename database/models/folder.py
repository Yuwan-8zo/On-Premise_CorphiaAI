"""
è³‡æ?å¤¾æ¨¡??

?¨æ–¼å°è©±?†é?
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import String, DateTime, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.connection import Base

if TYPE_CHECKING:
    from database.models.user import User
    from database.models.conversation import Conversation


class Folder(Base):
    """è³‡æ?å¤¾è??™è¡¨"""
    
    __tablename__ = "folders"
    
    # ä¸»éµ
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    
    # å¤–éµ
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )
    parent_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("folders.id", ondelete="CASCADE"),
        nullable=True
    )
    
    # è³‡æ?å¤¾è?è¨?
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    icon: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    color: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    
    # ?’å?
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    
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
    conversations: Mapped[List["Conversation"]] = relationship(
        "Conversation",
        back_populates="folder"
    )
    children: Mapped[List["Folder"]] = relationship(
        "Folder",
        back_populates="parent",
        cascade="all, delete-orphan"
    )
    parent: Mapped[Optional["Folder"]] = relationship(
        "Folder",
        back_populates="children",
        remote_side=[id]
    )
    
    def __repr__(self) -> str:
        return f"<Folder(id={self.id}, name={self.name})>"
