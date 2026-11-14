"""
稽核紀錄防竄改鏈：正常寫入的鏈驗證會過；改內容、刪中間一筆、同時寫入，都要查得出來或不出錯
"""
import asyncio
import uuid

from httpx import AsyncClient
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.services import audit_chain
from app.services.audit_service import AuditAction, AuditResource, write_audit_log
from tests.conftest import TestingSessionLocal

API = "/api/v1"


async def _write(db: AsyncSession, marker: str, n: int = 3) -> list[AuditLog]:
    logs = []
    for i in range(n):
        logs.append(await write_audit_log(
            db=db, action=AuditAction.LOGIN_FAILED, resource_type=AuditResource.AUTH,
            user_email=f"{marker}-{i}@x.com", description=f"測試 {marker} 第 {i} 筆",
            details={"n": i, "nested": {"k": "值"}, "when": uuid.uuid4()},  # 不是 JSON 的值也要存得進去、算得回來
        ))
    return logs


async def test_chain_links_and_verifies(db_session: AsyncSession):
    logs = await _write(db_session, uuid.uuid4().hex[:8])
    assert [log.chain_seq for log in logs] == list(range(logs[0].chain_seq, logs[0].chain_seq + 3))
    assert logs[1].prev_hash == logs[0].entry_hash and logs[2].prev_hash == logs[1].entry_hash
    result = await audit_chain.verify_chain(db_session)
    assert result["valid"], result
    assert result["head"]["seq"] == logs[-1].chain_seq and result["head"]["hash"] == logs[-1].entry_hash


async def test_edited_entry_is_detected(db_session: AsyncSession):
    logs = await _write(db_session, uuid.uuid4().hex[:8])
    target = logs[1]
    # 直接改資料庫（不經過系統）：只在這個交易裡改，測完回滾
    await db_session.execute(update(AuditLog).where(AuditLog.id == target.id).values(description="被改過的內容"))
    result = await audit_chain.verify_chain(db_session)
    assert not result["valid"]
    assert result["problem"] == "內容被改過" and result["broken_at"] == target.chain_seq
    await db_session.rollback()
    assert (await audit_chain.verify_chain(db_session))["valid"]


async def test_edited_details_or_time_is_detected(db_session: AsyncSession):
    logs = await _write(db_session, uuid.uuid4().hex[:8], n=2)
    await db_session.execute(update(AuditLog).where(AuditLog.id == logs[0].id).values(details={"n": 999}))
    assert (await audit_chain.verify_chain(db_session))["problem"] == "內容被改過"
    await db_session.rollback()


async def test_deleted_entry_is_detected(db_session: AsyncSession):
    logs = await _write(db_session, uuid.uuid4().hex[:8])
    await db_session.execute(delete(AuditLog).where(AuditLog.id == logs[1].id))
    result = await audit_chain.verify_chain(db_session)
    assert not result["valid"]
    assert result["problem"] == "中間少了紀錄" and result["broken_at"] == logs[1].chain_seq
    await db_session.rollback()


async def test_concurrent_writers_keep_one_unbroken_chain():
    marker = uuid.uuid4().hex[:8]

    async def one(i: int):
        async with TestingSessionLocal() as db:
            await write_audit_log(db=db, action=AuditAction.LOGIN_FAILED, resource_type=AuditResource.AUTH,
                                  description=f"同時寫入 {marker} {i}")

    await asyncio.gather(*(one(i) for i in range(12)))
    async with TestingSessionLocal() as db:
        seqs = (await db.execute(select(AuditLog.chain_seq).where(AuditLog.description.like(f"同時寫入 {marker}%")))).scalars().all()
        assert len(seqs) == 12 and len(set(seqs)) == 12
        assert (await audit_chain.verify_chain(db))["valid"]


async def test_verify_endpoint_is_admin_only(async_client: AsyncClient, admin_auth_headers: dict, user_auth_headers: dict):
    ok = await async_client.get(f"{API}/audit-logs/verify-chain", headers=admin_auth_headers)
    assert ok.status_code == 200 and ok.json()["valid"] is True
    denied = await async_client.get(f"{API}/audit-logs/verify-chain", headers=user_auth_headers)
    assert denied.status_code == 403
