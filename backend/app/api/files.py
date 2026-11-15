"""
AI 產出檔案的下載：只有產生它的人可以下載（別人的檔案一律 404，不透露存不存在），每次下載寫稽核
"""

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import FileResponse

from app.api.deps import CurrentUser, DbSession
from app.core.request_utils import get_client_ip
from app.services import generated_files as gf
from app.services.audit_service import AuditAction, AuditResource, write_audit_log
from app.services.file_builder import MIME

router = APIRouter(prefix="/files", tags=["AI 產出檔案"])


@router.get("/{file_id}/download")
async def download_file(file_id: str, current_user: CurrentUser, db: DbSession, request: Request):
    row = await gf.get_for_user(db, current_user.id, file_id)
    path = gf.file_path(row) if row else None
    if row is None or not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到這個檔案")
    await write_audit_log(
        db=db, action=AuditAction.FILE_DOWNLOAD, resource_type=AuditResource.FILE, resource_id=row.id,
        user_id=current_user.id, user_email=current_user.email, tenant_id=current_user.effective_tenant_id,
        description=f"下載 AI 產出的檔案：{row.filename}", details={"kind": row.kind, "size": row.size},
        ip_address=get_client_ip(request),
    )
    return FileResponse(path, media_type=MIME.get(row.kind, "application/octet-stream"), filename=row.filename)
