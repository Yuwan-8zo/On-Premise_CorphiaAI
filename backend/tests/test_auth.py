import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_login_missing_credentials(async_client: AsyncClient):
    """測試未提供帳密時的錯誤回應"""
    response = await async_client.post("/api/v1/auth/login", data={})
    assert response.status_code == 422 # Pydantic Validation Error
