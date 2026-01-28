"""
通用 Schemas
"""

from typing import Any, Optional, List
from pydantic import BaseModel


class ApiResponse(BaseModel):
    """通用 API 回應"""
    data: Any = None
    message: str = "操作成功"


class ErrorDetail(BaseModel):
    """錯誤詳情"""
    field: Optional[str] = None
    message: str


class ErrorResponse(BaseModel):
    """錯誤回應"""
    code: str
    message: str
    details: List[ErrorDetail] = []


class PaginationParams(BaseModel):
    """分頁參數"""
    page: int = 1
    page_size: int = 20


class Pagination(BaseModel):
    """分頁資訊"""
    page: int
    page_size: int
    total: int
    total_pages: int


class HealthResponse(BaseModel):
    """健康檢查回應"""
    status: str = "ok"
    version: str
    database: str = "connected"
    llm: str = "ready"
