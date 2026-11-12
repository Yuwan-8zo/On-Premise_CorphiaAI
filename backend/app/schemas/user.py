"""
使用者 Schemas
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.user import UserRole
from app.schemas.common import require_strong_password, validate_email_like


class UserBase(BaseModel):
    """使用者基礎 Schema"""
    email: str  # 允許非標準格式 (如 admin@local)
    name: str = Field(..., min_length=1, max_length=100)


class UserCreate(UserBase):
    """管理員建立使用者"""
    password: str = Field(..., min_length=8)
    # 只能是 engineer／admin／user，其他值直接 422
    role: UserRole = UserRole.USER
    is_active: bool = True
    tenant_id: Optional[str] = None

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        return validate_email_like(v.strip())

    @field_validator("password")
    @classmethod
    def _password(cls, v: str) -> str:
        return require_strong_password(v)


class UserUpdate(BaseModel):
    """更新使用者 Schema"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    avatar_url: Optional[str] = None
    is_active: Optional[bool] = None


class AdminUserUpdate(UserUpdate):
    """管理員編輯使用者：多了角色和重設密碼（沒填就不改）"""
    role: Optional[UserRole] = None
    password: Optional[str] = Field(None, min_length=8)

    @field_validator("password")
    @classmethod
    def _password(cls, v: Optional[str]) -> Optional[str]:
        return v if v is None else require_strong_password(v)


class UserResponse(UserBase):
    """使用者回應 Schema"""
    id: str
    role: str
    tenant_id: Optional[str] = None
    is_active: bool
    avatar_url: Optional[str] = None
    last_login_at: Optional[datetime] = None
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class UserListResponse(BaseModel):
    """使用者列表回應"""
    data: list[UserResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

