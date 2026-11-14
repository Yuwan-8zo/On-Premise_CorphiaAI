"""
權限與帳號安全測試 (test_permissions.py)

- 強制踢出後，refresh token 也要失效（前端會自動刷新，不擋的話踢出等於沒踢）
- 修改密碼後，其他裝置的登入失效，本次回傳的新 token 可以用
- 角色：租戶管理員不能建立／修改／刪除 engineer，不能停用自己；角色值要合法
- 一般使用者不能查看別人的資料
- 帳號沒有指定租戶（tenant_id 為空）視為 default 租戶：管理員看得到、管得到
"""

import uuid

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, create_refresh_token, get_password_hash
from app.models.tenant import Tenant
from app.models.user import User

API = "/api/v1"


def bearer(user: User) -> dict:
    return {"Authorization": f"Bearer {create_access_token({'sub': user.id})}"}


async def make_user(db: AsyncSession, role: str, tenant_id, password: str = "TestPass123!") -> User:
    u = User(
        id=str(uuid.uuid4()),
        email=f"{role}_{uuid.uuid4().hex[:6]}@test.com",
        password_hash=get_password_hash(password),
        name=role,
        role=role,
        tenant_id=tenant_id,
        is_active=True,
    )
    db.add(u)
    await db.flush()
    return u


@pytest_asyncio.fixture
async def default_tenant(db_session: AsyncSession) -> Tenant:
    t = await db_session.get(Tenant, "default")
    if t is None:
        t = Tenant(id="default", name="Default", slug="default")
        db_session.add(t)
        await db_session.flush()
    return t


class TestForceLogout:
    async def test_refresh_token_rejected_after_force_logout(
        self, async_client: AsyncClient, db_session: AsyncSession, test_admin: User, test_tenant: Tenant
    ):
        victim = await make_user(db_session, "user", test_tenant.id)
        refresh = create_refresh_token({"sub": victim.id})
        r = await async_client.post(f"{API}/users/{victim.id}/force-logout", headers=bearer(test_admin))
        assert r.status_code == 200
        r = await async_client.post(f"{API}/auth/refresh", json={"refresh_token": refresh})
        assert r.status_code == 401

    async def test_new_login_after_force_logout_works(
        self, async_client: AsyncClient, db_session: AsyncSession, test_admin: User, test_tenant: Tenant
    ):
        victim = await make_user(db_session, "user", test_tenant.id)
        await async_client.post(f"{API}/users/{victim.id}/force-logout", headers=bearer(test_admin))
        r = await async_client.post(f"{API}/auth/login", json={"email": victim.email, "password": "TestPass123!"})
        assert r.status_code == 200
        me = await async_client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {r.json()['access_token']}"})
        assert me.status_code == 200


class TestPasswordChangeSessions:
    async def test_other_sessions_revoked_new_tokens_work(
        self, async_client: AsyncClient, db_session: AsyncSession, test_tenant: Tenant
    ):
        u = await make_user(db_session, "user", test_tenant.id)
        other_device_refresh = create_refresh_token({"sub": u.id})
        r = await async_client.post(
            f"{API}/auth/change-password",
            json={"current_password": "TestPass123!", "new_password": "NewPass456@"},
            headers=bearer(u),
        )
        assert r.status_code == 200
        body = r.json()
        assert body.get("access_token") and body.get("refresh_token")
        # 這次回傳的新 token 可以用
        me = await async_client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
        assert me.status_code == 200
        # 其他裝置的 refresh token 失效
        r = await async_client.post(f"{API}/auth/refresh", json={"refresh_token": other_device_refresh})
        assert r.status_code == 401


