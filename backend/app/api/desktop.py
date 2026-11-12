"""
桌面版回報：使用者在桌面版操控了這台電腦上的 Office（讀內容、寫入、開啟 AI 產出的檔案）→ 寫一筆稽核

操控本身發生在使用者的電腦上（desktop/office_bridge.py），伺服器看不到，所以由介面在動作成功後回報。
這裡只收「做了什麼」的摘要（哪個程式、文件名稱、幾個字），不收文件內容。
"""

from typing import Literal

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from app.api.deps import CurrentUser, DbSession
from app.core.request_utils import get_client_ip
from app.services.audit_service import AuditAction, AuditResource, write_audit_log

router = APIRouter(prefix="/desktop", tags=["桌面版"])

_ACTIONS = {
    "office_read": (AuditAction.OFFICE_READ, "讀取 Office 內容"),
    "office_write": (AuditAction.OFFICE_WRITE, "把回答寫入 Office"),
    "file_open": (AuditAction.FILE_OPEN, "用 Office 開啟 AI 產出的檔案"),
}
# 摘要只留這幾個欄位、每個值限長，避免把文件內容夾帶進稽核
_DETAIL_KEYS = ("name", "scope", "chars", "truncated", "detail", "backup")
_VALUE_MAX = 200


class DesktopEvent(BaseModel):
    action: Literal["office_read", "office_write", "file_open"]
    app: str = Field("", max_length=20)
    detail: dict = Field(default_factory=dict)


@router.post("/events")
async def record_event(body: DesktopEvent, current_user: CurrentUser, db: DbSession, request: Request):
    action, text = _ACTIONS[body.action]
    detail = {k: (v[:_VALUE_MAX] if isinstance(v, str) else v) for k, v in body.detail.items() if k in _DETAIL_KEYS and isinstance(v, (str, int, bool))}
    await write_audit_log(
        db=db, action=action, resource_type=AuditResource.DESKTOP,
        user_id=current_user.id, user_email=current_user.email, tenant_id=current_user.effective_tenant_id,
        description=f"{text}（{body.app or '桌面版'}）", details={"app": body.app, **detail},
        ip_address=get_client_ip(request),
    )
    return {"ok": True}
