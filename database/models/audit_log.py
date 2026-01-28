"""
å¯©è??¥è?æ¨¡å?
"""

import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, Text, func
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column

from database.connection import Base


class AuditLog(Base):
    """å¯©è??¥è?è³‡æ?è¡?""
    
    __tablename__ = "audit_logs"
    
    # ä¸»éµ
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    
    # ?ä???
    user_id: Mapped[str] = mapped_column(String(36), nullable=True)
    user_email: Mapped[str] = mapped_column(String(255), nullable=True)
    
    # ç§Ÿæˆ¶
    tenant_id: Mapped[str] = mapped_column(String(36), nullable=True)
    
    # ?ä?è³‡è?
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(50), nullable=False)
    resource_id: Mapped[str] = mapped_column(String(36), nullable=True)
    
    # è©³ç´°è³‡è?
    description: Mapped[str] = mapped_column(Text, nullable=True)
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    
    # è«‹æ?è³‡è?
    ip_address: Mapped[str] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str] = mapped_column(Text, nullable=True)
    
    # ?‚é???
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=func.now(),
        nullable=False
    )
    
    def __repr__(self) -> str:
        return f"<AuditLog(id={self.id}, action={self.action})>"