class TestRoles:
    async def test_admin_cannot_create_engineer(self, async_client: AsyncClient, test_admin: User):
        r = await async_client.post(
            f"{API}/users",
            json={"email": f"e_{uuid.uuid4().hex[:6]}@test.com", "name": "x", "password": "TestPass123!", "role": "engineer"},
            headers=bearer(test_admin),
        )
        assert r.status_code == 403

    async def test_invalid_role_rejected(self, async_client: AsyncClient, test_admin: User):
        r = await async_client.post(
            f"{API}/users",
            json={"email": f"x_{uuid.uuid4().hex[:6]}@test.com", "name": "x", "password": "TestPass123!", "role": "superuser"},
            headers=bearer(test_admin),
        )
        assert r.status_code == 422

    async def test_admin_can_create_user(self, async_client: AsyncClient, test_admin: User):
        r = await async_client.post(
            f"{API}/users",
            json={"email": f"u_{uuid.uuid4().hex[:6]}@test.com", "name": "x", "password": "TestPass123!", "role": "user"},
            headers=bearer(test_admin),
        )
        assert r.status_code == 201

    async def test_admin_cannot_touch_engineer(
        self, async_client: AsyncClient, db_session: AsyncSession, test_admin: User, test_tenant: Tenant
    ):
        eng = await make_user(db_session, "engineer", test_tenant.id)
        h = bearer(test_admin)
        assert (await async_client.put(f"{API}/users/{eng.id}", json={"is_active": False}, headers=h)).status_code == 403
        assert (await async_client.delete(f"{API}/users/{eng.id}", headers=h)).status_code == 403
        assert (await async_client.post(f"{API}/users/{eng.id}/force-logout", headers=h)).status_code == 403

    async def test_admin_cannot_deactivate_self(self, async_client: AsyncClient, test_admin: User):
        r = await async_client.put(f"{API}/users/{test_admin.id}", json={"is_active": False}, headers=bearer(test_admin))
        assert r.status_code == 400


class TestUserVisibility:
    async def test_user_cannot_view_other_user(
        self, async_client: AsyncClient, db_session: AsyncSession, test_user: User, test_admin: User
    ):
        r = await async_client.get(f"{API}/users/{test_admin.id}", headers=bearer(test_user))
        assert r.status_code in (403, 404)

    async def test_user_can_view_self(self, async_client: AsyncClient, test_user: User):
        r = await async_client.get(f"{API}/users/{test_user.id}", headers=bearer(test_user))
        assert r.status_code == 200


class TestDefaultTenant:
    async def test_admin_sees_and_manages_tenantless_users(
        self, async_client: AsyncClient, db_session: AsyncSession, default_tenant: Tenant
    ):
        admin = await make_user(db_session, "admin", "default")
        loose = await make_user(db_session, "user", None)
        h = bearer(admin)
        r = await async_client.get(f"{API}/users", params={"search": loose.email}, headers=h)
        assert r.status_code == 200
        assert [u["id"] for u in r.json()["data"]] == [loose.id]
        assert (await async_client.post(f"{API}/users/{loose.id}/force-logout", headers=h)).status_code == 200

    async def test_tenantless_admin_does_not_see_other_tenants(
        self, async_client: AsyncClient, db_session: AsyncSession, default_tenant: Tenant, test_tenant: Tenant
    ):
        admin = await make_user(db_session, "admin", None)
        other = await make_user(db_session, "user", test_tenant.id)
        r = await async_client.get(f"{API}/admin/user-lockout-summary", headers=bearer(admin))
        assert r.status_code == 200
        ids = [row["user_id"] for row in r.json()["data"]]
        assert other.id not in ids


