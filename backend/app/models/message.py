"""
訊息模型
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Optional

from sqlalchemy import String, DateTime, ForeignKey, Integer, Text, func
from sqlalchemy.dialects.postgresql import JSONB as JSON
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
    
    # 對話分支：這一則接在哪一則後面（第一則是 None）。同一則後面、同角色的好幾則＝同一個位置的不同版本
    # （見 services/message_tree.py）。不設外鍵：訊息只增不刪，整個對話刪除時跟著 conversation 一起刪
    parent_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)

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
    
    # 模型的思考過程（只有會推理的模型才有；已過回答的安全檢查）。不算進對話歷史、不算進防竄改雜湊
    reasoning: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # 這一則回答有沒有連外網：None＝沒有；有的話記 {"query": 送出去的關鍵字, "sources": [{"title", "url"}]}
    web_search: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # 使用者這一則附的圖片（編號清單；檔案在主機的 uploads/chat-images/，見 services/chat_images.py）；沒附是 None
    images: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    # AI 這一題自己做了哪些步驟：[{"tool": 工具名稱, "summary": 給人看的一句話, "ok": 有沒有成功}]；沒用工具是 None
    steps: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    # 使用者評分 (1-5)
    rating: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # B2: 審計 Hash 鏈 — 不可否認性
    # content_hash = sha256(prev_hash || role || content || created_at_iso)
    # 任何事後竄改都會導致鏈斷裂，可供合規稽核驗證
    content_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    prev_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    
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
