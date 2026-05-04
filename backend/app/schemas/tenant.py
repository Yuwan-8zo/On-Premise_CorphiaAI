"""
租戶 (Tenant) Pydantic Schemas
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator

from app.schemas.jsonb import SafeJsonDict


# slug 必須是小寫英數 + dash + underscore，禁止特殊字元、空白、中文等
# 因為 slug 會直接拼進 URL（/tenants/{slug}）跟可能被當路徑用
import re
_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,49}$")


def _validate_slug(v: Optional[str]) -> Optional[str]:
    if v is None:
        return v
    if not _SLUG_RE.match(v):
        raise ValueError(
            "slug 必須以小寫英數開頭，後續可包含小寫英數、底線、連字號，最長 50 字"
        )
    return v


class TenantBase(BaseModel):
    name: str = Field(..., max_length=100, description="租戶名稱")
    slug: str = Field(..., max_length=50, description="租戶唯一識別碼(URL用)")
    description: Optional[str] = Field(None, max_length=500, description="租戶描述")
    settings: SafeJsonDict = Field(default_factory=dict, description="租戶設定 (JSONB，受大小與深度限制)")
    is_active: bool = Field(True, description="是否啟用")

    @field_validator("slug")
    @classmethod
    def _check_slug(cls, v: str) -> str:
        result = _validate_slug(v)
        assert result is not None
        return result


class TenantCreate(TenantBase):
    pass


class TenantUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    slug: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = Field(None, max_length=500)
    settings: SafeJsonDict = None
    is_active: Optional[bool] = None

    @field_validator("slug")
    @classmethod
    def _check_slug(cls, v: Optional[str]) -> Optional[str]:
        return _validate_slug(v)


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
