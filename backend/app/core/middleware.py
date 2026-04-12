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
                    if content_length > self.max_upload_size:
                        logger.warning(
                            f"⚠️ 攔截到過大的請求體: {content_length} bytes "
                            f"(上限: {self.max_upload_size} bytes). 來源 IP: {request.client.host}"
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
                    pass  # 如果 content-length 不合法，交由後續處理
                    
        return await call_next(request)
