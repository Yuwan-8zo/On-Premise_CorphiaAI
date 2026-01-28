"""
ä½¿ç”¨?…æ¨¡??

?¯æ´ä¸‰å±¤ RBAC: Engineer / Admin / User
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import String, Boolean, DateTime, ForeignKey, func
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.connection import Base

if TYPE_CHECKING:
    from database.models.tenant import Tenant
    from database.models.conversation import Conversation
    from database.models.document import Document
    from database.models.user_settings import UserSettings


class UserRole(str, Enum):
    """ä½¿ç”¨?…è???""
    ENGINEER = "engineer"  # ç³»çµ±ç®¡ç??¡ï??¯ç®¡?†æ??‰ç???
    ADMIN = "admin"        # ç§Ÿæˆ¶ç®¡ç??¡ï??¯ç®¡?†è‡ªå·±ç???
    USER = "user"          # ä¸€?¬ä½¿?¨è€?


class User(Base):
    """ä½¿ç”¨?…è??™è¡¨"""
    
    __tablename__ = "users"
    
    # ä¸»éµ
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    
    # ç§Ÿæˆ¶ (Engineer ?¯ç‚º None)
    tenant_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=True
    )
    
    # èªè?è³‡è?
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    
    # ?‹äººè³‡è?
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    # è§’è‰²?‡ç???
    role: Mapped[str] = mapped_column(
        String(20),
        default=UserRole.USER.value,
        nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # ?»å…¥è¨˜é?
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
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
        """?¯å¦?ºç³»çµ±ç®¡?†å“¡"""
        return self.role == UserRole.ENGINEER.value
    
    @property
    def is_admin(self) -> bool:
        """?¯å¦?ºç??¶ç®¡?†å“¡"""
        return self.role == UserRole.ADMIN.value
    
    @property
    def is_user(self) -> bool:
        """?¯å¦?ºä??¬ä½¿?¨è€?""
        return self.role == UserRole.USER.value
    
    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email}, role={self.role})>"
