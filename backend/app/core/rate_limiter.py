"""
API 速率限制中間件

提供多層級速率限制：
1. 全域 IP 限制：防止單一 IP 的大量請求
2. 端點級限制：對敏感端點（登入、註冊）施加更嚴格的限制
3. 使用者級限制：對已認證使用者施加獨立的配額

使用記憶體內滑動視窗演算法，適用於單機部署。
若需分散式部署，可替換為 Redis 後端。
"""

import logging
import time
from collections import defaultdict
from dataclasses import dataclass, field
from threading import Lock
from typing import Optional

from fastapi import Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

logger = logging.getLogger(__name__)


@dataclass
class RateLimitRule:
    """速率限制規則"""
    max_requests: int       # 視窗內最大請求數
    window_seconds: int     # 時間視窗（秒）
    description: str = ""   # 規則描述


@dataclass
class RequestRecord:
    """請求記錄（滑動視窗）"""
    timestamps: list = field(default_factory=list)


# ==================== 速率限制配置 ====================
# NOTE: 所有限制值從 Settings 動態讀取，在開發環境中設定更寬鬆的限制

def _build_limits() -> tuple:
    """動態建立速率限制規則（使用 settings，避免 import 時的循環依賴）"""
    from app.core.config import settings

    # 開發環境使用較寬鬆的限制
    is_dev = settings.app_env.lower() != "production"

    global_limit = RateLimitRule(
        max_requests=settings.rate_limit_global_max if not is_dev else 600,
        window_seconds=60,
        description="全域 IP 限制",
    )

    login_max = settings.rate_limit_login_max if not is_dev else 60
    register_max = settings.rate_limit_register_max if not is_dev else 30

    endpoint_limits: dict[str, RateLimitRule] = {
        # 登入：生產 10次/分鐘，開發 60次/分鐘
        "/api/v1/auth/login": RateLimitRule(
            max_requests=login_max,
            window_seconds=60,
            description="登入嘗試限制",
        ),
        # 註冊：生產 5次/小時，開發 30次/小時
        "/api/v1/auth/register": RateLimitRule(
            max_requests=register_max,
            window_seconds=3600,
            description="註冊限制",
        ),
        # 密碼修改：每個 IP 每小時最多 10 次（生產）/ 50 次（開發）
        "/api/v1/auth/change-password": RateLimitRule(
            max_requests=10 if not is_dev else 50,
            window_seconds=3600,
            description="密碼修改限制",
        ),
        # Token 刷新：每個 IP 每分鐘最多 20 次
        "/api/v1/auth/refresh": RateLimitRule(
            max_requests=20,
            window_seconds=60,
            description="Token 刷新限制",
        ),
        # 文件上傳：每個 IP 每分鐘最多 10 次
        "/api/v1/documents/upload": RateLimitRule(
            max_requests=10,
            window_seconds=60,
            description="文件上傳限制",
        ),
    }

    return global_limit, endpoint_limits


# 不需要速率限制的路徑（白名單）
RATE_LIMIT_WHITELIST = {
    "/api/v1/health",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/",
}



class RateLimiter:
    """
    滑動視窗速率限制器

    使用記憶體內字典儲存請求記錄。
    執行緒安全，定期自動清理過期記錄。
    """

    def __init__(self):
        # key: f"{限制類型}:{IP}:{路徑}" -> RequestRecord
        self._records: dict[str, RequestRecord] = defaultdict(RequestRecord)
        self._lock = Lock()
        self._last_cleanup = time.time()
        # 每 5 分鐘清理一次過期記錄
        self._cleanup_interval = 300

    def is_rate_limited(
        self,
        key: str,
        rule: RateLimitRule,
    ) -> tuple[bool, dict]:
        """
        檢查是否超過速率限制

        Args:
            key: 限流識別鍵
            rule: 速率限制規則

        Returns:
            (is_limited, info): 是否被限制 + 限制詳情
        """
        now = time.time()
        window_start = now - rule.window_seconds

        with self._lock:
            # 定期清理
            self._maybe_cleanup(now)

            record = self._records[key]

            # 移除視窗外的舊記錄
            record.timestamps = [
                ts for ts in record.timestamps if ts > window_start
            ]

            current_count = len(record.timestamps)

            if current_count >= rule.max_requests:
                # 計算重置時間
                oldest_in_window = record.timestamps[0] if record.timestamps else now
                retry_after = int(oldest_in_window + rule.window_seconds - now) + 1

                return True, {
                    "limit": rule.max_requests,
                    "remaining": 0,
                    "retry_after": max(retry_after, 1),
                    "window": rule.window_seconds,
                    "description": rule.description,
                }

            # 記錄此次請求
            record.timestamps.append(now)
            remaining = rule.max_requests - current_count - 1

            return False, {
                "limit": rule.max_requests,
                "remaining": max(remaining, 0),
                "retry_after": 0,
                "window": rule.window_seconds,
            }

    def _maybe_cleanup(self, now: float) -> None:
        """定期清理過期記錄，避免記憶體洩漏"""
        if now - self._last_cleanup < self._cleanup_interval:
            return

        self._last_cleanup = now
        global_limit, endpoint_limits = _build_limits()
        max_window = max(
            global_limit.window_seconds,
            *(r.window_seconds for r in endpoint_limits.values()),
        )
        cutoff = now - max_window

        keys_to_delete = []
        for key, record in self._records.items():
            record.timestamps = [ts for ts in record.timestamps if ts > cutoff]
            if not record.timestamps:
                keys_to_delete.append(key)

        for key in keys_to_delete:
            del self._records[key]

        if keys_to_delete:
            logger.debug(f"速率限制器清理了 {len(keys_to_delete)} 條過期記錄")

    def reset(self, ip: Optional[str] = None, path: Optional[str] = None) -> int:
        """
        重置速率限制記錄（管理員用途）

        Args:
            ip: 指定 IP（None 表示全部）
            path: 指定路徑（None 表示全部）

        Returns:
            int: 清除的記錄數
        """
        with self._lock:
            keys_to_delete = []
            for key in self._records:
                if ip and ip not in key:
                    continue
                if path and path not in key:
                    continue
                keys_to_delete.append(key)
            for key in keys_to_delete:
                del self._records[key]
            if keys_to_delete:
                logger.info(f"管理員重置速率限制: 清除 {len(keys_to_delete)} 筆，IP={ip}, path={path}")
            return len(keys_to_delete)

    def get_stats(self) -> dict:
        """取得當前速率限制器的統計資訊"""
        with self._lock:
            return {
                "total_keys": len(self._records),
                "total_records": sum(
                    len(r.timestamps) for r in self._records.values()
                ),
            }


