"""
文件管理 API 測試 (test_documents.py)

測試端點：
- GET  /api/v1/documents           （文件列表）
- POST /api/v1/documents/upload    （上傳文件）
- GET  /api/v1/documents/{id}      （取得單筆）
- DELETE /api/v1/documents/{id}    （刪除）
- PATCH /api/v1/documents/{id}/metadata （更新 metadata）

NOTE: 文件上傳涉及 I/O，測試使用 mock 或小型記憶體 fixture
"""

import io
import uuid
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from httpx import AsyncClient

from app.models.user import User
from app.models.document import Document


# ── Helper: 建立假文件 fixture ────────────────────────────────

def make_txt_file(content: str = "Hello, Corphia!") -> tuple:
    """建立記憶體中的 txt 假文件"""
    file_bytes = content.encode("utf-8")
    return (
        "test.txt",                  # filename
        io.BytesIO(file_bytes),     # file object
        "text/plain",               # content_type
    )


def make_pdf_file() -> tuple:
    """建立最小合法 PDF 假文件（magic bytes %PDF-）"""
    # 最小可通過 magic bytes 驗證的 PDF header
    pdf_bytes = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n"
    return (
        "test.pdf",
        io.BytesIO(pdf_bytes),
        "application/pdf",
    )


# ═══════════════════════════════════════════════════════════════
# GET /api/v1/documents
# ═══════════════════════════════════════════════════════════════

class TestListDocuments:
    """文件列表測試"""

    async def test_list_empty(
        self,
        async_client: AsyncClient,
        test_user: User,
        user_auth_headers: dict,
    ):
        """✅ 無文件時回傳空列表 → 200"""
        response = await async_client.get(
            "/api/v1/documents", headers=user_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert "total" in data
        assert isinstance(data["data"], list)

    async def test_list_requires_auth(self, async_client: AsyncClient):
        """❌ 未登入 → 401/403"""
        response = await async_client.get("/api/v1/documents")
        assert response.status_code in (401, 403)


# ═══════════════════════════════════════════════════════════════
# POST /api/v1/documents/upload
# ═══════════════════════════════════════════════════════════════

class TestUploadDocument:
    """文件上傳測試"""

    async def test_upload_txt_success(
        self,
        async_client: AsyncClient,
        test_user: User,
        user_auth_headers: dict,
    ):
        """✅ 上傳 TXT 文件 → 200，回傳 document id"""
        filename, file_obj, content_type = make_txt_file()

        # Mock DocumentService.upload_document & process_document
        mock_doc = MagicMock()
        mock_doc.id = str(uuid.uuid4())
        mock_doc.original_filename = filename
        mock_doc.status = "pending"
        mock_doc.doc_metadata = None

        with patch(
            "app.api.documents.DocumentService.upload_document",
            new_callable=AsyncMock,
            return_value=mock_doc,
        ):
            response = await async_client.post(
                "/api/v1/documents/upload",
                files={"file": (filename, file_obj, content_type)},
                headers=user_auth_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["filename"] == filename

    async def test_upload_no_file(
        self,
        async_client: AsyncClient,
        user_auth_headers: dict,
    ):
        """❌ 未附帶檔案 → 422"""
        response = await async_client.post(
            "/api/v1/documents/upload",
            headers=user_auth_headers,
        )
        assert response.status_code == 422

    async def test_upload_unsupported_type(
        self,
        async_client: AsyncClient,
        test_user: User,
        user_auth_headers: dict,
    ):
        """❌ 不支援的檔案類型（例如 .exe） → 400"""
        exe_bytes = b"MZ\x90\x00"  # Windows EXE magic bytes
        response = await async_client.post(
            "/api/v1/documents/upload",
            files={"file": ("malware.exe", io.BytesIO(exe_bytes), "application/octet-stream")},
            headers=user_auth_headers,
        )
        assert response.status_code == 400

    async def test_upload_requires_auth(self, async_client: AsyncClient):
        """❌ 未登入上傳 → 401/403"""
        filename, file_obj, content_type = make_txt_file()
        response = await async_client.post(
            "/api/v1/documents/upload",
            files={"file": (filename, file_obj, content_type)},
        )
        assert response.status_code in (401, 403)


# ═══════════════════════════════════════════════════════════════
# GET /api/v1/documents/{id}
# ═══════════════════════════════════════════════════════════════

class TestGetDocument:
    """取得單筆文件測試"""

    async def test_get_nonexistent(
        self,
        async_client: AsyncClient,
        user_auth_headers: dict,
    ):
        """❌ 不存在的文件 → 404"""
        response = await async_client.get(
            f"/api/v1/documents/{uuid.uuid4()}",
            headers=user_auth_headers,
        )
        assert response.status_code == 404

    async def test_get_requires_auth(self, async_client: AsyncClient):
        """❌ 未登入 → 401/403"""
        response = await async_client.get(
            f"/api/v1/documents/{uuid.uuid4()}"
        )
        assert response.status_code in (401, 403)


# ═══════════════════════════════════════════════════════════════
# DELETE /api/v1/documents/{id}
# ═══════════════════════════════════════════════════════════════

class TestDeleteDocument:
    """刪除文件測試"""

    async def test_delete_nonexistent(
        self,
        async_client: AsyncClient,
        user_auth_headers: dict,
    ):
        """❌ 刪除不存在文件 → 404"""
        response = await async_client.delete(
            f"/api/v1/documents/{uuid.uuid4()}",
            headers=user_auth_headers,
        )
        assert response.status_code == 404

    async def test_delete_requires_auth(self, async_client: AsyncClient):
        """❌ 未登入 → 401/403"""
        response = await async_client.delete(
            f"/api/v1/documents/{uuid.uuid4()}"
        )
        assert response.status_code in (401, 403)


# ═══════════════════════════════════════════════════════════════
# PATCH /api/v1/documents/{id}/metadata
# ═══════════════════════════════════════════════════════════════

class TestUpdateDocumentMetadata:
    """更新文件 metadata 測試"""

    async def test_update_nonexistent(
        self,
        async_client: AsyncClient,
        user_auth_headers: dict,
    ):
        """❌ 更新不存在文件 → 404"""
        response = await async_client.patch(
            f"/api/v1/documents/{uuid.uuid4()}/metadata",
            json={"doc_metadata": {"isActive": False}},
            headers=user_auth_headers,
        )
        assert response.status_code == 404

    async def test_update_requires_auth(self, async_client: AsyncClient):
        """❌ 未登入 → 401/403"""
        response = await async_client.patch(
            f"/api/v1/documents/{uuid.uuid4()}/metadata",
            json={"doc_metadata": {}},
        )
        assert response.status_code in (401, 403)
