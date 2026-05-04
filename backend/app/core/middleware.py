"""
核心 Middlewares

此模組包含所有的客製化中介層 (Middlewares) 
例如檔案上傳大小限制 (MaxUploadSizeMiddleware) 
"""

import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from fastapi import status

from app.core.config import settings

logger = logging.getLogger(__name__)

class MaxUploadSizeMiddleware(BaseHTTPMiddleware):
    """
    攔截與限制 Request 的主體大小 (Max Upload Size)
    主要用於保護伺服器不被過大的上傳檔案或 Payload 塞爆記憶體
    """
    
    def __init__(self, app, max_upload_size: int):
        super().__init__(app)
        self.max_upload_size = max_upload_size

    async def dispatch(self, request: Request, call_next):
        if request.method in ["POST", "PUT", "PATCH"]:
            content_length = request.headers.get("content-length")
            if content_length:
                try:
                    content_length = int(content_length)
                    if content_length < 0:
                        # FIX: 負數 content-length（HTTP 規範禁止但 client 可能塞）
                        # 應該直接拒絕，否則會被視為「沒設」繞過上限檢查
                        return JSONResponse(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            content={"error": {"code": "INVALID_CONTENT_LENGTH", "message": "Content-Length 不可為負"}},
                        )
                    if content_length > self.max_upload_size:
                        # FIX: request.client 可能為 None（少見但 ASGI 規範允許）
                        # 直接 .host 會 AttributeError，包在三元裡安全取 IP
                        client_ip = request.client.host if request.client else "unknown"
                        logger.warning(
                            "攔截到過大的請求體: %d bytes (上限: %d bytes). 來源 IP: %s, Path: %s",
                            content_length, self.max_upload_size, client_ip, request.url.path,
                        )
                        return JSONResponse(
                            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            content={
                                "error": {
                                    "code": "PAYLOAD_TOO_LARGE",
                                    "message": f"請求體過大，上限為 {self.max_upload_size // (1024 * 1024)} MB",
                                    "details": []
                                }
                            }
                        )
                except ValueError:
                    # content-length 不是合法整數 → 拒絕，避免 chunked 攻擊繞過
                    return JSONResponse(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        content={"error": {"code": "INVALID_CONTENT_LENGTH", "message": "Content-Length header 格式錯誤"}},
                    )
            # NOTE: chunked transfer encoding（沒 content-length）仍可能繞過此檢查。
            # 真正的防線是 ASGI server（uvicorn）+ Nginx limit_request_size 設定。
            # 應用層只能盡力而為。

        return await call_next(request)
