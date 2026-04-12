"""
使用者 Schemas
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

from app.models.user import UserRole


class UserBase(BaseModel):
    """使用者基礎 Schema"""
    email: str  # 允許非標準格式 (如 admin@local)
    name: str = Field(..., min_length=1, max_length=100)


class UserCreate(UserBase):
    """建立使用者 Schema"""
    password: str = Field(..., min_length=8)
    role: str = UserRole.USER.value
    tenant_id: Optional[str] = None


class UserUpdate(BaseModel):
    """更新使用者 Schema"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    avatar_url: Optional[str] = None
    is_active: Optional[bool] = None


class UserResponse(UserBase):
    """使用者回應 Schema"""
    id: str
    role: str
    tenant_id: Optional[str] = None
    is_active: bool
    avatar_url: Optional[str] = None
    last_login_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    """使用者列表回應"""
    data: list[UserResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

