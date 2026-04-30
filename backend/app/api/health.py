"""
健康檢查 API
"""

from fastapi import APIRouter

from app.core.config import settings
from app.schemas.common import HealthResponse

router = APIRouter(tags=["系統"])


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    健康檢查端點
    
    回傳系統運行狀態
    """
    return HealthResponse(
        status="ok",
        version="2.3.0",
        database="connected",
        llm="ready"
    )


@router.get("/")
async def root():
    """API 根路徑"""
    return {
        "name": settings.app_name,
        "version": "2.3.0",
        "status": "running"
    }
