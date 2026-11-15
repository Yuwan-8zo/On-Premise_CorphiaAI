"""結案前壓力測試與架構查證補上的幾項：安全性標頭、網路狀態不連外、安裝精靈選預設模型"""
import socket
import sys
from pathlib import Path

import pytest
from httpx import AsyncClient

SCRIPTS = Path(__file__).resolve().parents[2] / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import first_run_setup as setup  # noqa: E402


@pytest.mark.asyncio
async def test_security_headers_on_every_response(async_client: AsyncClient):
    for url in ("/api/v1/health", "/api/v1/conversations", "/api/v1/does-not-exist"):
        response = await async_client.get(url)
        assert response.headers.get("x-content-type-options") == "nosniff", url
        assert response.headers.get("x-frame-options") == "SAMEORIGIN", url
        assert response.headers.get("referrer-policy") == "no-referrer", url


@pytest.mark.asyncio
async def test_network_status_does_not_connect_outside(async_client: AsyncClient, admin_auth_headers, monkeypatch):
    """回報的是設定（有沒有開對外搜尋），不能為了測試網路而真的連出去"""
    def no_outbound(*args, **kwargs):
        raise AssertionError(f"不應該連到外面：{args[:1]}")

    monkeypatch.setattr(socket, "create_connection", no_outbound)
    try:
        import aiohttp
        monkeypatch.setattr(aiohttp, "ClientSession", no_outbound)
    except ImportError:
        pass

    response = await async_client.get("/api/v1/system/network/status", headers=admin_auth_headers)
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["latency_ms"] is None
    assert data["data_sovereignty"] is (not data["is_online"])


@pytest.mark.asyncio
async def test_network_status_admin_only(async_client: AsyncClient, user_auth_headers):
    response = await async_client.get("/api/v1/system/network/status", headers=user_auth_headers)
    assert response.status_code == 403


def test_setup_prefers_default_model(tmp_path, monkeypatch):
    """模型資料夾裡有好幾個模型時，預設模型排第一個（大寫開頭的檔名以前會搶到前面）"""
    models = tmp_path / "ai_model"
    models.mkdir()
    for name in ("Llama-Breeze2-8B.gguf", "gpt-oss-20b-MXFP4.gguf", "Qwen2.5-7B.gguf"):
        (models / name).write_bytes(b"x")
    example = tmp_path / ".env.example"
    example.write_text("APP_ENV=development\nLLAMA_MODEL_PATH=../ai_model/gpt-oss-20b-MXFP4.gguf\n", encoding="utf-8")
    monkeypatch.setattr(setup, "MODEL_DIR", models)
    monkeypatch.setattr(setup, "ENV_EXAMPLE", example)

    assert setup.default_model_name() == "gpt-oss-20b-MXFP4.gguf"
    assert [p.name for p in setup.model_files()][0] == "gpt-oss-20b-MXFP4.gguf"

    # 預設模型不在資料夾裡：照檔名排（不分大小寫），不出錯
    (models / "gpt-oss-20b-MXFP4.gguf").unlink()
    assert [p.name for p in setup.model_files()] == ["Llama-Breeze2-8B.gguf", "Qwen2.5-7B.gguf"]


# ── 自己上傳的文件是個人的：同一個單位的其他一般使用者看不到、也讀不到 ─────────────────────
async def _other_user_doc(db_session, tenant_id):
    import uuid

    from app.core.security import get_password_hash
    from app.models.document import Document
    from app.models.user import User, UserRole

    other = User(id=str(uuid.uuid4()), email=f"other_{uuid.uuid4().hex[:6]}@test.com", password_hash=get_password_hash("OtherPass123!"),
                 name="Other", role=UserRole.USER.value, tenant_id=tenant_id, is_active=True)
    db_session.add(other)
    await db_session.flush()
    doc = Document(id=str(uuid.uuid4()), tenant_id=tenant_id, uploaded_by=other.id, filename="x.txt", original_filename="別人的報價單.txt",
                   file_type="txt", file_size=10, file_path="uploads/none.txt", status="completed")
    db_session.add(doc)
    await db_session.flush()
    return doc


@pytest.mark.asyncio
async def test_user_cannot_read_or_list_another_users_document(async_client: AsyncClient, db_session, test_user, user_auth_headers):
    doc = await _other_user_doc(db_session, test_user.tenant_id)
    got = await async_client.get(f"/api/v1/documents/{doc.id}", headers=user_auth_headers)
    assert got.status_code == 404
    listed = await async_client.get("/api/v1/documents", headers=user_auth_headers)
    assert listed.status_code == 200
    assert doc.id not in [d["id"] for d in listed.json()["data"]]
    assert (await async_client.delete(f"/api/v1/documents/{doc.id}", headers=user_auth_headers)).status_code == 404


@pytest.mark.asyncio
async def test_admin_still_sees_tenant_documents(async_client: AsyncClient, db_session, test_admin, admin_auth_headers):
    doc = await _other_user_doc(db_session, test_admin.tenant_id)
    assert (await async_client.get(f"/api/v1/documents/{doc.id}", headers=admin_auth_headers)).status_code == 200
    listed = await async_client.get("/api/v1/documents", headers=admin_auth_headers)
    assert doc.id in [d["id"] for d in listed.json()["data"]]
