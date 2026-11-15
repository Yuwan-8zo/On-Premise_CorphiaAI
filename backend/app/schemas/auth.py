"""
認證 Schemas
"""

from typing import Optional
from pydantic import BaseModel, Field, field_validator

from app.schemas.common import require_strong_password, validate_email_like


class LoginRequest(BaseModel):
    """登入請求"""
    email: str  # 允許非標準格式 (如 admin@local)
    password: str = Field(..., min_length=1)

    @field_validator("email", "password", mode="before")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        if isinstance(v, str):
            return v.strip()
        return v

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, v: str) -> str:
        return validate_email_like(v)


class LoginResponse(BaseModel):
    """登入回應"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(BaseModel):
    """刷新 Token 請求"""
    refresh_token: str


class RegisterRequest(BaseModel):
    """註冊請求"""
    email: str  # 允許非標準格式 (如 admin@local)
    password: str = Field(..., min_length=8)
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    tenant_slug: Optional[str] = None

    @field_validator("email", mode="before")
    @classmethod
    def strip_email_whitespace(cls, v: str) -> str:
        if isinstance(v, str):
            return v.strip()
        return v

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, v: str) -> str:
        return validate_email_like(v)

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        """驗證密碼強度"""
        return require_strong_password(v)


class PasswordChangeRequest(BaseModel):
    """變更密碼請求"""
    current_password: str
    new_password: str = Field(..., min_length=8)

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        """驗證新密碼強度"""
        return require_strong_password(v)


class PasswordStrengthRequest(BaseModel):
    """密碼強度檢查請求"""
    password: str


class PasswordStrengthResponse(BaseModel):
    """密碼強度回應"""
    score: int
    level: str  # weak / medium / strong / very_strong
    errors: list[str]
    is_valid: bool
