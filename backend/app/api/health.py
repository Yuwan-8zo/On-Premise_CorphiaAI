"""
健康檢查 API
"""

from fastapi import APIRouter

from app.schemas.common import HealthResponse
from app.services.boot_service import build_health_payload

router = APIRouter(tags=["系統"])


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    健康檢查端點。

    - status=ok：API 與資料庫已就緒（前端可進登入頁）
    - llm/rag：loading | ready | unavailable | error（背景預熱進度）
    """
    return HealthResponse(**build_health_payload())


@router.get("/")
async def root():
    """API 根路徑"""
    return {
        "name": "Corphia AI",
        "version": "2.3.0",
        "status": "running",
    }
