"""主機重開後要重新登入：之前發的登入 Token 一律失效；主機沒重開就照常可用"""

from app.core import security


def test_token_valid_until_host_restarts(monkeypatch):
    token = security.create_refresh_token({"sub": "user-1"})
    access = security.create_access_token({"sub": "user-1"})
    assert security.decode_token(token)["sub"] == "user-1"
    assert security.decode_token(access)["sub"] == "user-1"
    monkeypatch.setattr(security, "BOOT_ID", "a-new-boot")  # 模擬主機重開
    assert security.decode_token(token) is None
    assert security.decode_token(access) is None


def test_token_without_boot_id_is_rejected():
    from jose import jwt

    from app.core.config import settings

    old = jwt.encode({"sub": "user-1", "type": "refresh"}, settings.secret_key, algorithm=settings.jwt_algorithm)
    assert security.decode_token(old) is None
