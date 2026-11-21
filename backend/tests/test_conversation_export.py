"""GET /conversations/{id}/export：匯出對話（Markdown／Word／PDF 用的 Markdown）——權限、內容、稽核"""
import io
import uuid
from datetime import datetime

from httpx import AsyncClient
from sqlalchemy import select

from app.models.audit_log import AuditLog
from app.models.message import Message
from app.services.conversation_export import to_docx, to_markdown

TABLE_ANSWER = "以下是預算：\n\n| 部門 | 預算 |\n| --- | --- |\n| 研發 | **30** |\n| 業務 | 25 |\n\n- 第一點\n1. 步驟一"


async def _conv_with_messages(async_client: AsyncClient, headers: dict, db) -> str:
    r = await async_client.post("/api/v1/conversations", json={"title": "預算討論"}, headers=headers)
    assert r.status_code == 201, r.text
    conv_id = r.json()["id"]
    q = Message(id=str(uuid.uuid4()), conversation_id=conv_id, role="user", content="各部門預算多少？", tokens=0)
    a = Message(id=str(uuid.uuid4()), conversation_id=conv_id, parent_id=q.id, role="assistant", content=TABLE_ANSWER, tokens=0)
    db.add_all([q, a])
    await db.flush()
    return conv_id


async def test_markdown_export_and_audit(async_client: AsyncClient, db_session, test_user, user_auth_headers):
    conv_id = await _conv_with_messages(async_client, user_auth_headers, db_session)
    r = await async_client.get(f"/api/v1/conversations/{conv_id}/export?format=markdown", headers=user_auth_headers)
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/markdown")
    assert "attachment" in r.headers["content-disposition"]
    assert r.headers["cache-control"] == "no-store"
    body = r.text
    assert body.startswith("# 預算討論")
    assert "## 我" in body and "## Corphia" in body and "| 研發 |" in body
    logs = (await db_session.execute(select(AuditLog).where(AuditLog.resource_id == conv_id))).scalars().all()
    assert any(log.action == "conversation_export" for log in logs)


async def test_docx_export_keeps_table(async_client: AsyncClient, db_session, test_user, user_auth_headers):
    from docx import Document

    conv_id = await _conv_with_messages(async_client, user_auth_headers, db_session)
    r = await async_client.get(f"/api/v1/conversations/{conv_id}/export?format=docx", headers=user_auth_headers)
    assert r.status_code == 200
    doc = Document(io.BytesIO(r.content))
    assert len(doc.tables) == 1
    assert doc.tables[0].cell(1, 0).text == "研發"
    assert doc.tables[0].cell(1, 1).text == "30"  # **粗體** 的星號不會留在 Word 裡


async def test_other_user_cannot_export(async_client: AsyncClient, db_session, test_user, user_auth_headers, admin_auth_headers):
    conv_id = await _conv_with_messages(async_client, admin_auth_headers, db_session)
    r = await async_client.get(f"/api/v1/conversations/{conv_id}/export", headers=user_auth_headers)
    assert r.status_code == 404


async def test_bad_format_refused(async_client: AsyncClient, db_session, test_user, user_auth_headers):
    conv_id = await _conv_with_messages(async_client, user_auth_headers, db_session)
    r = await async_client.get(f"/api/v1/conversations/{conv_id}/export?format=exe", headers=user_auth_headers)
    assert r.status_code == 422


def test_markdown_skips_empty_and_system_messages():
    class M:
        def __init__(self, role, content):
            self.role, self.content = role, content

    md = to_markdown("t", [M("system", "secret prompt"), M("user", "  "), M("assistant", "答")], datetime(2026, 1, 2, 3, 4))
    assert "secret prompt" not in md
    assert md.count("## ") == 1
    assert "2026-01-02 03:04" in md
    assert to_docx("t", [M("assistant", "```\ncode\n```")], datetime(2026, 1, 1))[:2] == b"PK"
