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

    # 資安事件（差異化資安功能 A1/A2/A3）
    PII_DETECTED = "pii_detected"
    PROMPT_INJECTION_BLOCKED = "prompt_injection_blocked"
    DLP_HIT = "dlp_hit"

    # 租戶管理
    TENANT_CREATE = "tenant_create"
    TENANT_UPDATE = "tenant_update"
    TENANT_DELETE = "tenant_delete"

    # 連接資料夾
    FOLDER_CONNECT = "folder_connect"
    FOLDER_UPDATE = "folder_update"
    FOLDER_DISCONNECT = "folder_disconnect"

    # 記憶（跨對話記住的事）
    MEMORY_CREATE = "memory_create"
    MEMORY_UPDATE = "memory_update"
    MEMORY_DELETE = "memory_delete"
    MEMORY_CLEAR = "memory_clear"
    MEMORY_REJECTED = "memory_rejected"

    # AI 產出檔案（Word、Excel、簡報）
    FILE_CREATE = "file_create"
    FILE_DOWNLOAD = "file_download"

    # 桌面版：操控使用者電腦上的 Office（介面在動作成功後回報）
    OFFICE_READ = "office_read"
    OFFICE_WRITE = "office_write"
    FILE_OPEN = "file_open"
    FILE_SAVE = "file_save"

    # 瀏覽器臨時資料夾：使用者用瀏覽器選這台電腦的資料夾附給 AI 看（只附一次，不留底）
    BROWSER_FOLDER_ATTACH = "browser_folder_attach"
    # 在聊天裡附圖片給 AI 看
    CHAT_IMAGE_ATTACH = "chat_image_attach"

    # 對外搜尋：唯一會把關鍵字送出這台機器的操作，一定要留稽核
    WEB_SEARCH = "web_search"
    # AI 回答前自己用了工具（查文件、連外網、計算…）
    TOOL_CALL = "tool_call"
    # 管理員從管理後台關閉主機服務
    SYSTEM_SHUTDOWN = "system_shutdown"

    # 送模型前最後一關：文件片段被剔除或遮罩
    CONTEXT_FILTERED = "context_filtered"
    # 模型的回答被改過：外部圖片拿掉、個資遮罩
    OUTPUT_FILTERED = "output_filtered"

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
    MEMORY = "memory"
    FILE = "file"
    DESKTOP = "desktop"
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

