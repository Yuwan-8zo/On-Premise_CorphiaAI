"""
AI 產出的檔案（Word、Excel、簡報）：檔案本體在伺服器的 generated_files_dir，這裡記是誰的、掛在哪則訊息下面

只有產生它的人可以下載。訊息或對話刪掉時這一列跟著刪（檔案本體由 services/generated_files.cleanup_orphans 清）。
"""

import uuid
from typing import Optional

from sqlalchemy import BigInteger, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, TimestampMixin


class GeneratedFile(TimestampMixin, Base):
    __tablename__ = "generated_files"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    tenant_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    conversation_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=True)
    message_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("messages.id", ondelete="CASCADE"), index=True, nullable=True)
    # docx／xlsx／pptx
    kind: Mapped[str] = mapped_column(String(10), nullable=False)
    # 給使用者看的檔名（下載時用）；磁碟上的檔名是 id，不會有奇怪字元或重名
    filename: Mapped[str] = mapped_column(String(200), nullable=False)
    size: Mapped[int] = mapped_column(BigInteger, default=0)
