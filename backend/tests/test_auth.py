"""
認證 API 測試 (test_auth.py)

測試端點：
- POST /api/v1/auth/login
- POST /api/v1/auth/register
- POST /api/v1/auth/refresh
- POST /api/v1/auth/logout
- GET  /api/v1/auth/me
- POST /api/v1/auth/change-password
"""

import pytest
from httpx import AsyncClient

from app.models.user import User
from app.core.security import create_access_token, create_refresh_token


# ═══════════════════════════════════════════════════════════════
# POST /api/v1/auth/login
# ═══════════════════════════════════════════════════════════════

class TestLogin:
    """登入相關測試"""

    async def test_login_success(self, async_client: AsyncClient, test_user: User):
        """✅ 正確帳密 → 200，回傳 access_token"""
        response = await async_client.post(
            "/api/v1/auth/login",
            json={"email": test_user.email, "password": "TestPass123!"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert data["expires_in"] > 0

    async def test_login_wrong_password(self, async_client: AsyncClient, test_user: User):
        """❌ 密碼錯誤 → 401"""
        response = await async_client.post(
            "/api/v1/auth/login",
            json={"email": test_user.email, "password": "WrongPass999!"},
        )
        assert response.status_code == 401

    async def test_login_nonexistent_email(self, async_client: AsyncClient):
        """❌ 不存在的帳號 → 401"""
        response = await async_client.post(
            "/api/v1/auth/login",
            json={"email": "nobody@nowhere.com", "password": "SomePass123!"},
        )
        assert response.status_code == 401

    async def test_login_missing_fields(self, async_client: AsyncClient):
        """❌ 缺少必填欄位 → 422"""
        response = await async_client.post("/api/v1/auth/login", json={})
        assert response.status_code == 422

    async def test_login_invalid_email_format(self, async_client: AsyncClient):
        """❌ email 格式錯誤 → 422"""
        response = await async_client.post(
            "/api/v1/auth/login",
            json={"email": "not-an-email", "password": "SomePass123!"},
        )
        assert response.status_code == 422

    async def test_login_inactive_user(
        self, async_client: AsyncClient, test_user: User, db_session
    ):
        """❌ 停用帳號嘗試登入 → 403"""
        test_user.is_active = False
        await db_session.flush()

        response = await async_client.post(
            "/api/v1/auth/login",
            json={"email": test_user.email, "password": "TestPass123!"},
        )
        assert response.status_code == 403


# ═══════════════════════════════════════════════════════════════
# POST /api/v1/auth/register
# ═══════════════════════════════════════════════════════════════

class TestRegister:
    """註冊相關測試"""

    async def test_register_success(self, async_client: AsyncClient, test_tenant):
        """✅ 正常註冊 → 201，回傳使用者物件"""
        response = await async_client.post(
            "/api/v1/auth/register",
            json={
                "email": f"newuser_{id(self)}@test.com",
                "password": "ValidPass123!",
                "name": "New User",
                "tenant_slug": test_tenant.slug,
            },
        )
        assert response.status_code == 200  # register 回傳 UserResponse，無 201
        data = response.json()
        assert "id" in data
        assert "email" in data

    async def test_register_duplicate_email(
        self, async_client: AsyncClient, test_user: User
    ):
        """❌ Email 已被使用 → 400"""
        response = await async_client.post(
            "/api/v1/auth/register",
            json={
                "email": test_user.email,
                "password": "AnotherPass123!",
                "name": "Duplicate",
            },
        )
        assert response.status_code == 400

    async def test_register_invalid_tenant(self, async_client: AsyncClient):
        """❌ 不存在的租戶 slug → 400"""
        response = await async_client.post(
            "/api/v1/auth/register",
            json={
                "email": "valid@test.com",
                "password": "ValidPass123!",
                "name": "Test",
                "tenant_slug": "nonexistent-tenant-slug",
            },
        )
        assert response.status_code == 400

    async def test_register_missing_email(self, async_client: AsyncClient):
        """❌ 缺少 email → 422"""
        response = await async_client.post(
            "/api/v1/auth/register",
            json={"password": "ValidPass123!", "name": "Test"},
        )
        assert response.status_code == 422


# ═══════════════════════════════════════════════════════════════
# POST /api/v1/auth/refresh
# ═══════════════════════════════════════════════════════════════

class TestTokenRefresh:
    """Token 刷新相關測試"""

    async def test_refresh_success(self, async_client: AsyncClient, test_user: User):
        """✅ 有效 refresh_token → 200，取得新 Token"""
        refresh_token = create_refresh_token({"sub": test_user.id})
        response = await async_client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh_token},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data

    async def test_refresh_with_invalid_token(self, async_client: AsyncClient):
        """❌ 無效的 token 字串 → 401"""
        response = await async_client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": "invalid.token.string"},
        )
        assert response.status_code == 401

    async def test_refresh_with_access_token(
        self, async_client: AsyncClient, test_user: User
    ):
        """❌ 用 access_token 刷新（類型錯誤）→ 401"""
        access_token = create_access_token({"sub": test_user.id})
        response = await async_client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": access_token},
        )
        assert response.status_code == 401


