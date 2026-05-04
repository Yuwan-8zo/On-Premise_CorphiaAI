"""
資料夾 API

簡易資料夾管理（以 name 為識別鍵），用於取代前端 localStorage 持久化。
"""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select, delete
from pydantic import BaseModel, Field

from app.api.deps import CurrentUser, DbSession
from app.models.folder import Folder

router = APIRouter(prefix="/folders", tags=["資料夾"])


class FolderCreate(BaseModel):
    """建立資料夾 Schema"""
    name: str = Field(..., min_length=1, max_length=100)


class FolderResponse(BaseModel):
    """資料夾回應 Schema"""
    id: str
    name: str

    class Config:
        from_attributes = True


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
