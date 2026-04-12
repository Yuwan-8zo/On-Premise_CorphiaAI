"""
Corphia AI Platform - FastAPI 主應用程式

企業級私有部署 AI 問答系統
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from app.core.config import settings
from app.core.database import init_db, close_db
from app.api import (
    auth_router,
    conversations_router,
    health_router,
    documents_router,
    messages_router,
    websocket_router,
    users_router,
    admin_router,
    audit_logs_router,
)
from app.services.llm_service import get_llm_service
from app.services.rag_service import get_rag_service


# 設定日誌
logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """應用程式生命週期管理"""
    # 啟動時執行
    logger.info(f"🚀 啟動 {settings.app_name} v2.2.0")
    await init_db()
    logger.info("✅ 資料庫初始化完成")
    
    # 初始化 LLM 和 RAG 服務
    llm_service = get_llm_service()
    await llm_service.initialize()
    
    rag_service = get_rag_service()
    await rag_service.initialize()
    
    yield
    
    # 關閉時執行
    await close_db()
    logger.info("👋 應用程式已關閉")


# 建立 FastAPI 應用程式
app = FastAPI(
    title=settings.app_name,
    description="企業級私有部署 AI 問答系統",
    version="2.2.0",
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    lifespan=lifespan,
)


# CORS 中間件（測試模式：允許所有來源）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 全域例外處理
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """驗證錯誤處理"""
    errors = []
    for error in exc.errors():
        errors.append({
            "field": ".".join(str(loc) for loc in error["loc"]),
            "message": error["msg"]
        })
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "請求資料驗證失敗",
                "details": errors
            }
        }
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """全域例外處理"""
    logger.error(f"未處理的例外: {exc}", exc_info=True)
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "伺服器內部錯誤",
                "details": []
            }
        }
    )


# 註冊路由
app.include_router(health_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(conversations_router, prefix="/api/v1")
app.include_router(documents_router, prefix="/api/v1")
app.include_router(messages_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")
app.include_router(audit_logs_router, prefix="/api/v1")
app.include_router(websocket_router)


# 根路徑
@app.get("/")
async def root():
    """API 根路徑"""
    return {
        "name": settings.app_name,
        "version": "2.2.0",
        "docs": "/docs" if settings.debug else None,
        "status": "running"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug
    )
