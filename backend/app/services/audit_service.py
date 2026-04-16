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


def get_client_ip(request) -> str:
    """
    從 FastAPI Request 物件取得客戶端 IP

    Args:
        request: FastAPI Request 物件

    Returns:
        str: 客戶端 IP 位址
    """
    # 優先讀取反向代理 Header
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()

    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip

    # 回退到直連 IP
    if request.client:
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
