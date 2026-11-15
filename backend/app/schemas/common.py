"""
通用 Schemas
"""

from typing import Any, Optional, List
from pydantic import BaseModel

from app.services.password_service import validate_password_strength


# ── 共用欄位檢查（註冊、改密碼、管理員建立／編輯帳號都用同一套） ──

def validate_email_like(value: str) -> str:
    """一般信箱和本機帳號（例如 admin@local）都接受；要有 @ 前後內容、不能有空白"""
    local_part, separator, domain_part = value.partition("@")
    if (
        not separator
        or not local_part
        or not domain_part
        or any(ch.isspace() for ch in value)
    ):
        raise ValueError("invalid email format")
    return value


def require_strong_password(value: str) -> str:
    """密碼政策（長度、大小寫、數字、特殊字元）；不符合就丟出所有原因"""
    errors = validate_password_strength(value)
    if errors:
        raise ValueError("; ".join(errors))
    return value


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
    llm: str = "loading"
    rag: str = "loading"
    # Per-model load status (name, size_gb, state, is_current, started_at, finished_at, error)
    models: list[dict] = []
