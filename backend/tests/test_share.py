"""
分享對話（同租戶唯讀）(test_share.py)
"""
import uuid

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, get_password_hash
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.tenant import Tenant
from app.models.user import User

API = "/api/v1"


def bearer(user: User) -> dict:
    return {"Authorization": f"Bearer {create_access_token({'sub': user.id})}"}


async def make_user(db: AsyncSession, tenant_id) -> User:
    u = User(id=str(uuid.uuid4()), email=f"s_{uuid.uuid4().hex[:6]}@test.com", password_hash=get_password_hash("TestPass123!"),
             name="s", role="user", tenant_id=tenant_id, is_active=True)
    db.add(u)
    await db.flush()
    return u


async def test_share_flow(async_client: AsyncClient, db_session: AsyncSession, test_tenant: Tenant):
    owner = await make_user(db_session, test_tenant.id)
    colleague = await make_user(db_session, test_tenant.id)
    other_tenant = Tenant(id=str(uuid.uuid4()), name="Other", slug=f"o-{uuid.uuid4().hex[:6]}")
    db_session.add(other_tenant)
    await db_session.flush()
    outsider = await make_user(db_session, other_tenant.id)

    conv = Conversation(id=str(uuid.uuid4()), user_id=owner.id, tenant_id=test_tenant.id, title="分享測試")
    db_session.add(conv)
    await db_session.flush()
    db_session.add(Message(id=str(uuid.uuid4()), conversation_id=conv.id, role="user", content="hi"))
    await db_session.flush()
    url = f"{API}/conversations/{conv.id}/shared"

    # 還沒分享：只有主人看得到
    assert (await async_client.get(url, headers=bearer(owner))).status_code == 200
    assert (await async_client.get(url, headers=bearer(colleague))).status_code == 404

    # 別人不能幫忙分享
    assert (await async_client.post(f"{API}/conversations/{conv.id}/share", headers=bearer(colleague))).status_code == 404
    assert (await async_client.post(f"{API}/conversations/{conv.id}/share", headers=bearer(owner))).status_code == 200

    r = await async_client.get(url, headers=bearer(colleague))
    assert r.status_code == 200
    body = r.json()
    assert body["is_owner"] is False and len(body["messages"]) == 1
    # 不同租戶還是看不到
    assert (await async_client.get(url, headers=bearer(outsider))).status_code == 404
    # 分享後同事也不能改、不能用一般 API 讀
    assert (await async_client.get(f"{API}/conversations/{conv.id}/messages", headers=bearer(colleague))).status_code == 404

    # 取消分享
    assert (await async_client.delete(f"{API}/conversations/{conv.id}/share", headers=bearer(owner))).status_code == 200
    assert (await async_client.get(url, headers=bearer(colleague))).status_code == 404
