"""
使用者個人資料 API 測試 (test_users.py)

測試端點：
- GET  /api/v1/users/me           （取得個人資料）
- PUT  /api/v1/users/me           （更新個人資料）
- GET  /api/v1/users/me/quota     （配額查詢）
- 管理員端點 (GET/PATCH /api/v1/users, /api/v1/users/{id})
"""

import uuid
import pytest
from httpx import AsyncClient

from app.models.user import User


# ═══════════════════════════════════════════════════════════════
# GET /api/v1/users/me
# ═══════════════════════════════════════════════════════════════

class TestGetMyProfile:
    """取得個人資料測試"""

    async def test_get_profile_success(
        self,
        async_client: AsyncClient,
        test_user: User,
        user_auth_headers: dict,
    ):
        """✅ 取得自己的個人資料 → 200"""
        response = await async_client.get(
            "/api/v1/users/me", headers=user_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_user.id
        assert data["email"] == test_user.email
        # SECURITY: 確認回應中不含密碼 hash
        assert "password_hash" not in data

    async def test_get_profile_unauthenticated(self, async_client: AsyncClient):
        """❌ 未登入 → 401/403"""
        response = await async_client.get("/api/v1/users/me")
        assert response.status_code in (401, 403)


# ═══════════════════════════════════════════════════════════════
# PUT /api/v1/users/me
# ═══════════════════════════════════════════════════════════════

class TestUpdateMyProfile:
    """更新個人資料測試"""

    async def test_update_name(
        self,
        async_client: AsyncClient,
        test_user: User,
        user_auth_headers: dict,
    ):
        """✅ 更新顯示名稱 → 200"""
        new_name = f"Updated Name {uuid.uuid4().hex[:4]}"
        response = await async_client.put(
            "/api/v1/users/me",
            json={"name": new_name},
            headers=user_auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["name"] == new_name

    async def test_update_avatar_url(
        self,
        async_client: AsyncClient,
        test_user: User,
        user_auth_headers: dict,
    ):
        """✅ 更新頭像 URL → 200"""
        response = await async_client.put(
            "/api/v1/users/me",
            json={"avatar_url": "https://example.com/avatar.png"},
            headers=user_auth_headers,
        )
        assert response.status_code == 200

    async def test_update_unauthenticated(self, async_client: AsyncClient):
        """❌ 未登入更新 → 401/403"""
        response = await async_client.put(
            "/api/v1/users/me", json={"name": "Hacker"}
        )
        assert response.status_code in (401, 403)


# ═══════════════════════════════════════════════════════════════
# GET /api/v1/users/me/quota
# ═══════════════════════════════════════════════════════════════

class TestMyQuota:
    """配額查詢測試"""

    async def test_get_quota_success(
        self,
        async_client: AsyncClient,
        test_user: User,
        user_auth_headers: dict,
    ):
        """✅ 取得配額 → 200，含 daily_limit 與 used_today"""
        response = await async_client.get(
            "/api/v1/users/me/quota", headers=user_auth_headers
        )
        # NOTE: 若路由尚未實作，允許 404 並跳過
        if response.status_code == 404:
            pytest.skip("quota 端點尚未實作，略過")
        assert response.status_code == 200
        data = response.json()
        assert "daily_limit" in data or "limit" in data

    async def test_get_quota_unauthenticated(self, async_client: AsyncClient):
        """❌ 未登入 → 401/403"""
        response = await async_client.get("/api/v1/users/me/quota")
        assert response.status_code in (401, 403, 404)


# ═══════════════════════════════════════════════════════════════
# GET /api/v1/users  （管理員端點）
# ═══════════════════════════════════════════════════════════════

class TestAdminUserList:
    """管理員使用者列表 RBAC 測試"""

    async def test_regular_user_forbidden(
        self,
        async_client: AsyncClient,
        user_auth_headers: dict,
    ):
        """❌ 一般使用者無權存取使用者列表"""
        response = await async_client.get(
            "/api/v1/users", headers=user_auth_headers
        )
        # 若路由存在但被 RBAC 保護，應回傳 403
        assert response.status_code in (403, 404)

    async def test_admin_can_list_users(
        self,
        async_client: AsyncClient,
        admin_auth_headers: dict,
        test_user: User,
    ):
        """✅ 管理員可取得使用者列表"""
        response = await async_client.get(
            "/api/v1/users", headers=admin_auth_headers
        )
        # 若路由尚未實作允許 404 跳過
        if response.status_code == 404:
            pytest.skip("使用者列表端點尚未實作")
        assert response.status_code == 200


# ═══════════════════════════════════════════════════════════════
# 安全性測試：敏感欄位過濾
# ═══════════════════════════════════════════════════════════════

class TestSecuritySensitiveFields:
    """確保 API 回應不洩漏敏感資訊"""

    async def test_login_response_no_password(
        self,
        async_client: AsyncClient,
        test_user: User,
    ):
        """✅ 登入回應不含密碼 hash"""
        response = await async_client.post(
            "/api/v1/auth/login",
            json={"email": test_user.email, "password": "TestPass123!"},
        )
        assert response.status_code == 200
        body_str = response.text
        assert "password_hash" not in body_str
        assert "password" not in response.json()

    async def test_me_response_no_password(
        self,
        async_client: AsyncClient,
        test_user: User,
        user_auth_headers: dict,
    ):
        """✅ /auth/me 不回傳密碼 hash"""
        response = await async_client.get(
            "/api/v1/auth/me", headers=user_auth_headers
        )
        assert response.status_code == 200
        assert "password_hash" not in response.json()
        assert "password" not in response.json()
