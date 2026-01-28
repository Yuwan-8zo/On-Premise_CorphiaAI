"""
èªè? Schemas
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    """?»å…¥è«‹æ?"""
    email: EmailStr
    password: str = Field(..., min_length=6)


class LoginResponse(BaseModel):
    """?»å…¥?æ?"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(BaseModel):
    """?·æ–° Token è«‹æ?"""
    refresh_token: str


class TokenPayload(BaseModel):
    """Token è¼‰è·"""
    sub: str  # user_id
    exp: datetime
    type: str  # access / refresh


class RegisterRequest(BaseModel):
    """è¨»å?è«‹æ?"""
    email: EmailStr
    password: str = Field(..., min_length=6)
    name: str = Field(..., min_length=1, max_length=100)
    tenant_slug: Optional[str] = None  # ç§Ÿæˆ¶è­˜åˆ¥ç¢?


class PasswordChangeRequest(BaseModel):
    """è®Šæ›´å¯†ç¢¼è«‹æ?"""
    current_password: str
    new_password: str = Field(..., min_length=6)
