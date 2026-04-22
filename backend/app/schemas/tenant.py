"""
租戶 (Tenant) Pydantic Schemas
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

from app.schemas.jsonb import SafeJsonDict


class TenantBase(BaseModel):
    name: str = Field(..., max_length=100, description="租戶名稱")
    slug: str = Field(..., max_length=50, description="租戶唯一識別碼(URL用)")
    description: Optional[str] = Field(None, description="租戶描述")
    settings: SafeJsonDict = Field(default_factory=dict, description="租戶設定 (JSONB，受大小與深度限制)")
    is_active: bool = Field(True, description="是否啟用")


class TenantCreate(TenantBase):
    pass


class TenantUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    slug: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    settings: SafeJsonDict = None
    is_active: Optional[bool] = None


class TenantResponse(TenantBase):
    id: str = Field(..., description="租戶 ID")
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class TenantListResponse(BaseModel):
    data: List[TenantResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