# ═══════════════════════════════════════════════════════════════
# GET /api/v1/auth/me
# ═══════════════════════════════════════════════════════════════

class TestGetMe:
    """取得當前使用者資訊測試"""

    async def test_get_me_success(
        self,
        async_client: AsyncClient,
        test_user: User,
        user_auth_headers: dict,
    ):
        """✅ 有效 token → 200，回傳使用者資訊"""
        response = await async_client.get(
            "/api/v1/auth/me", headers=user_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == test_user.email
        assert data["id"] == test_user.id

    async def test_get_me_no_token(self, async_client: AsyncClient):
        """❌ 未提供 token → 403"""
        response = await async_client.get("/api/v1/auth/me")
        assert response.status_code in (401, 403)

    async def test_get_me_invalid_token(self, async_client: AsyncClient):
        """❌ 偽造 token → 401/403"""
        response = await async_client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer fake.token.here"},
        )
        assert response.status_code in (401, 403)


# ═══════════════════════════════════════════════════════════════
# POST /api/v1/auth/logout
# ═══════════════════════════════════════════════════════════════

class TestLogout:
    """登出相關測試"""

    async def test_logout_success(
        self,
        async_client: AsyncClient,
        test_user: User,
        user_auth_headers: dict,
    ):
        """✅ 登出成功 → 200"""
        response = await async_client.post(
            "/api/v1/auth/logout", headers=user_auth_headers
        )
        assert response.status_code == 200
        assert response.json()["message"] == "登出成功"

    async def test_logout_without_token(self, async_client: AsyncClient):
        """❌ 未攜帶 token → 403"""
        response = await async_client.post("/api/v1/auth/logout")
        assert response.status_code in (401, 403)


# ═══════════════════════════════════════════════════════════════
# POST /api/v1/auth/change-password
# ═══════════════════════════════════════════════════════════════

class TestChangePassword:
    """修改密碼相關測試"""

    async def test_change_password_success(
        self,
        async_client: AsyncClient,
        test_user: User,
        user_auth_headers: dict,
    ):
        """✅ 正確當前密碼 → 200"""
        response = await async_client.post(
            "/api/v1/auth/change-password",
            json={
                "current_password": "TestPass123!",
                "new_password": "NewPass456@",
            },
            headers=user_auth_headers,
        )
        assert response.status_code == 200

    async def test_change_password_wrong_current(
        self,
        async_client: AsyncClient,
        test_user: User,
        user_auth_headers: dict,
    ):
        """❌ 當前密碼錯誤 → 400"""
        response = await async_client.post(
            "/api/v1/auth/change-password",
            json={
                "current_password": "WrongOldPass!",
                "new_password": "NewPass789#",
            },
            headers=user_auth_headers,
        )
        assert response.status_code == 400

    async def test_change_password_same_as_old(
        self,
        async_client: AsyncClient,
        test_user: User,
        user_auth_headers: dict,
    ):
        """❌ 新密碼與舊密碼相同 → 400"""
        response = await async_client.post(
            "/api/v1/auth/change-password",
            json={
                "current_password": "TestPass123!",
                "new_password": "TestPass123!",
            },
            headers=user_auth_headers,
        )
        assert response.status_code == 400