class TestAdminEditUser:
    async def test_admin_changes_role_and_resets_password(
        self, async_client: AsyncClient, db_session: AsyncSession, test_admin: User, test_tenant: Tenant
    ):
        u = await make_user(db_session, "user", test_tenant.id)
        old_refresh = create_refresh_token({"sub": u.id})
        r = await async_client.put(
            f"{API}/users/{u.id}", json={"role": "admin", "password": "Brand9New!x"}, headers=bearer(test_admin)
        )
        assert r.status_code == 200
        assert r.json()["role"] == "admin"
        # 新密碼可以登入、舊的 refresh token 失效
        login = await async_client.post(f"{API}/auth/login", json={"email": u.email, "password": "Brand9New!x"})
        assert login.status_code == 200
        assert (await async_client.post(f"{API}/auth/refresh", json={"refresh_token": old_refresh})).status_code == 401

    async def test_admin_cannot_promote_to_engineer(
        self, async_client: AsyncClient, db_session: AsyncSession, test_admin: User, test_tenant: Tenant
    ):
        u = await make_user(db_session, "user", test_tenant.id)
        r = await async_client.put(f"{API}/users/{u.id}", json={"role": "engineer"}, headers=bearer(test_admin))
        assert r.status_code == 403

    async def test_cannot_change_own_role(self, async_client: AsyncClient, test_admin: User):
        r = await async_client.put(f"{API}/users/{test_admin.id}", json={"role": "user"}, headers=bearer(test_admin))
        assert r.status_code == 400

    async def test_weak_password_rejected(self, async_client: AsyncClient, test_admin: User):
        r = await async_client.post(
            f"{API}/users",
            json={"email": f"w_{uuid.uuid4().hex[:6]}@test.com", "name": "w", "password": "12345678", "role": "user"},
            headers=bearer(test_admin),
        )
        assert r.status_code == 422

    async def test_create_inactive_user(self, async_client: AsyncClient, test_admin: User):
        r = await async_client.post(
            f"{API}/users",
            json={"email": f"i_{uuid.uuid4().hex[:6]}@test.com", "name": "i", "password": "TestPass123!", "role": "user", "is_active": False},
            headers=bearer(test_admin),
        )
        assert r.status_code == 201
        assert r.json()["is_active"] is False


class TestAuditScope:
    async def test_export_matches_list_and_neutralises_formulas(
        self, async_client: AsyncClient, db_session: AsyncSession, default_tenant: Tenant
    ):
        from app.services.audit_service import write_audit_log, AuditAction, AuditResource

        admin = await make_user(db_session, "admin", "default")
        marker = uuid.uuid4().hex[:8]
        # 沒有租戶的登入失敗（信箱欄被塞公式）
        await write_audit_log(
            db=db_session, action=AuditAction.LOGIN_FAILED, resource_type=AuditResource.AUTH,
            user_email=f"=HYPERLINK(\"x\")-{marker}", description=f"登入失敗 {marker}",
        )
        h = bearer(admin)
        listed = await async_client.get(f"{API}/audit-logs", params={"search": marker}, headers=h)
        assert listed.status_code == 200 and listed.json()["total"] == 1
        csv_r = await async_client.get(f"{API}/audit-logs/export/csv", params={"search": marker}, headers=h)
        assert csv_r.status_code == 200
        rows = [line for line in csv_r.text.splitlines() if marker in line]
        assert len(rows) == 1
        assert "'=HYPERLINK" in rows[0]

    async def test_end_date_includes_whole_day(
        self, async_client: AsyncClient, db_session: AsyncSession, default_tenant: Tenant
    ):
        from app.core.time_utils import utc_now_naive
        from app.services.audit_service import write_audit_log, AuditAction, AuditResource

        admin = await make_user(db_session, "admin", "default")
        marker = uuid.uuid4().hex[:8]
        await write_audit_log(
            db=db_session, action=AuditAction.LOGIN_FAILED, resource_type=AuditResource.AUTH,
            user_email=f"{marker}@x.com", description=f"x {marker}",
        )
        today = utc_now_naive().date().isoformat()
        r = await async_client.get(
            f"{API}/audit-logs", params={"search": marker, "start_date": today, "end_date": today}, headers=bearer(admin)
        )
        assert r.json()["total"] == 1


