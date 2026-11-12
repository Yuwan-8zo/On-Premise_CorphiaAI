"""
每個人自己選模型 (test_model_preference.py)

- A 換模型只改 A 自己的，B 和系統預設都不變
- 不存在的模型回 404
"""
import pytest
from httpx import AsyncClient

from app.core.security import create_access_token
from app.models.user import User
from app.services.model_manager import get_model_manager

API = "/api/v1"


def bearer(user: User) -> dict:
    return {"Authorization": f"Bearer {create_access_token({'sub': user.id})}"}


async def test_switch_is_personal(async_client: AsyncClient, test_user: User, test_admin: User):
    manager = get_model_manager()
    names = [m.name for m in manager.available_models]
    if len(names) < 2:
        pytest.skip("需要至少兩個模型檔才能測切換")
    default = manager._current_model
    other = next(n for n in names if n != default)

    r = await async_client.post(f"{API}/models/select", json={"name": other}, headers=bearer(test_user))
    assert r.status_code == 200
    assert (await async_client.get(f"{API}/models", headers=bearer(test_user))).json()["current_model"] == other
    # 別人和系統預設不受影響
    assert (await async_client.get(f"{API}/models", headers=bearer(test_admin))).json()["current_model"] == default
    assert manager._current_model == default


async def test_unknown_model_404(async_client: AsyncClient, test_user: User):
    r = await async_client.post(f"{API}/models/select", json={"name": "no-such-model"}, headers=bearer(test_user))
    assert r.status_code == 404
