"""
認證 Schemas
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    """登入請求"""
    email: EmailStr
    password: str = Field(..., min_length=6)


class LoginResponse(BaseModel):
    """登入回應"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(BaseModel):
    """刷新 Token 請求"""
    refresh_token: str


class TokenPayload(BaseModel):
    """Token 載荷"""
    sub: str  # user_id
    exp: datetime
    type: str  # access / refresh


class RegisterRequest(BaseModel):
    """註冊請求"""
    email: EmailStr
    password: str = Field(..., min_length=6)
    name: str = Field(..., min_length=1, max_length=100)
    tenant_slug: Optional[str] = None  # 租戶識別碼


class PasswordChangeRequest(BaseModel):
    """變更密碼請求"""
    current_password: str
    new_password: str = Field(..., min_length=6)
