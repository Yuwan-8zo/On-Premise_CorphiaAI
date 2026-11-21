"""GET /documents/{id}/file：引用原文預覽用的原始 PDF——權限、格式、稽核"""
import uuid

from httpx import AsyncClient
from sqlalchemy import select

from app.models.audit_log import AuditLog
from app.models.document import Document

PDF = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n"


async def _doc(db, owner, tmp_path, ext="pdf", data=PDF):
    f = tmp_path / f"{uuid.uuid4().hex}.{ext}"
    f.write_bytes(data)
    doc = Document(
        id=str(uuid.uuid4()), tenant_id=owner.tenant_id, uploaded_by=owner.id,
        filename=f.name, original_filename=f"規章.{ext}", file_type=ext, file_size=len(data),
        file_path=str(f), status="completed", doc_metadata={},
    )
    db.add(doc)
    await db.flush()
    return doc


async def test_owner_gets_pdf_inline_and_audit(async_client: AsyncClient, db_session, test_user, user_auth_headers, tmp_path):
    doc = await _doc(db_session, test_user, tmp_path)
    r = await async_client.get(f"/api/v1/documents/{doc.id}/file", headers=user_auth_headers)
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.headers["content-disposition"].startswith("inline")
    assert r.headers["cache-control"] == "no-store"
    assert r.content == PDF
    logs = (await db_session.execute(select(AuditLog).where(AuditLog.resource_id == doc.id))).scalars().all()
    assert any(log.action == "document_view" for log in logs)


async def test_other_user_cannot_read(async_client: AsyncClient, db_session, test_admin, test_user, user_auth_headers, tmp_path):
    # 管理員上傳的專案文件：一般使用者用編號也讀不到（當作不存在）
    doc = await _doc(db_session, test_admin, tmp_path)
    r = await async_client.get(f"/api/v1/documents/{doc.id}/file", headers=user_auth_headers)
    assert r.status_code == 404


async def test_non_pdf_is_refused(async_client: AsyncClient, db_session, test_user, user_auth_headers, tmp_path):
    doc = await _doc(db_session, test_user, tmp_path, ext="docx", data=b"PK\x03\x04")
    r = await async_client.get(f"/api/v1/documents/{doc.id}/file", headers=user_auth_headers)
    assert r.status_code == 415


async def test_missing_file_is_404(async_client: AsyncClient, db_session, test_user, user_auth_headers, tmp_path):
    doc = await _doc(db_session, test_user, tmp_path)
    (tmp_path / doc.filename).unlink()
    r = await async_client.get(f"/api/v1/documents/{doc.id}/file", headers=user_auth_headers)
    assert r.status_code == 404


async def test_requires_auth(async_client: AsyncClient):
    r = await async_client.get(f"/api/v1/documents/{uuid.uuid4()}/file")
    assert r.status_code in (401, 403)
