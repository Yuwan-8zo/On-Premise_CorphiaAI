"""
?šç”¨ Schemas
"""

from typing import Any, Optional, List
from pydantic import BaseModel


class ApiResponse(BaseModel):
    """?šç”¨ API ?æ?"""
    data: Any = None
    message: str = "?ä??å?"


class ErrorDetail(BaseModel):
    """?¯èª¤è©³æ?"""
    field: Optional[str] = None
    message: str


class ErrorResponse(BaseModel):
    """?¯èª¤?æ?"""
    code: str
    message: str
    details: List[ErrorDetail] = []


class PaginationParams(BaseModel):
    """?†é??ƒæ•¸"""
    page: int = 1
    page_size: int = 20


class Pagination(BaseModel):
    """?†é?è³‡è?"""
    page: int
    page_size: int
    total: int
    total_pages: int


class HealthResponse(BaseModel):
    """?¥åº·æª¢æŸ¥?æ?"""
    status: str = "ok"
    version: str
    database: str = "connected"
    llm: str = "ready"
