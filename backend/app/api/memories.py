"""
記憶 API：每個人管理自己的記憶（看、加、改、刪、全部清除、開關）

只碰得到自己的；內容先過安全檢查（個資遮罩、違禁詞、可疑指令，見 services/context_guard），每個動作寫稽核。
對話裡說「記住……」的那條路在 services/chat_service._remember。
"""

from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict, Field

from app.api.deps import CurrentUser, DbSession
from app.core.request_utils import get_client_ip
from app.models.user_memory import MemorySource
from app.services import memory_service as ms
from app.services.audit_service import AuditAction, AuditResource, write_audit_log
from app.services.context_guard import REASON_DLP, screen_text

router = APIRouter(prefix="/memories", tags=["記憶"])


class MemoryBody(BaseModel):
    content: str = Field(..., min_length=1, max_length=ms.MAX_CHARS)


class MemorySettingsBody(BaseModel):
    """個人化設定：只改有給的那幾項"""
    enabled: Optional[bool] = None
    style: Optional[Literal["default", "concise", "detailed", "formal"]] = None


class MemoryItem(BaseModel):
    id: str
    content: str
    source: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MemoryList(BaseModel):
    enabled: bool
    # 回答風格：default／concise／detailed／formal
    style: str
    items: list[MemoryItem]
    max_items: int
    max_chars: int


def _screen(content: str) -> str:
    """過安全檢查；不通過回 400（說明原因）"""
    clean, reason = screen_text(content)
    if clean is None:
        detail = "內容含有公司禁止的詞，不能存成記憶" if reason == REASON_DLP else "內容看起來像在改寫 AI 的規則，不能存成記憶"
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)
    return clean


async def _audit(db, user, request: Request, action: str, description: str, resource_id: str | None = None, details: dict | None = None) -> None:
    await write_audit_log(
        db=db, action=action, resource_type=AuditResource.MEMORY, resource_id=resource_id,
        user_id=user.id, user_email=user.email, tenant_id=user.effective_tenant_id,
        description=description, details=details or {}, ip_address=get_client_ip(request),
    )


@router.get("", response_model=MemoryList)
async def list_memories(current_user: CurrentUser, db: DbSession):
    return MemoryList(
        enabled=await ms.is_enabled(db, current_user.id),
        style=await ms.get_style(db, current_user.id),
        items=await ms.list_memories(db, current_user.id),
        max_items=ms.MAX_ITEMS,
        max_chars=ms.MAX_CHARS,
    )


@router.post("", response_model=MemoryItem, status_code=status.HTTP_201_CREATED)
async def create_memory(body: MemoryBody, current_user: CurrentUser, db: DbSession, request: Request):
    try:
        row, created = await ms.add_memory(db, current_user.id, _screen(body.content), MemorySource.MANUAL)
    except ms.MemoryLimitError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"記憶最多 {ms.MAX_ITEMS} 則，請先刪除不需要的")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    if created:
        await _audit(db, current_user, request, AuditAction.MEMORY_CREATE, "新增一則記憶", row.id, {"source": MemorySource.MANUAL, "length": len(row.content)})
    return row


@router.put("/settings")
async def update_settings(body: MemorySettingsBody, current_user: CurrentUser, db: DbSession, request: Request):
    if body.enabled is not None:
        await ms.set_enabled(db, current_user.id, body.enabled)
        await _audit(db, current_user, request, AuditAction.MEMORY_UPDATE, "開啟記憶功能" if body.enabled else "關閉記憶功能", details={"enabled": body.enabled})
    if body.style is not None:
        await ms.set_style(db, current_user.id, body.style)
        await _audit(db, current_user, request, AuditAction.MEMORY_UPDATE, f"變更回答風格：{body.style}", details={"style": body.style})
    return {"enabled": await ms.is_enabled(db, current_user.id), "style": await ms.get_style(db, current_user.id)}


@router.put("/{memory_id}", response_model=MemoryItem)
async def update_memory(memory_id: str, body: MemoryBody, current_user: CurrentUser, db: DbSession, request: Request):
    row = await ms.get_memory(db, current_user.id, memory_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到這則記憶")
    text = ms.clean_content(_screen(body.content))
    if not text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="記憶內容不能是空的")
    row.content = text
    await db.commit()
    await db.refresh(row)
    await _audit(db, current_user, request, AuditAction.MEMORY_UPDATE, "修改一則記憶", row.id, {"length": len(text)})
    return row


@router.delete("", status_code=status.HTTP_200_OK)
async def clear_memories(current_user: CurrentUser, db: DbSession, request: Request):
    count = await ms.clear_memories(db, current_user.id)
    await _audit(db, current_user, request, AuditAction.MEMORY_CLEAR, f"清除全部記憶（{count} 則）", details={"count": count})
    return {"deleted": count}


@router.delete("/{memory_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_memory(memory_id: str, current_user: CurrentUser, db: DbSession, request: Request):
    row = await ms.get_memory(db, current_user.id, memory_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到這則記憶")
    await db.delete(row)
    await db.commit()
    await _audit(db, current_user, request, AuditAction.MEMORY_DELETE, "刪除一則記憶", memory_id)
