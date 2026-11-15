"""
對話檢索範圍測試 (test_rag_scope.py)

沒有指定專案資料夾時，知識庫問答只能檢索「這個人看得到的文件」：
- 一般使用者：自己上傳的＋有權限的連接資料夾；別人上傳的、沒權限或停用的資料夾都不行
- 管理者：整個租戶上傳的文件；連接資料夾一樣依資料夾權限
- 沒有任何可檢索的文件時是空清單（不能變成「不限制」）
"""
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.connected_folder import ConnectedFolder
from app.models.document import Document
from app.models.tenant import Tenant
from app.services.folder_access import searchable_document_ids
from tests.test_permissions import make_user


async def make_doc(db: AsyncSession, owner, tenant_id: str, folder_id: str | None = None, status: str = "completed") -> Document:
    """folder_id 有值＝連接資料夾的文件（上傳者是建立資料夾的管理者，和實際索引時一樣）"""
    meta = {"source": "folder", "folder_id": folder_id} if folder_id else {}
    d = Document(
        id=str(uuid.uuid4()), tenant_id=tenant_id, uploaded_by=owner.id,
        filename=f"{uuid.uuid4().hex}.txt", original_filename="a.txt", file_path="x", file_size=1,
        file_type="txt", status=status, doc_metadata=meta,
    )
    db.add(d)
    await db.flush()
    return d


async def make_folder(db: AsyncSession, tenant_id: str, roles: list, enabled: bool = True) -> ConnectedFolder:
    f = ConnectedFolder(
        id=str(uuid.uuid4()), tenant_id=tenant_id, name="f", path=f"C:/scope-test/{uuid.uuid4().hex}",
        allowed_roles=roles, is_enabled=enabled,
    )
    db.add(f)
    await db.flush()
    return f


class TestSearchableDocuments:
    async def test_user_sees_own_and_permitted_folders_only(self, db_session: AsyncSession, test_tenant: Tenant):
        tid = test_tenant.id
        me = await make_user(db_session, "user", tid)
        other = await make_user(db_session, "user", tid)
        mine = await make_doc(db_session, me, tid)
        others = await make_doc(db_session, other, tid)
        indexer = await make_user(db_session, "admin", tid)
        open_folder = await make_folder(db_session, tid, ["user", "admin"])
        admin_folder = await make_folder(db_session, tid, ["admin"])
        off_folder = await make_folder(db_session, tid, ["user", "admin"], enabled=False)
        in_open = await make_doc(db_session, indexer, tid, open_folder.id)
        in_admin = await make_doc(db_session, indexer, tid, admin_folder.id)
        in_off = await make_doc(db_session, indexer, tid, off_folder.id)

        ids = set(await searchable_document_ids(db_session, me))
        assert {mine.id, in_open.id} <= ids
        assert not ids & {others.id, in_admin.id, in_off.id}

    async def test_admin_sees_tenant_uploads_and_admin_folders(self, db_session: AsyncSession, test_tenant: Tenant):
        tid = test_tenant.id
        admin = await make_user(db_session, "admin", tid)
        someone = await make_user(db_session, "user", tid)
        theirs = await make_doc(db_session, someone, tid)
        admin_folder = await make_folder(db_session, tid, ["admin"])
        in_admin = await make_doc(db_session, admin, tid, admin_folder.id)

        ids = set(await searchable_document_ids(db_session, admin))
        assert {theirs.id, in_admin.id} <= ids

    async def test_unfinished_documents_are_not_searchable(self, db_session: AsyncSession, test_tenant: Tenant):
        me = await make_user(db_session, "user", test_tenant.id)
        pending = await make_doc(db_session, me, test_tenant.id, status="processing")
        assert pending.id not in await searchable_document_ids(db_session, me)

    async def test_nothing_searchable_is_empty_list_not_none(self, db_session: AsyncSession, test_tenant: Tenant):
        loner = await make_user(db_session, "user", test_tenant.id)
        assert await searchable_document_ids(db_session, loner) == []
