"""
Token 黑名單模型

用於記錄已撤銷的 JWT Token，實現登出撤銷機制。
"""

import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TokenBlacklist(Base):
    """Token 黑名單資料表

    儲存已被撤銷的 Token JTI（JWT ID），用於：
    - 使用者登出時撤銷 Access / Refresh Token
    - 管理員強制踢出使用者
    - Token 刷新時撤銷舊 Token
    """

    __tablename__ = "token_blacklist"

    # 主鍵
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )

    # Token 的唯一識別碼（JWT ID）
    jti: Mapped[str] = mapped_column(
        String(36),
        unique=True,
        nullable=False,
        index=True,
    )

    # Token 類型（access / refresh）
    token_type: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        default="access",
    )

    # 被撤銷的使用者
    user_id: Mapped[str] = mapped_column(
        String(36),
        nullable=False,
        index=True,
    )

    # Token 過期時間（用於自動清理過期的黑名單記錄）
    expires_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
    )

    # 撤銷原因
    reason: Mapped[str] = mapped_column(
        String(100),
        nullable=True,
    )

    # 撤銷者（管理員強制踢出時記錄）
    revoked_by: Mapped[str] = mapped_column(
        String(36),
        nullable=True,
    )

    # 建立時間
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<TokenBlacklist(jti={self.jti}, user={self.user_id})>"
