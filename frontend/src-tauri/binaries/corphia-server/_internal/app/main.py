"""
Corphia AI Platform - FastAPI 主應用程式

企業級私有部署 AI 問答系統
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
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
    admin_replay_router,
    audit_logs_router,
    tenants_router,
    models_router,
    folders_router,
    system_monitor_router,
    voice_router,
)
from app.services.llm_service import get_llm_service
from app.services.rag_service import get_rag_service
from app.core.rate_limiter import RateLimitMiddleware
from app.core.middleware import MaxUploadSizeMiddleware


from app.core.logging_config import setup_logging
setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """應用程式生命週期管理"""
    # 啟動時執行
    logger.info(f"🚀 啟動 {settings.app_name} v2.3.0")
    await init_db()
    logger.info("✅ 資料庫初始化完成")
    
    # NOTE: SECRET_KEY 的安全檢查已移到 app.core.config.Settings 的 model_validator，
    # 在這裡的好處是「載 Settings() 那一刻」就會拋錯，比 lifespan 啟動更早。
    # 這裡保留 informational log 讓部署時看到目前環境設定。
    logger.info(
        "🔧 環境設定: app_env=%s, debug=%s, secret_key 長度=%d",
        settings.app_env, settings.debug, len(settings.secret_key),
    )
    
    # 清理過期的 Token 黑名單記錄
    try:
        from app.core.database import async_session_maker
        from app.services.token_service import cleanup_expired_blacklist
        async with async_session_maker() as session:
            count = await cleanup_expired_blacklist(session)
            if count > 0:
                logger.info(f"🧹 已清理 {count} 筆過期的 Token 黑名單記錄")
    except Exception as e:
        logger.warning(f"Token 黑名單清理失敗（可忽略）: {e}")

    # FIX: 清理上一輪 session 留下的「孤兒 ngrok process」。
    # 場景：使用者上次直接 Ctrl+C 結束 start.py，ngrok 是 detached subprocess
    # 不會被殺掉。下次啟動 backend，新 session 的 ngrok 預設應該是「關閉」狀態，
    # 但 query_ngrok_state() 會發現舊 ngrok 還在 4040 port 上 → 回報 active=true
    # → admin 進去看 ngrok widget 顯示「已啟動」（跟使用者的「預設關閉」期望不符）。
    #
    # 啟動時主動殺掉所有 ngrok process，並把 .runtime/ngrok.json 寫成 inactive。
    # 使用者要開公開連結就走 admin 後台 toggle，明確 opt-in。
    try:
        from app.services.ngrok_service import (
            stop_ngrok_processes,
            write_ngrok_runtime,
            NgrokState,
        )
        stop_ngrok_processes()
        write_ngrok_runtime(NgrokState.inactive(source="backend_boot"))
        logger.info("🧹 已清理孤兒 ngrok process（如有）")
    except Exception as e:
        logger.warning(f"ngrok 啟動清理失敗（可忽略）: {e}")
    
    # 初始化 LLM 和 RAG 服務
    llm_service = get_llm_service()
    await llm_service.initialize()
    
    rag_service = get_rag_service()
    await rag_service.initialize()
    
    yield
    
    # 關閉時執行
    try:
        close_client = getattr(llm_service.client, "aclose", None)
        if close_client is not None:
            await close_client()
            logger.info("✅ LLM client 已正確關閉")
    except Exception as e:
        logger.warning(f"關閉 LLM client 時發生錯誤（可忽略）: {e}")
    
    await close_db()
    logger.info("👋 應用程式已關閉")


# 建立 FastAPI 應用程式
app = FastAPI(
    title=settings.app_name,
    description="企業級私有部署 AI 問答系統",
    version="2.3.0",
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    lifespan=lifespan,
)


# CORS 中間件設定
if settings.app_env.lower() == "production":
    cors_allow_origins = settings.cors_origins_list
    cors_allow_credentials = True
else:
    cors_allow_origins = ["*"]
    cors_allow_credentials = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_allow_origins,
    allow_credentials=cors_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Window",
        "X-RateLimit-Reset",
        "Retry-After",
    ],
)

# 傳輸壓縮中間件
app.add_middleware(GZipMiddleware, minimum_size=1000)

# 速率限制中間件
app.add_middleware(RateLimitMiddleware)

# 上傳檔案大小限制中間件
app.add_middleware(MaxUploadSizeMiddleware, max_upload_size=settings.max_upload_size_mb * 1024 * 1024)

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
    """
    全域例外處理

    設計原則：
    - 永不對外暴露內部 exception 訊息、stack trace 或程式結構
    - 給每次例外配一組 error_id，使用者回報時可據此查日誌
    - 生產環境 (APP_ENV=production) 連 debug detail 都不給
    """
    import uuid
    import traceback
    from app.core.time_utils import utc_now_iso

    error_id = uuid.uuid4().hex[:12]
    logger.error(
        f"[ERROR_ID={error_id}] 未處理的例外 at {request.method} {request.url}: {exc}",
        exc_info=True,
    )

    # 寫一份到 crash.log（只給維運看，不對外）
    try:
        with open("crash.log", "a", encoding="utf-8") as f:
            f.write(f"\n\n{'=' * 60}\n")
            f.write(f"Error ID: {error_id}\n")
            f.write(f"Crash at: {utc_now_iso()}\n")
            f.write(f"Request:  {request.method} {request.url}\n")
            f.write(f"{'=' * 60}\n")
            f.write(traceback.format_exc())
    except Exception:
        # 寫檔失敗不能讓 exception handler 再拋例外
        pass

    # 對外的回應：在 debug 開啟時給錯誤類型協助除錯，否則只給 error_id
    payload = {
        "error": {
            "code": "INTERNAL_ERROR",
            "message": "伺服器發生錯誤，請回報給系統管理員",
            "error_id": error_id,
        }
    }
    if settings.debug:
        payload["error"]["type"] = type(exc).__name__

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=payload,
    )


# 註冊路由
app.include_router(health_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(conversations_router, prefix="/api/v1")
app.include_router(documents_router, prefix="/api/v1")
app.include_router(messages_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")
app.include_router(admin_replay_router, prefix="/api/v1")
app.include_router(audit_logs_router, prefix="/api/v1")
app.include_router(tenants_router, prefix="/api/v1")
app.include_router(models_router, prefix="/api/v1")
app.include_router(folders_router, prefix="/api/v1")
app.include_router(system_monitor_router, prefix="/api/v1")
app.include_router(voice_router, prefix="/api/v1")
app.include_router(websocket_router)


# 根路徑
@app.get("/")
async def root():
    """API 根路徑"""
    return {
        "name": settings.app_name,
        "version": "2.3.0",
        "docs": "/docs" if settings.debug else None,
        "status": "running"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8168,
        reload=settings.debug
    )
