"""
使用者記憶：跨對話記住的事（「我是業務部的」「報告都用條列式」）

每個人只看得到、用得到自己的記憶；回答前放進系統提示（見 services/memory_service.py）。
怎麼來：
  manual  設定頁手動新增
  chat    對話裡說「記住……」
"""

import uuid
from typing import Optional

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, TimestampMixin


class MemorySource:
    MANUAL = "manual"
    CHAT = "chat"


class UserMemory(TimestampMixin, Base):
    __tablename__ = "user_memories"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str] = mapped_column(String(20), default=MemorySource.MANUAL)
    # 從哪個對話記下來的（對話刪掉後記憶還在）
    conversation_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("conversations.id", ondelete="SET NULL"), nullable=True)
