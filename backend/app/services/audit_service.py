"""
審計日誌服務模組

提供統一的審計日誌寫入介面，用於記錄系統中所有關鍵操作。
"""

import logging
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog

logger = logging.getLogger(__name__)


# 操作類型常數
class AuditAction:
    """審計操作類型常數"""
    # 認證相關
    LOGIN_SUCCESS = "login_success"
    LOGIN_FAILED = "login_failed"
    LOGOUT = "logout"
    REGISTER = "register"
    TOKEN_REFRESH = "token_refresh"

    # 使用者管理
    USER_CREATE = "user_create"
    USER_UPDATE = "user_update"
    USER_DELETE = "user_delete"
    USER_ACTIVATE = "user_activate"
    USER_DEACTIVATE = "user_deactivate"

    # 對話管理
    CONVERSATION_CREATE = "conversation_create"
    CONVERSATION_UPDATE = "conversation_update"
    CONVERSATION_DELETE = "conversation_delete"

    # 文件管理
    DOCUMENT_UPLOAD = "document_upload"
    DOCUMENT_DELETE = "document_delete"
    DOCUMENT_METADATA_UPDATE = "document_metadata_update"

    # 模型管理
    MODEL_SELECT = "model_select"
    MODEL_REFRESH = "model_refresh"

    # Token 黑名單
    TOKEN_REVOKE = "token_revoke"
    USER_FORCE_LOGOUT = "user_force_logout"

    # 密碼安全
    PASSWORD_CHANGE_SUCCESS = "password_change_success"
    PASSWORD_CHANGE_FAILED = "password_change_failed"
    ACCOUNT_LOCKED = "account_locked"

    # 系統 / 公開連結（高敏感：把 server 暴露到 internet）
    NGROK_START = "ngrok_start"
    NGROK_STOP = "ngrok_stop"


# 資源類型常數
class AuditResource:
    """審計資源類型常數"""
    AUTH = "auth"
    USER = "user"
    CONVERSATION = "conversation"
    DOCUMENT = "document"
    MODEL = "model"
    SYSTEM = "system"


async def write_audit_log(
    db: AsyncSession,
    action: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    user_id: Optional[str] = None,
    user_email: Optional[str] = None,
    tenant_id: Optional[str] = None,
    description: Optional[str] = None,
    details: Optional[dict] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> AuditLog:
    """
    寫入審計日誌

    Args:
        db: 資料庫 Session
        action: 操作類型 (使用 AuditAction 常數)
        resource_type: 資源類型 (使用 AuditResource 常數)
        resource_id: 被操作的資源 ID
        user_id: 操作者 ID
        user_email: 操作者 Email
        tenant_id: 租戶 ID
        description: 操作描述
        details: 額外詳細資訊 (JSON)
        ip_address: 請求者 IP
        user_agent: 請求者 User-Agent

    Returns:
        AuditLog: 新建立的審計日誌記錄
    """
    audit_log = AuditLog(
        user_id=user_id,
        user_email=user_email,
        tenant_id=tenant_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        description=description,
        details=details or {},
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.add(audit_log)

    try:
        await db.commit()
        await db.refresh(audit_log)
        logger.debug(
            f"審計日誌: [{action}] {resource_type}"
            f"{'/' + resource_id if resource_id else ''}"
            f" by {user_email or user_id or 'anonymous'}"
        )
    except Exception as e:
        # 審計日誌寫入失敗不應影響主流程
        logger.error(f"審計日誌寫入失敗: {e}")
        await db.rollback()

    return audit_log


def _is_valid_ip(value: str) -> bool:
    """檢查字串是否是合法 IPv4 或 IPv6（粗檢，避免噪音 log 出無效 IP）。"""
    import ipaddress
    try:
        ipaddress.ip_address(value)
        return True
    except (ValueError, TypeError):
        return False


def get_client_ip(request) -> str:
    """
    從 FastAPI Request 物件取得客戶端 IP

    SECURITY 注意：
    - X-Forwarded-For 是攻擊者可控的 Header，正式部署時要在 reverse proxy
      （Nginx / Caddy）層做白名單，只信任「最後一跳是 trusted proxy」的值。
    - 這裡只做格式驗證 + 取最左側 client IP（FF 標準語意：left-most = original client）。

    FIX:
    - 原本沒驗證 IP 格式，X-Forwarded-For 給 "evil; <script>" 也會直接寫進 audit log。
    - 多 IP 時取最左側那個，但要 strip + 驗證合法。
    - 全部都無效時回 "unknown"，不要洩漏任何攻擊者塞的字串。

    Args:
        request: FastAPI Request 物件

    Returns:
        str: 客戶端 IP 位址（合法 IP 或 "unknown"）
    """
    # 優先讀取反向代理 Header
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # 多個 IP 用逗號分隔（X-Forwarded-For: client, proxy1, proxy2）
        # 取最左側（原始 client）。逐一檢查直到找到合法 IP。
        for candidate in forwarded_for.split(","):
            candidate = candidate.strip()
            if candidate and _is_valid_ip(candidate):
                return candidate

    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        real_ip = real_ip.strip()
        if _is_valid_ip(real_ip):
            return real_ip

    # 回退到直連 IP（這個值是 ASGI server 給的，可信）
    if request.client and request.client.host:
        return request.client.host

    return "unknown"


def get_user_agent(request) -> str:
    """
    從 FastAPI Request 物件取得 User-Agent

    Args:
        request: FastAPI Request 物件

    Returns:
        str: User-Agent 字串
    """
    return request.headers.get("User-Agent", "unknown")
