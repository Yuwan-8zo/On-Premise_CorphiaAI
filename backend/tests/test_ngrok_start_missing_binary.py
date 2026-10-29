from unittest.mock import patch

import pytest
from httpx import AsyncClient


@pytest.mark.skip(reason="ngrok 公開通道已移除，改為區域網路（LAN）開關；/system/ngrok/start 不再存在")
@pytest.mark.asyncio
async def test_ngrok_start_returns_503_when_missing_binary(
    async_client: AsyncClient,
    admin_auth_headers: dict,
):
    with patch("app.api.system_monitor.find_ngrok_binary", return_value=None):
        resp = await async_client.post("/api/v1/system/ngrok/start", headers=admin_auth_headers)
        assert resp.status_code == 503
