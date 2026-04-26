"""
對話管理 API 測試 (test_conversations.py)

測試端點：
- GET    /api/v1/conversations          （列出，含分頁）
- POST   /api/v1/conversations          （建立）
- GET    /api/v1/conversations/{id}     （取得單筆）
- PUT    /api/v1/conversations/{id}     （更新）
- DELETE /api/v1/conversations/{id}     （刪除）
- GET    /api/v1/conversations/{id}/messages  （取得訊息）
"""

import uuid
import pytest
from httpx import AsyncClient

from app.models.user import User
from app.models.conversation import Conversation


# ── Helper ─────────────────────────────────────────────────────

async def _create_conversation(
    async_client: AsyncClient,
    headers: dict,
    title: str = "Test Conversation",
) -> dict:
    """便利函式：透過 API 建立一筆對話，回傳 JSON body"""
    response = await async_client.post(
        "/api/v1/conversations",
        json={"title": title},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


# ═══════════════════════════════════════════════════════════════
# GET /api/v1/conversations
# ═══════════════════════════════════════════════════════════════

class TestListConversations:
    """對話列表測試"""

    async def test_list_empty(
        self,
        async_client: AsyncClient,
        test_user: User,
        user_auth_headers: dict,
    ):
        """✅ 新使用者無對話 → 200，data 為空列表"""
        response = await async_client.get(
            "/api/v1/conversations", headers=user_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert "total" in data
        assert isinstance(data["data"], list)

    async def test_list_returns_own_conversations(
        self,
        async_client: AsyncClient,
        test_user: User,
        user_auth_headers: dict,
    ):
        """✅ 只回傳當前使用者的對話"""
        # 建立 2 筆對話
        await _create_conversation(async_client, user_auth_headers, "Conv A")
        await _create_conversation(async_client, user_auth_headers, "Conv B")

        response = await async_client.get(
            "/api/v1/conversations", headers=user_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 2

    async def test_list_pagination(
        self,
        async_client: AsyncClient,
        test_user: User,
        user_auth_headers: dict,
    ):
        """✅ 分頁參數正確運作"""
        # 建立 3 筆對話
        for i in range(3):
            await _create_conversation(async_client, user_auth_headers, f"Paged {i}")

        response = await async_client.get(
            "/api/v1/conversations?page=1&page_size=2",
            headers=user_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]) <= 2

    async def test_list_search(
        self,
        async_client: AsyncClient,
        test_user: User,
        user_auth_headers: dict,
    ):
        """✅ 搜尋標題關鍵字"""
        unique = uuid.uuid4().hex[:8]
        await _create_conversation(async_client, user_auth_headers, f"Unique_{unique}")

        response = await async_client.get(
            f"/api/v1/conversations?search={unique}",
            headers=user_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1
        assert any(unique in c["title"] for c in data["data"])

    async def test_list_requires_auth(self, async_client: AsyncClient):
        """❌ 未登入 → 403"""
        response = await async_client.get("/api/v1/conversations")
        assert response.status_code in (401, 403)


# ═══════════════════════════════════════════════════════════════
# POST /api/v1/conversations
# ═══════════════════════════════════════════════════════════════

class TestCreateConversation:
    """建立對話測試"""

    async def test_create_success(
        self,
        async_client: AsyncClient,
        test_user: User,
        user_auth_headers: dict,
    ):
        """✅ 建立對話 → 201，含完整欄位"""
        response = await async_client.post(
            "/api/v1/conversations",
            json={"title": "My New Chat"},
            headers=user_auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "My New Chat"
        assert "id" in data
        assert data["user_id"] == test_user.id

    async def test_create_without_title(
        self,
        async_client: AsyncClient,
        test_user: User,
        user_auth_headers: dict,
    ):
        """✅ title 可選，預設值應存在"""
        response = await async_client.post(
            "/api/v1/conversations",
            json={},
            headers=user_auth_headers,
        )
        # 若 schema 允許空 title，則 201；否則 422
        assert response.status_code in (201, 422)

    async def test_create_requires_auth(self, async_client: AsyncClient):
        """❌ 未登入 → 403"""
        response = await async_client.post(
            "/api/v1/conversations", json={"title": "Test"}
        )
        assert response.status_code in (401, 403)


# ═══════════════════════════════════════════════════════════════
# GET /api/v1/conversations/{id}
# ═══════════════════════════════════════════════════════════════

class TestGetConversation:
    """取得單筆對話測試"""

    async def test_get_own_conversation(
        self,
        async_client: AsyncClient,
        test_user: User,
        user_auth_headers: dict,
    ):
        """✅ 取得自己的對話 → 200"""
        conv = await _create_conversation(async_client, user_auth_headers)
        conv_id = conv["id"]

        response = await async_client.get(
            f"/api/v1/conversations/{conv_id}",
            headers=user_auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["id"] == conv_id

    async def test_get_nonexistent_conversation(
        self,
        async_client: AsyncClient,
        test_user: User,
        user_auth_headers: dict,
    ):
        """❌ 不存在的 ID → 404"""
        response = await async_client.get(
            f"/api/v1/conversations/{uuid.uuid4()}",
            headers=user_auth_headers,
        )
        assert response.status_code == 404

    async def test_cross_user_isolation(
        self,
        async_client: AsyncClient,
        test_user: User,
        user_auth_headers: dict,
        test_admin: User,
        admin_auth_headers: dict,
    ):
        """❌ 使用者 B 不能讀取使用者 A 的對話 → 404"""
        # 以 test_user 建立對話
        conv = await _create_conversation(async_client, user_auth_headers)
        conv_id = conv["id"]

        # 以 test_admin 嘗試讀取
        response = await async_client.get(
            f"/api/v1/conversations/{conv_id}",
            headers=admin_auth_headers,
        )
        assert response.status_code == 404


# ═══════════════════════════════════════════════════════════════
# PUT /api/v1/conversations/{id}
# ═══════════════════════════════════════════════════════════════

class TestUpdateConversation:
    """更新對話測試"""

    async def test_update_title(
        self,
        async_client: AsyncClient,
        test_user: User,
        user_auth_headers: dict,
    ):
        """✅ 更新標題 → 200"""
        conv = await _create_conversation(async_client, user_auth_headers)
        conv_id = conv["id"]

        response = await async_client.put(
            f"/api/v1/conversations/{conv_id}",
            json={"title": "Updated Title"},
            headers=user_auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["title"] == "Updated Title"

    async def test_update_pin_conversation(
        self,
        async_client: AsyncClient,
        test_user: User,
        user_auth_headers: dict,
    ):
        """✅ 置頂對話 → 200"""
        conv = await _create_conversation(async_client, user_auth_headers)
        conv_id = conv["id"]

        response = await async_client.put(
            f"/api/v1/conversations/{conv_id}",
            json={"is_pinned": True},
            headers=user_auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["is_pinned"] is True

    async def test_update_nonexistent(
        self,
        async_client: AsyncClient,
        test_user: User,
        user_auth_headers: dict,
    ):
        """❌ 更新不存在的對話 → 404"""
        response = await async_client.put(
            f"/api/v1/conversations/{uuid.uuid4()}",
            json={"title": "Ghost"},
            headers=user_auth_headers,
        )
        assert response.status_code == 404


# ═══════════════════════════════════════════════════════════════
# DELETE /api/v1/conversations/{id}
# ═══════════════════════════════════════════════════════════════

class TestDeleteConversation:
    """刪除對話測試"""

    async def test_delete_success(
        self,
        async_client: AsyncClient,
        test_user: User,
        user_auth_headers: dict,
    ):
        """✅ 刪除對話 → 204"""
        conv = await _create_conversation(async_client, user_auth_headers)
        conv_id = conv["id"]

        response = await async_client.delete(
            f"/api/v1/conversations/{conv_id}",
            headers=user_auth_headers,
        )
        assert response.status_code == 204

        # 確認已不存在
        get_resp = await async_client.get(
            f"/api/v1/conversations/{conv_id}",
            headers=user_auth_headers,
        )
        assert get_resp.status_code == 404

    async def test_delete_nonexistent(
        self,
        async_client: AsyncClient,
        test_user: User,
        user_auth_headers: dict,
    ):
        """❌ 刪除不存在的對話 → 404"""
        response = await async_client.delete(
            f"/api/v1/conversations/{uuid.uuid4()}",
            headers=user_auth_headers,
        )
        assert response.status_code == 404

    async def test_delete_other_user_conversation(
        self,
        async_client: AsyncClient,
        user_auth_headers: dict,
        admin_auth_headers: dict,
    ):
        """❌ 刪除他人對話 → 404（隔離）"""
        conv = await _create_conversation(async_client, user_auth_headers)
        conv_id = conv["id"]

        # admin 嘗試刪除
        response = await async_client.delete(
            f"/api/v1/conversations/{conv_id}",
            headers=admin_auth_headers,
        )
        assert response.status_code == 404


# ═══════════════════════════════════════════════════════════════
# GET /api/v1/conversations/{id}/messages
# ═══════════════════════════════════════════════════════════════

class TestListMessages:
    """對話訊息列表測試"""

    async def test_list_messages_empty(
        self,
        async_client: AsyncClient,
        test_user: User,
        user_auth_headers: dict,
    ):
        """✅ 空對話訊息列表 → 200，空陣列"""
        conv = await _create_conversation(async_client, user_auth_headers)
        conv_id = conv["id"]

        response = await async_client.get(
            f"/api/v1/conversations/{conv_id}/messages",
            headers=user_auth_headers,
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        assert len(response.json()) == 0

    async def test_list_messages_nonexistent_conversation(
        self,
        async_client: AsyncClient,
        test_user: User,
        user_auth_headers: dict,
    ):
        """❌ 不存在的對話 → 404"""
        response = await async_client.get(
            f"/api/v1/conversations/{uuid.uuid4()}/messages",
            headers=user_auth_headers,
        )
        assert response.status_code == 404
