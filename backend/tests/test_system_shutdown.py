"""
關閉主機服務 (test_system_shutdown.py)

- 只有主機本機的管理員可以關；其他電腦或手機上的管理員不行（關了要有人到主機前才開得回來）
- 一般使用者不行；沒登入不行
- 關之前先寫稽核
"""
import pytest
from sqlalchemy import select

import app.api.system_shutdown as shutdown
from app.models.audit_log import AuditLog


@pytest.fixture
def stop_calls(monkeypatch, tmp_path):
    calls = []
    monkeypatch.setattr(shutdown, "start_stop_script", lambda: calls.append("stop"))
    script = tmp_path / "stop.py"
    script.write_text("", encoding="utf-8")
    monkeypatch.setattr(shutdown, "STOP_SCRIPT", script)
    return calls


def _from(monkeypatch, address: str | None):
    """假裝請求是從這個位址連進來的"""
    monkeypatch.setattr(shutdown, "is_loopback", lambda peer: address in ("127.0.0.1", "::1"))


async def test_admin_on_the_host_can_stop_the_services(async_client, test_admin, admin_auth_headers, db_session, stop_calls, monkeypatch):
    _from(monkeypatch, "127.0.0.1")
    r = await async_client.post("/api/v1/system/shutdown", headers=admin_auth_headers)
    assert r.status_code == 202 and r.json() == {"stopping": True}
    assert stop_calls == ["stop"]
    log = (await db_session.execute(select(AuditLog).where(AuditLog.action == "system_shutdown"))).scalars().all()
    assert len(log) == 1 and log[0].user_id == test_admin.id


async def test_admin_on_another_device_cannot(async_client, admin_auth_headers, stop_calls, monkeypatch):
    _from(monkeypatch, "192.168.1.50")
    r = await async_client.post("/api/v1/system/shutdown", headers=admin_auth_headers)
    assert r.status_code == 403 and stop_calls == []


async def test_ordinary_user_cannot_even_on_the_host(async_client, user_auth_headers, stop_calls, monkeypatch):
    _from(monkeypatch, "127.0.0.1")
    r = await async_client.post("/api/v1/system/shutdown", headers=user_auth_headers)
    assert r.status_code == 403 and stop_calls == []


async def test_not_logged_in_cannot(async_client, stop_calls, monkeypatch):
    _from(monkeypatch, "127.0.0.1")
    r = await async_client.post("/api/v1/system/shutdown")
    assert r.status_code in (401, 403) and stop_calls == []


async def test_install_without_the_stop_script(async_client, admin_auth_headers, stop_calls, monkeypatch, tmp_path):
    _from(monkeypatch, "127.0.0.1")
    monkeypatch.setattr(shutdown, "STOP_SCRIPT", tmp_path / "missing.py")
    r = await async_client.post("/api/v1/system/shutdown", headers=admin_auth_headers)
    assert r.status_code == 501 and stop_calls == []
