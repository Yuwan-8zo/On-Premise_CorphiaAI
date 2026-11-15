"""
資料夾 API

簡易資料夾管理（以 name 為識別鍵），用於取代前端 localStorage 持久化。
"""

import re
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import select
from pydantic import BaseModel, ConfigDict, Field

from app.api.deps import CurrentUser, DbSession
from app.core.request_utils import get_client_ip
from app.models.folder import Folder
from app.services.audit_service import AuditAction, AuditResource, write_audit_log
from app.services.context_guard import REASON_DLP, screen_text

router = APIRouter(prefix="/folders", tags=["資料夾"])

# 專案自訂指示的長度上限（字）：每一題都會附給模型，太長會拖慢回答
INSTRUCTIONS_MAX = 1000


class FolderCreate(BaseModel):
    """建立資料夾 Schema"""
    name: str = Field(..., min_length=1, max_length=100)


class FolderResponse(BaseModel):
    """資料夾回應 Schema"""
    id: str
    name: str
    # 專案的自訂指示（沒設定是 null）
    instructions: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class FolderInstructions(BaseModel):
    """專案的自訂指示；空字串＝清除"""
    instructions: str = Field("", max_length=INSTRUCTIONS_MAX)


@router.get("", response_model=list[FolderResponse])
async def list_folders(
    current_user: CurrentUser,
    db: DbSession,
):
    """取得當前使用者的所有資料夾"""
    result = await db.execute(
        select(Folder)
        .where(Folder.user_id == current_user.id)
        .order_by(Folder.sort_order, Folder.created_at)
    )
    return list(result.scalars().all())


@router.post("", response_model=FolderResponse, status_code=status.HTTP_201_CREATED)
async def create_folder(
    body: FolderCreate,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    建立資料夾（upsert：名稱已存在則直接回傳，不重複新增）
    """
    # 先查是否已存在同名資料夾
    result = await db.execute(
        select(Folder).where(
            Folder.user_id == current_user.id,
            Folder.name == body.name.strip(),
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        return existing

    folder = Folder(
        user_id=current_user.id,
        name=body.name.strip(),
    )
    db.add(folder)
    await db.commit()
    await db.refresh(folder)
    return folder


@router.put("/{folder_name}/instructions", response_model=FolderResponse)
async def set_folder_instructions(
    folder_name: str,
    body: FolderInstructions,
    current_user: CurrentUser,
    db: DbSession,
    request: Request,
):
    """
    設定專案的自訂指示：這個專案裡每一題都會附給 AI 的固定說明。
    內容先過安全檢查（個資遮罩；含違禁詞或看起來在改寫系統規則的不收）；資料夾還沒有紀錄就順便建立。
    """
    name = folder_name.strip()
    if not name or len(name) > 100:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="資料夾名稱不可為空或超過 100 字元")
    text = re.sub(r"[ \t]+\n", "\n", body.instructions).strip()
    if text:
        clean, reason = screen_text(text)
        if clean is None:
            detail = "內容含有公司禁止的詞，不能設成專案指示" if reason == REASON_DLP else "內容看起來像在改寫 AI 的安全規則，不能設成專案指示"
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)
        text = clean
    folder = (await db.execute(select(Folder).where(Folder.user_id == current_user.id, Folder.name == name))).scalar_one_or_none()
    if folder is None:
        folder = Folder(user_id=current_user.id, name=name)
        db.add(folder)
    folder.instructions = text or None
    await db.commit()
    await db.refresh(folder)
    await write_audit_log(
        db=db, action=AuditAction.CONVERSATION_UPDATE, resource_type=AuditResource.CONVERSATION, resource_id=folder.id,
        user_id=current_user.id, user_email=current_user.email, tenant_id=current_user.effective_tenant_id,
        description=f"{'設定' if text else '清除'}專案指示：{name}", details={"folder": name, "length": len(text)},
        ip_address=get_client_ip(request),
    )
    return folder


@router.delete("/{folder_name}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_folder(
    folder_name: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """刪除指定名稱的資料夾"""
    # FIX: folder_name 從 URL path 來，雖然 SQLAlchemy 已 parametrize 防 SQL injection，
    # 但仍應限制長度避免攻擊者塞超大字串嘗試 DoS DB query parser
    if not folder_name or len(folder_name) > 128:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="folder_name 不可為空或超過 128 字元",
        )
    result = await db.execute(
        select(Folder).where(
            Folder.user_id == current_user.id,
            Folder.name == folder_name,
        )
    )
    folder = result.scalar_one_or_none()
    if folder is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="資料夾不存在",
        )
    await db.delete(folder)
    await db.commit()