class TestTenants:
    async def test_admin_cannot_create_or_disable_tenant(
        self, async_client: AsyncClient, test_admin: User, test_tenant: Tenant
    ):
        h = bearer(test_admin)
        r = await async_client.post(f"{API}/tenants", json={"name": "x", "slug": f"x-{uuid.uuid4().hex[:6]}"}, headers=h)
        assert r.status_code == 403
        assert (await async_client.delete(f"{API}/tenants/{test_tenant.id}", headers=h)).status_code == 403
        r = await async_client.put(f"{API}/tenants/{test_tenant.id}", json={"is_active": False}, headers=h)
        assert r.status_code == 403

    async def test_admin_sees_and_edits_only_own_tenant(
        self, async_client: AsyncClient, db_session: AsyncSession, test_admin: User, test_tenant: Tenant
    ):
        other = Tenant(id=str(uuid.uuid4()), name="Other", slug=f"o-{uuid.uuid4().hex[:6]}")
        db_session.add(other)
        await db_session.flush()
        h = bearer(test_admin)
        ids = [t["id"] for t in (await async_client.get(f"{API}/tenants", headers=h)).json()["data"]]
        assert ids == [test_tenant.id]
        assert (await async_client.put(f"{API}/tenants/{other.id}", json={"name": "hacked"}, headers=h)).status_code == 404
        assert (await async_client.put(f"{API}/tenants/{test_tenant.id}", json={"name": "Renamed"}, headers=h)).status_code == 200

    async def test_engineer_creates_tenant(self, async_client: AsyncClient, engineer_auth_headers: dict):
        r = await async_client.post(
            f"{API}/tenants", json={"name": "New", "slug": f"n-{uuid.uuid4().hex[:6]}"}, headers=engineer_auth_headers
        )
        assert r.status_code == 200

    async def test_disabled_tenant_blocks_users(
        self, async_client: AsyncClient, db_session: AsyncSession
    ):
        t = Tenant(id=str(uuid.uuid4()), name="Off", slug=f"off-{uuid.uuid4().hex[:6]}", is_active=False)
        db_session.add(t)
        await db_session.flush()
        u = await make_user(db_session, "user", t.id)
        assert (await async_client.get(f"{API}/auth/me", headers=bearer(u))).status_code == 403
        r = await async_client.post(f"{API}/auth/login", json={"email": u.email, "password": "TestPass123!"})
        assert r.status_code == 403


class TestDocumentPermissions:
    async def _doc(self, db: AsyncSession, owner: User, folder: str):
        from app.models.document import Document

        d = Document(
            id=str(uuid.uuid4()), tenant_id=owner.tenant_id, uploaded_by=owner.id,
            filename=f"{uuid.uuid4().hex}.txt", original_filename="a.txt", file_path="x", file_size=1,
            file_type="txt", status="completed",
            doc_metadata={"folderName": folder, "isActive": True},
        )
        db.add(d)
        await db.flush()
        return d

    async def test_other_user_cannot_change_document_settings(
        self, async_client: AsyncClient, db_session: AsyncSession, test_tenant: Tenant
    ):
        owner = await make_user(db_session, "user", test_tenant.id)
        other = await make_user(db_session, "user", test_tenant.id)
        doc = await self._doc(db_session, owner, "P")
        body = {"doc_metadata": {"folderName": "P", "isActive": False}}
        # 別人的文件當作不存在（404），不透露「有這份文件但你沒權限」
        assert (await async_client.patch(f"{API}/documents/{doc.id}/metadata", json=body, headers=bearer(other))).status_code == 404
        assert (await async_client.patch(f"{API}/documents/{doc.id}/metadata", json=body, headers=bearer(owner))).status_code == 200

    async def test_folder_list_is_personal(
        self, async_client: AsyncClient, db_session: AsyncSession, test_tenant: Tenant
    ):
        a = await make_user(db_session, "user", test_tenant.id)
        b = await make_user(db_session, "user", test_tenant.id)
        mine = await self._doc(db_session, a, "同名資料夾")
        await self._doc(db_session, b, "同名資料夾")
        r = await async_client.get(f"{API}/documents", params={"folder": "同名資料夾"}, headers=bearer(a))
        assert r.status_code == 200
        assert [d["id"] for d in r.json()["data"]] == [mine.id]

    async def test_bad_paging_rejected(self, async_client: AsyncClient, user_auth_headers: dict):
        r = await async_client.get(f"{API}/documents", params={"page": 0}, headers=user_auth_headers)
        assert r.status_code == 422
