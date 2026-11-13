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

from app.core import web_ui, win_accept_fix
from app.core.config import settings
from app.core.database import init_db, close_db
from app.core.version import APP_VERSION
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
    connected_folders_router,
    memories_router,
    files_router,
    desktop_router,
    system_monitor_router,
    voice_router,
    browser_folder_router,
    web_search_router,
)
from app.services.llm_service import get_llm_service
from app.core.rate_limiter import RateLimitMiddleware
from app.core.middleware import MaxUploadSizeMiddleware


from app.core.logging_config import setup_logging

# Windows：連線在接受時被中斷，後端不要從此停止接受新連線（見 app/core/win_accept_fix.py）
win_accept_fix.install()
setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """應用程式生命週期管理"""
    # 啟動時執行
    logger.info(f"啟動 {settings.app_name} v2.3.0")
    await init_db()
    logger.info("資料庫初始化完成")

    # AI 產出的檔案：訊息、對話被刪掉後留在磁碟上的，啟動時清掉
    try:
        from app.core.database import async_session_maker
        from app.services.generated_files import cleanup_orphans
        async with async_session_maker() as _db:
            removed = await cleanup_orphans(_db)
        if removed:
            logger.info(f"已清掉 {removed} 個沒有紀錄的 AI 產出檔案")
    except Exception as e:
        logger.warning(f"清理 AI 產出檔案失敗（可忽略）: {e}")
    
    # NOTE: SECRET_KEY 的安全檢查已移到 app.core.config.Settings 的 model_validator，
    # 在這裡的好處是「載 Settings() 那一刻」就會拋錯，比 lifespan 啟動更早。
    # 這裡保留 informational log 讓部署時看到目前環境設定。
    logger.info(
        "環境設定: app_env=%s, debug=%s, secret_key 長度=%d",
        settings.app_env, settings.debug, len(settings.secret_key),
    )
    
    # 清理過期的 Token 黑名單記錄
    try:
        from app.core.database import async_session_maker
        from app.services.token_service import cleanup_expired_blacklist
        async with async_session_maker() as session:
            count = await cleanup_expired_blacklist(session)
            if count > 0:
                logger.info(f"已清理 {count} 筆過期的 Token 黑名單記錄")
    except Exception as e:
        logger.warning(f"Token 黑名單清理失敗（可忽略）: {e}")

    # FIX: 清理上一輪 session 留下的「孤兒 ngrok process」。
    # 場景：使用者上次直接 Ctrl+C 結束 start.py，ngrok 是 detached subprocess
    # 不會被殺掉。下次啟動 backend，新 session 的 ngrok 預設應該是「關閉」狀態，
    # 但 query_ngrok_state() 會發現舊 ngrok 還在 4040 port 上 → 回報 active=true
    # → admin 進去看 ngrok widget 顯示「已啟動」（跟使用者的「預設關閉」期望不符）。
    #
    # 啟動時主動殺掉所有 ngrok process，並把 .runtime/ngrok.json 寫成 inactive。
    # 系統不提供公開連結（手機一律走區域網路），所以開機時一律關掉。
    try:
        from app.services.ngrok_service import (
            stop_ngrok_processes,
            write_ngrok_runtime,
            NgrokState,
        )
        stop_ngrok_processes()
        write_ngrok_runtime(NgrokState.inactive(source="backend_boot"))
        logger.info("已清理孤兒 ngrok process（如有）")
    except Exception as e:
        logger.warning(f"ngrok 啟動清理失敗（可忽略）: {e}")
    
    from app.services.boot_service import mark_api_ready, start_background_warmup

    mark_api_ready()
    start_background_warmup()
    logger.info("API 已就緒；LLM/RAG 於背景預熱中")

    # 連接資料夾：背景排程掃描、建立索引（等文件檢索模型載入好才開始）
    import asyncio

    from app.services.folder_indexer import folder_scan_loop
    folder_task = asyncio.create_task(folder_scan_loop())

    llm_service = get_llm_service()

    yield

    # 關閉時執行
    folder_task.cancel()
    try:
        close_client = getattr(llm_service.client, "aclose", None)
        if close_client is not None:
            await close_client()
            logger.info("LLM client 已正確關閉")
    except Exception as e:
        logger.warning(f"關閉 LLM client 時發生錯誤（可忽略）: {e}")
    # 推論引擎（llama-server 子行程）：跟著後端一起關，不然會一直佔著記憶體
    try:
        await llm_service.shutdown()
    except Exception as e:
        logger.warning(f"關閉推論引擎時發生錯誤: {e}")
    
    await close_db()
    logger.info("應用程式已關閉")


# 建立 FastAPI 應用程式
app = FastAPI(
    title=settings.app_name,
    description="企業級私有部署 AI 問答系統",
    version=APP_VERSION,
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

# 由後端直接提供介面時（start.py --built、桌面版）：後端聽所有網路介面，區網門檢要放在最外層（最後加的在最外面）
if web_ui.enabled():
    app.add_middleware(web_ui.LanGate)

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
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
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
    import traceback
    from app.core.time_utils import utc_now_iso

    from app.core.api_response import new_error_id
    error_id = new_error_id()
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
app.include_router(connected_folders_router, prefix="/api/v1")
app.include_router(memories_router, prefix="/api/v1")
app.include_router(files_router, prefix="/api/v1")
app.include_router(desktop_router, prefix="/api/v1")
app.include_router(system_monitor_router, prefix="/api/v1")
app.include_router(voice_router, prefix="/api/v1")
app.include_router(browser_folder_router, prefix="/api/v1")
app.include_router(web_search_router, prefix="/api/v1")
app.include_router(websocket_router)


if web_ui.enabled():
    # 介面（打包好的前端）：一定要在所有 API 路徑之後掛，最後那條什麼路徑都接
    web_ui.install(app)
else:
    # 根路徑
    @app.get("/")
    async def root():
        """API 根路徑"""
        return {
            "name": settings.app_name,
            "version": APP_VERSION,
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
