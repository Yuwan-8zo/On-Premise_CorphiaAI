import pytest
from httpx import AsyncClient, ASGITransport

# Adjust import path if needed
from app.main import app

@pytest.fixture
async def async_client():
    """建立非同步測試客戶端"""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        yield client
