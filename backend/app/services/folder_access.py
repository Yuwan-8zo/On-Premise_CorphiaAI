"""
連接資料夾的使用權限：誰可以用哪些資料夾的內容（對話檢索、文件 API 共用這一份，不要各自判斷）

規則：
  - 同一個租戶的資料夾才看得到（系統管理員 engineer 也一樣只看自己租戶，避免對話跨租戶讀到別家資料）
  - 資料夾要啟用
  - 使用者的角色在資料夾的 allowed_roles 裡；engineer 視同 admin
"""

from __future__ import annotations

from sqlalchemy import or_, select

from app.models.connected_folder import ConnectedFolder
from app.models.document import Document, DocumentStatus
from app.services.folder_indexer import SOURCE


def _role_ok(role: str, allowed: list) -> bool:
    if role in allowed:
        return True
    return role == "engineer" and "admin" in allowed


async def allowed_folder_ids(db, user) -> list[str]:
    """這個人可以用的連接資料夾"""
    rows = (await db.execute(
        select(ConnectedFolder.id, ConnectedFolder.allowed_roles).where(
            ConnectedFolder.tenant_id == user.effective_tenant_id,
            ConnectedFolder.is_enabled.is_(True),
        )
    )).all()
    return [fid for fid, roles in rows if _role_ok(user.role, roles or [])]


async def folder_document_ids(db, user) -> list[str]:
    """這個人可以檢索的連接資料夾文件（已建好索引的）"""
    fids = await allowed_folder_ids(db, user)
    if not fids:
        return []
    return list((await db.execute(
        select(Document.id).where(
            Document.tenant_id == user.effective_tenant_id,
            Document.doc_metadata["source"].astext == SOURCE,
            Document.doc_metadata["folder_id"].astext.in_(fids),
            Document.status == DocumentStatus.COMPLETED.value,
        )
    )).scalars().all())


async def searchable_document_ids(db, user) -> list[str]:
    """
    這個人在對話裡可以檢索的所有文件（沒有指定專案資料夾時的範圍；規則和文件 API 一致）：
      - 一般上傳的文件：一般使用者只有自己上傳的；管理者與工程師是整個租戶的
      - 連接資料夾的文件：依資料夾權限（folder_document_ids）
    回傳空清單＝沒有可以檢索的文件（呼叫端不可以把空清單當成「不限制」）
    """
    query = select(Document.id).where(
        Document.tenant_id == user.effective_tenant_id,
        Document.status == DocumentStatus.COMPLETED.value,
        or_(Document.doc_metadata["source"].astext.is_(None), Document.doc_metadata["source"].astext != SOURCE),
    )
    if not (user.is_admin or user.is_engineer):
        query = query.where(Document.uploaded_by == user.id)
    uploaded = list((await db.execute(query)).scalars().all())
    return uploaded + await folder_document_ids(db, user)


async def can_read_folder_document(db, user, doc: Document) -> bool:
    """連接資料夾來的文件：這個人有沒有權限看（一般上傳的文件不在這裡判斷）"""
    fid = (doc.doc_metadata or {}).get("folder_id")
    return bool(fid) and fid in await allowed_folder_ids(db, user)
