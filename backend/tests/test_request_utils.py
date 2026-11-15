"""
用戶端 IP 判斷 (test_request_utils.py)

只信任本機代理轉送的標頭，並且從右邊往左找（最左邊是用戶端自己可以亂填的）
"""
from starlette.requests import Request

from app.core.request_utils import get_client_ip


def req(peer: str, xff: str | None = None) -> Request:
    headers = [(b"x-forwarded-for", xff.encode())] if xff else []
    return Request({"type": "http", "client": (peer, 1234), "headers": headers})


def test_direct_connection_ignores_header():
    # 不是本機連進來：標頭一律不信，用實際連線的 IP
    assert get_client_ip(req("203.0.113.9", "1.2.3.4")) == "203.0.113.9"


def test_lan_phone_through_vite():
    assert get_client_ip(req("127.0.0.1", "192.168.1.23")) == "192.168.1.23"


def test_spoofed_left_entry_ignored_through_ngrok():
    # 外網用戶自己在最左邊填假 IP；ngrok 加上真實 IP，本機 Vite 再加上 127.0.0.1
    assert get_client_ip(req("127.0.0.1", "10.0.0.1, 198.51.100.7, 127.0.0.1")) == "198.51.100.7"


def test_local_browser_without_header():
    assert get_client_ip(req("127.0.0.1")) == "127.0.0.1"


def test_garbage_header_falls_back():
    assert get_client_ip(req("127.0.0.1", "not-an-ip, <script>")) == "127.0.0.1"
