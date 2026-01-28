"""
ä½¿ç”¨??Schemas
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field

from database.models.user import UserRole


class UserBase(BaseModel):
    """ä½¿ç”¨?…åŸºç¤?Schema"""
    email: EmailStr
    name: str = Field(..., min_length=1, max_length=100)


class UserCreate(UserBase):
    """å»ºç?ä½¿ç”¨??Schema"""
    password: str = Field(..., min_length=6)
    role: str = UserRole.USER.value
    tenant_id: Optional[str] = None


class UserUpdate(BaseModel):
    """?´æ–°ä½¿ç”¨??Schema"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    avatar_url: Optional[str] = None
    is_active: Optional[bool] = None


class UserResponse(UserBase):
    """ä½¿ç”¨?…å???Schema"""
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
    """ä½¿ç”¨?…å?è¡¨å???""
    data: list[UserResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

