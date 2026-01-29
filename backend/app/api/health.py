"""
?¥åº·æª¢æŸ¥ API
"""

from fastapi import APIRouter

from app.core.config import settings
from app.schemas.common import HealthResponse

router = APIRouter(tags=["ç³»çµ±"])


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    ?¥åº·æª¢æŸ¥ç«¯é?
    
    ?žå‚³ç³»çµ±?‹è??€??
    """
    return HealthResponse(
        status="ok",
        version="2.2.0",
        database="connected",
        llm="ready"
    )


@router.get("/")
async def root():
    """API ?¹è·¯å¾?""
    return {
        "name": settings.app_name,
        "version": "2.2.0",
        "status": "running"
    }
