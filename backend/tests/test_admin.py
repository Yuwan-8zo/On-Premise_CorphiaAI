"""
管理員 API 測試 (test_admin.py)

測試重點：RBAC 權限控制
- 一般使用者（user role）存取 /api/v1/admin/* → 403
- 管理員（admin/engineer）可正常存取
"""

import pytest
from httpx import AsyncClient

from app.models.user import User


# ═══════════════════════════════════════════════════════════════
# GET /api/v1/admin/stats
# ═══════════════════════════════════════════════════════════════

class TestAdminStats:
    """管理員統計資料 RBAC 測試"""

    async def test_regular_user_forbidden(
        self,
        async_client: AsyncClient,
        test_user: User,
        user_auth_headers: dict,
    ):
        """❌ 一般使用者存取 /admin/stats → 403"""
        response = await async_client.get(
            "/api/v1/admin/stats", headers=user_auth_headers
        )
        assert response.status_code == 403

    async def test_admin_allowed(
        self,
        async_client: AsyncClient,
        test_admin: User,
        admin_auth_headers: dict,
    ):
        """✅ 管理員存取 /admin/stats → 200"""
        response = await async_client.get(
            "/api/v1/admin/stats", headers=admin_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "totalUsers" in data["data"]
        assert "totalConversations" in data["data"]
        assert "totalDocuments" in data["data"]
        assert "totalMessages" in data["data"]

    async def test_engineer_allowed(
        self,
        async_client: AsyncClient,
        test_engineer: User,
        engineer_auth_headers: dict,
    ):
        """✅ Engineer 存取 /admin/stats → 200"""
        response = await async_client.get(
            "/api/v1/admin/stats", headers=engineer_auth_headers
        )
        assert response.status_code == 200

    async def test_unauthenticated_forbidden(self, async_client: AsyncClient):
        """❌ 未登入存取 /admin/stats → 401/403"""
        response = await async_client.get("/api/v1/admin/stats")
        assert response.status_code in (401, 403)


# ═══════════════════════════════════════════════════════════════
# GET /api/v1/admin/system/info
# ═══════════════════════════════════════════════════════════════

class TestAdminSystemInfo:
    """系統資訊端點 RBAC 測試"""

    async def test_regular_user_forbidden(
        self,
        async_client: AsyncClient,
        user_auth_headers: dict,
    ):
        """❌ 一般使用者 → 403"""
        response = await async_client.get(
            "/api/v1/admin/system/info", headers=user_auth_headers
        )
        assert response.status_code == 403

    async def test_admin_allowed(
        self,
        async_client: AsyncClient,
        admin_auth_headers: dict,
    ):
        """✅ 管理員 → 200，含硬體資訊"""
        response = await async_client.get(
            "/api/v1/admin/system/info", headers=admin_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        # 確認回傳的系統資訊欄位
        assert "cpu_usage_percent" in data["data"]
        assert "memory_total_mb" in data["data"]
        assert "python_version" in data["data"]


# ═══════════════════════════════════════════════════════════════
# GET /api/v1/admin/quota/overview
# ═══════════════════════════════════════════════════════════════

class TestAdminQuotaOverview:
    """配額概覽 RBAC 測試"""

    async def test_regular_user_forbidden(
        self,
        async_client: AsyncClient,
        user_auth_headers: dict,
    ):
        """❌ 一般使用者 → 403"""
        response = await async_client.get(
            "/api/v1/admin/quota/overview", headers=user_auth_headers
        )
        assert response.status_code == 403

    async def test_admin_allowed(
        self,
        async_client: AsyncClient,
        admin_auth_headers: dict,
        test_user: User,
    ):
        """✅ 管理員取得配額概覽 → 200，含使用者配額資料"""
        response = await async_client.get(
            "/api/v1/admin/quota/overview", headers=admin_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert isinstance(data["data"], list)
        # 每筆資料應含必要欄位
        if data["data"]:
            item = data["data"][0]
            assert "email" in item
            assert "daily_limit" in item
            assert "used_today" in item


# ═══════════════════════════════════════════════════════════════
# GET /api/v1/admin/rate-limit/stats
# ═══════════════════════════════════════════════════════════════

class TestAdminRateLimit:
    """速率限制統計 RBAC 測試"""

    async def test_regular_user_forbidden(
        self,
        async_client: AsyncClient,
        user_auth_headers: dict,
    ):
        """❌ 一般使用者 → 403"""
        response = await async_client.get(
            "/api/v1/admin/rate-limit/stats", headers=user_auth_headers
        )
        assert response.status_code == 403

    async def test_admin_allowed(
        self,
        async_client: AsyncClient,
        admin_auth_headers: dict,
    ):
        """✅ 管理員 → 200"""
        response = await async_client.get(
            "/api/v1/admin/rate-limit/stats", headers=admin_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"


# ═══════════════════════════════════════════════════════════════
# POST /api/v1/admin/cache/clear
# ═══════════════════════════════════════════════════════════════

class TestAdminCacheClear:
    """快取清除 RBAC 測試"""

    async def test_regular_user_forbidden(
        self,
        async_client: AsyncClient,
        user_auth_headers: dict,
    ):
        """❌ 一般使用者 → 403"""
        response = await async_client.post(
            "/api/v1/admin/cache/clear", headers=user_auth_headers
        )
        assert response.status_code == 403

    async def test_admin_allowed(
        self,
        async_client: AsyncClient,
        admin_auth_headers: dict,
    ):
        """✅ 管理員清除快取 → 200"""
        response = await async_client.post(
            "/api/v1/admin/cache/clear", headers=admin_auth_headers
        )
        assert response.status_code == 200
        assert response.json()["status"] == "success"