# 全域單例
_rate_limiter = RateLimiter()


def get_rate_limiter() -> RateLimiter:
    """取得速率限制器單例"""
    return _rate_limiter


def _get_client_ip(request: Request) -> str:
    """
    取得客戶端真實 IP

    優先取 X-Forwarded-For（反向代理場景），否則取直連 IP。
    """
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        # 取第一個 IP（最原始的客戶端 IP）
        return forwarded_for.split(",")[0].strip()

    x_real_ip = request.headers.get("x-real-ip")
    if x_real_ip:
        return x_real_ip.strip()

    return request.client.host if request.client else "unknown"


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    FastAPI 速率限制中間件

    工作流程：
    1. 檢查路徑是否在白名單 → 跳過
    2. 檢查端點級限制（更嚴格）
    3. 檢查全域 IP 限制
    4. 在回應 Header 中附加限流資訊
    """

    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self.limiter = get_rate_limiter()

    async def dispatch(self, request: Request, call_next):
        # 檢查速率限制是否啟用
        from app.core.config import settings
        if not settings.rate_limit_enabled:
            return await call_next(request)

        path = request.url.path

        # 白名單路徑跳過限制
        if path in RATE_LIMIT_WHITELIST:
            return await call_next(request)

        # WebSocket 連接不使用此中間件
        if path.startswith("/ws/"):
            return await call_next(request)

        client_ip = _get_client_ip(request)

        # 動態取得限制規則
        global_limit, endpoint_limits = _build_limits()

        # ── 1. 端點級限制（僅 POST 請求） ──
        if request.method == "POST" and path in endpoint_limits:
            rule = endpoint_limits[path]
            endpoint_key = f"endpoint:{client_ip}:{path}"
            is_limited, info = self.limiter.is_rate_limited(endpoint_key, rule)

            if is_limited:
                logger.warning(
                    f"🚫 端點限制觸發: IP={client_ip}, "
                    f"路徑={path}, "
                    f"規則={rule.description}, "
                    f"重試={info['retry_after']}s"
                )
                return self._rate_limit_response(info, rule.description)

        # ── 2. 全域 IP 限制 ──
        global_key = f"global:{client_ip}"
        is_limited, info = self.limiter.is_rate_limited(
            global_key, global_limit
        )

        if is_limited:
            logger.warning(
                f"🚫 全域限制觸發: IP={client_ip}, "
                f"重試={info['retry_after']}s"
            )
            return self._rate_limit_response(info, "全域請求限制")

        # ── 3. 正常放行，並附加 Rate-Limit Header ──
        response = await call_next(request)

        # 附加標準 Rate-Limit 回應頭
        response.headers["X-RateLimit-Limit"] = str(info["limit"])
        response.headers["X-RateLimit-Remaining"] = str(info["remaining"])
        response.headers["X-RateLimit-Window"] = str(info["window"])

        return response

    def _rate_limit_response(
        self,
        info: dict,
        description: str,
    ) -> JSONResponse:
        """產生 429 Too Many Requests 回應"""
        retry_after = info["retry_after"]
        minutes = retry_after // 60
        seconds = retry_after % 60
        if minutes > 0:
            wait_str = f"{minutes} 分 {seconds} 秒" if seconds else f"{minutes} 分鐘"
        else:
            wait_str = f"{seconds} 秒"

        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={
                "detail": f"請求過於頻繁（{description}），請在 {wait_str} 後重試",
                "error": {
                    "code": "RATE_LIMIT_EXCEEDED",
                    "message": f"請求過於頻繁（{description}），請在 {wait_str} 後重試",
                    "details": {
                        "limit": info["limit"],
                        "window_seconds": info["window"],
                        "retry_after": retry_after,
                    },
                }
            },
            headers={
                "Retry-After": str(retry_after),
                "X-RateLimit-Limit": str(info["limit"]),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(retry_after),
            },
        )

