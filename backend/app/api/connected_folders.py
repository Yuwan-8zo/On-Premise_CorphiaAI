"""
連接資料夾 API（後台「資料夾」分頁）

  GET    /connected-folders              清單（engineer 看全部；租戶管理員只看自己租戶）
  POST   /connected-folders/check        檢查路徑能不能接、裡面有多少檔案（還沒存）
  GET    /connected-folders/browse       瀏覽伺服器上的資料夾（給「選擇資料夾」視窗用）
  POST   /connected-folders              新增
  PUT    /connected-folders/{id}         修改
  DELETE /connected-folders/{id}         取消連接（不會刪除資料夾裡的任何檔案）

路徑規則全部在 services/folder_source.py；每個新增、修改、取消都寫稽核紀錄。
"""

import asyncio
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, Depends, RequireAdmin, get_db
from app.core.request_utils import get_client_ip, get_user_agent
from app.core.tenancy import sees_all_tenants
from app.models.connected_folder import ConnectedFolder, FolderStatus
from app.schemas.connected_folder import (
    SCAN_INTERVALS,
    BrowseResponse,
    ConnectedFolderCreate,
    ConnectedFolderResponse,
    ConnectedFolderUpdate,
    FolderCheckRequest,
    FolderCheckResponse,
)
from app.services.audit_service import AuditAction, AuditResource, write_audit_log
from app.services.folder_source import browse, inspect_folder, overlaps, validate_folder_path

router = APIRouter(prefix="/connected-folders", tags=["connected-folders"])


def _check_interval(v: int | None):
    if v is not None and v not in SCAN_INTERVALS:
        raise HTTPException(status_code=400, detail=f"自動更新間隔只能是 {', '.join(map(str, SCAN_INTERVALS))} 分鐘")


async def _get_owned(db: AsyncSession, folder_id: str, user) -> ConnectedFolder:
    item = (await db.execute(select(ConnectedFolder).where(ConnectedFolder.id == folder_id))).scalar_one_or_none()
    if not item or (not sees_all_tenants(user) and item.tenant_id != user.effective_tenant_id):
        raise HTTPException(status_code=404, detail="找不到這個資料夾")
    return item


async def _validate_and_check_overlap(db: AsyncSession, raw: str, exclude_id: str | None = None) -> str:
    """路徑合法、而且不和已連接的資料夾重疊（重疊會重複建立索引，跨租戶還會看到別人的檔案）"""
    try:
        path = str(await asyncio.to_thread(validate_folder_path, raw))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    for other in (await db.execute(select(ConnectedFolder))).scalars():
        if other.id != exclude_id and overlaps(path, other.path):
            raise HTTPException(status_code=400, detail=f"和已連接的資料夾「{other.name}」重疊，請選擇不同的資料夾")
    return path


async def _audit(db, request: Request, user, action: str, item: ConnectedFolder, what: str):
    await write_audit_log(
        db=db, action=action, resource_type=AuditResource.DOCUMENT, resource_id=item.id,
        user_id=user.id, user_email=user.email, tenant_id=item.tenant_id,
        description=f"{what}：{item.name}（{item.path}）",
        ip_address=get_client_ip(request), user_agent=get_user_agent(request),
    )


@router.get("", response_model=list[ConnectedFolderResponse])
async def list_folders(current_user: CurrentUser, db: AsyncSession = Depends(get_db), _=RequireAdmin):
    q = select(ConnectedFolder).order_by(ConnectedFolder.created_at)
    if not sees_all_tenants(current_user):
        q = q.where(ConnectedFolder.tenant_id == current_user.effective_tenant_id)
    return [ConnectedFolderResponse.model_validate(f) for f in (await db.execute(q)).scalars()]


@router.post("/check", response_model=FolderCheckResponse)
async def check_folder(data: FolderCheckRequest, _=RequireAdmin):
    """只檢查不存：路徑不行就回 ok=false 和原因（畫面直接顯示），可以就回檔案統計"""
    try:
        path = await asyncio.to_thread(validate_folder_path, data.path)
    except ValueError as e:
        return FolderCheckResponse(ok=False, message=str(e))
    info = await asyncio.to_thread(inspect_folder, path, data.include_subfolders)
    return FolderCheckResponse(ok=True, **info)


@router.get("/browse", response_model=BrowseResponse)
async def browse_folders(path: str | None = Query(None, max_length=1000), _=RequireAdmin):
    try:
        return await asyncio.to_thread(browse, path)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("", response_model=ConnectedFolderResponse)
async def create_folder(data: ConnectedFolderCreate, current_user: CurrentUser, request: Request, db: AsyncSession = Depends(get_db), _=RequireAdmin):
    _check_interval(data.scan_interval_min)
    path = await _validate_and_check_overlap(db, data.path)
    info = await asyncio.to_thread(inspect_folder, Path(path), data.include_subfolders)
    item = ConnectedFolder(
        **data.model_dump(exclude={"path"}), path=path,
        tenant_id=current_user.effective_tenant_id, created_by=current_user.id,
        status=FolderStatus.PENDING, file_count=info["file_count"], total_bytes=info["total_bytes"],
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    await _audit(db, request, current_user, AuditAction.FOLDER_CONNECT, item, "連接資料夾")
    return ConnectedFolderResponse.model_validate(item)


@router.put("/{folder_id}", response_model=ConnectedFolderResponse)
async def update_folder(folder_id: str, data: ConnectedFolderUpdate, current_user: CurrentUser, request: Request, db: AsyncSession = Depends(get_db), _=RequireAdmin):
    item = await _get_owned(db, folder_id, current_user)
    patch = data.model_dump(exclude_unset=True)
    _check_interval(patch.get("scan_interval_min"))
    if "path" in patch:
        new_path = await _validate_and_check_overlap(db, patch["path"], exclude_id=item.id)
        if new_path != item.path:
            # 換了資料夾：之前的索引不算數，要重新建立
            item.status, item.last_scan_at, item.error_message = FolderStatus.PENDING, None, None
        patch["path"] = new_path
    for k, v in patch.items():
        setattr(item, k, v)
    await db.commit()
    await db.refresh(item)
    await _audit(db, request, current_user, AuditAction.FOLDER_UPDATE, item, "修改連接資料夾")
    return ConnectedFolderResponse.model_validate(item)


@router.delete("/{folder_id}")
async def delete_folder(folder_id: str, current_user: CurrentUser, request: Request, db: AsyncSession = Depends(get_db), _=RequireAdmin):
    item = await _get_owned(db, folder_id, current_user)
    await _audit(db, request, current_user, AuditAction.FOLDER_DISCONNECT, item, "取消連接資料夾（檔案不會刪除）")
    await db.delete(item)
    await db.commit()
    return {"ok": True}
