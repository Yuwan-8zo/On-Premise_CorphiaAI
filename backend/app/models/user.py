"""
使用者模型

支援三層 RBAC: Engineer / Admin / User
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import String, Boolean, DateTime, ForeignKey, func
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.tenant import Tenant
    from app.models.conversation import Conversation
    from app.models.document import Document
    from app.models.user_settings import UserSettings


class UserRole(str, Enum):
    """使用者角色"""
    ENGINEER = "engineer"  # 系統管理員，可管理所有租戶
    ADMIN = "admin"        # 租戶管理員，可管理自己租戶
    USER = "user"          # 一般使用者


class User(Base):
    """使用者資料表"""
    
    __tablename__ = "users"
    
    # 主鍵
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    
    # 租戶 (Engineer 可為 None)
    tenant_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=True
    )
    
    # 認證資訊
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    
    # 個人資訊
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    # 角色與狀態
    role: Mapped[str] = mapped_column(
        String(20),
        default=UserRole.USER.value,
        nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # 登入記錄
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Token 撤銷時間戳（用於批量撤銷使用者所有 Token）
    # 所有在此時間之前發放的 Token 都會被視為無效
    token_revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # 時間戳
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
    
    # 關聯
    tenant: Mapped[Optional["Tenant"]] = relationship(
        "Tenant",
        back_populates="users"
    )
    conversations: Mapped[List["Conversation"]] = relationship(
        "Conversation",
        back_populates="user",
        cascade="all, delete-orphan"
    )
    documents: Mapped[List["Document"]] = relationship(
        "Document",
        back_populates="uploaded_by_user",
        cascade="all, delete-orphan"
    )
    settings: Mapped[Optional["UserSettings"]] = relationship(
        "UserSettings",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan"
    )
    
    @property
    def is_engineer(self) -> bool:
        """是否為系統管理員"""
        return self.role == UserRole.ENGINEER.value
    
    @property
    def is_admin(self) -> bool:
        """是否為租戶管理員"""
        return self.role == UserRole.ADMIN.value
    
    @property
    def is_user(self) -> bool:
        """是否為一般使用者"""
        return self.role == UserRole.USER.value
    
    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email}, role={self.role})>"
