"""連接資料夾的 API 資料格式"""

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

WriteMode = Literal["read_only", "output", "approve"]
Role = Literal["user", "admin", "engineer"]
# 自動更新的間隔只給幾個固定選項（分鐘），避免設太短拖慢伺服器
SCAN_INTERVALS = (5, 10, 30, 60, 360, 1440)


class ConnectedFolderBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    path: str = Field(..., min_length=1, max_length=1000)
    description: Optional[str] = Field(None, max_length=500)
    allowed_roles: List[Role] = Field(default_factory=lambda: ["user", "admin"], min_length=1)
    write_mode: WriteMode = "output"
    include_subfolders: bool = True
    scan_interval_min: int = Field(10)
    is_enabled: bool = True


class ConnectedFolderCreate(ConnectedFolderBase):
    pass


class ConnectedFolderUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    path: Optional[str] = Field(None, min_length=1, max_length=1000)
    description: Optional[str] = Field(None, max_length=500)
    allowed_roles: Optional[List[Role]] = Field(None, min_length=1)
    write_mode: Optional[WriteMode] = None
    include_subfolders: Optional[bool] = None
    scan_interval_min: Optional[int] = None
    is_enabled: Optional[bool] = None


class ConnectedFolderResponse(ConnectedFolderBase):
    id: str
    tenant_id: str
    status: str
    file_count: int
    total_bytes: int
    last_scan_at: Optional[datetime] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FolderCheckRequest(BaseModel):
    path: str = Field(..., min_length=1, max_length=1000)
    include_subfolders: bool = True


class FolderCheckResponse(BaseModel):
    ok: bool
    message: Optional[str] = None
    path: Optional[str] = None
    file_count: int = 0
    total_bytes: int = 0
    by_type: dict = Field(default_factory=dict)
    unsupported_count: int = 0
    skipped_sensitive: int = 0
    samples: List[str] = Field(default_factory=list)
    truncated: bool = False


class BrowseEntry(BaseModel):
    name: str
    path: str


class BrowseResponse(BaseModel):
    path: Optional[str] = None
    parent: Optional[str] = None
    dirs: List[BrowseEntry]
