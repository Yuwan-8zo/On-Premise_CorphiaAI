"""
審計日誌模型
"""

import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, Text, func
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AuditLog(Base):
    """審計日誌資料表"""
    
    __tablename__ = "audit_logs"
    
    # 主鍵
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    
    # 操作者
    user_id: Mapped[str] = mapped_column(String(36), nullable=True, index=True)
    user_email: Mapped[str] = mapped_column(String(255), nullable=True, index=True)
    
    # 租戶
    tenant_id: Mapped[str] = mapped_column(String(36), nullable=True, index=True)
    
    # 操作資訊
    action: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    resource_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    resource_id: Mapped[str] = mapped_column(String(36), nullable=True, index=True)
    
    # 詳細資訊
    description: Mapped[str] = mapped_column(Text, nullable=True)
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    
    # 請求資訊
    ip_address: Mapped[str] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str] = mapped_column(Text, nullable=True)
    
    # 時間戳
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=func.now(),
        nullable=False,
        index=True
    )
    
    def __repr__(self) -> str:
        return f"<AuditLog(id={self.id}, action={self.action})>"
