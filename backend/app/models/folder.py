"""
資料夾模型

用於對話分類
"""

import uuid
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import String, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.conversation import Conversation


class Folder(TimestampMixin, Base):
    """資料夾資料表"""
    
    __tablename__ = "folders"
    
    # 主鍵
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    
    # 外鍵
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
    
    # 資料夾資訊
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    icon: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    color: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    # 專案的自訂指示：這個專案裡每一題都會附給 AI 的固定說明（例如「一律用條列式、引用條號」）
    instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # 排序
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    
    
    # 關聯
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
