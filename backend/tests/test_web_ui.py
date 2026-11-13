"""
由後端直接提供介面（app/core/web_ui.py）

- 區網門檢：本機一律放行；其他裝置要開了「區域網路」才放行，沒開時網頁 403、WebSocket 拒絕
- 介面檔案：dist 裡有的檔案照給、沒有的回 index.html、API 路徑找不到不能回 HTML、不能用 ../ 讀到 dist 外面
"""

import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core import web_ui


# ═════════════════════════════════════════════════════════════════════════
# 區網門檢
# ═════════════════════════════════════════════════════════════════════════
class _Inner:
    def __init__(self):
        self.called = 0

    async def __call__(self, scope, receive, send):
        self.called += 1


async def _run(gate, kind: str, client_ip: str) -> list[dict]:
    sent: list[dict] = []

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message):
        sent.append(message)

    await gate({"type": kind, "client": (client_ip, 50000), "method": "GET", "path": "/", "headers": []}, receive, send)
    return sent


def _gate(tmp_path, lan: bool | None):
    lan_file = tmp_path / "lan.json"
    if lan is not None:
        lan_file.write_text(json.dumps({"lan_enabled": lan}), encoding="utf-8")
    inner = _Inner()
    return web_ui.LanGate(inner, lan_path=lan_file), inner


class TestLanGate:
    @pytest.mark.parametrize("ip", ["127.0.0.1", "::1", "::ffff:127.0.0.1"])
    @pytest.mark.asyncio
    async def test_this_computer_always_passes(self, tmp_path, ip):
        gate, inner = _gate(tmp_path, lan=False)
        await _run(gate, "http", ip)
        assert inner.called == 1

    @pytest.mark.parametrize("lan", [False, None])
    @pytest.mark.asyncio
    async def test_other_devices_blocked_when_lan_is_off_or_unset(self, tmp_path, lan):
        gate, inner = _gate(tmp_path, lan=lan)
        sent = await _run(gate, "http", "192.168.1.50")
        assert inner.called == 0, "區網沒開時，後面的程式不能被碰到"
        assert sent[0]["status"] == 403

    @pytest.mark.asyncio
    async def test_other_devices_websocket_rejected_when_lan_is_off(self, tmp_path):
        gate, inner = _gate(tmp_path, lan=False)
        sent = await _run(gate, "websocket", "192.168.1.50")
        assert inner.called == 0
        assert sent == [{"type": "websocket.close", "code": 1008}]

    @pytest.mark.asyncio
    async def test_other_devices_pass_when_lan_is_on(self, tmp_path):
        gate, inner = _gate(tmp_path, lan=True)
        await _run(gate, "http", "192.168.1.50")
        await _run(gate, "websocket", "192.168.1.50")
        assert inner.called == 2

    @pytest.mark.asyncio
    async def test_switching_off_takes_effect_without_restart(self, tmp_path, monkeypatch):
        monkeypatch.setattr(web_ui, "LAN_REREAD_SEC", 0)
        gate, inner = _gate(tmp_path, lan=True)
        await _run(gate, "http", "192.168.1.50")
        (tmp_path / "lan.json").write_text(json.dumps({"lan_enabled": False}), encoding="utf-8")
        sent = await _run(gate, "http", "192.168.1.50")
        assert inner.called == 1 and sent[0]["status"] == 403

    @pytest.mark.asyncio
    async def test_broken_setting_file_means_this_computer_only(self, tmp_path):
        gate, inner = _gate(tmp_path, lan=None)
        (tmp_path / "lan.json").write_text("{壞掉的內容", encoding="utf-8")
        await _run(gate, "http", "10.0.0.8")
        assert inner.called == 0

    @pytest.mark.asyncio
    async def test_missing_client_address_is_not_treated_as_local(self, tmp_path):
        gate, inner = _gate(tmp_path, lan=False)
        sent: list[dict] = []

        async def send(message):
            sent.append(message)

        await gate({"type": "http", "client": None, "method": "GET", "path": "/", "headers": []}, None, send)
        assert inner.called == 0 and sent[0]["status"] == 403


# ═════════════════════════════════════════════════════════════════════════
# 介面檔案
# ═════════════════════════════════════════════════════════════════════════
@pytest.fixture
def client(tmp_path):
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<html>介面</html>", encoding="utf-8")
    (dist / "assets" / "app-abc123.js").write_text("console.log(1)", encoding="utf-8")
    (dist / "favicon.svg").write_text("<svg/>", encoding="utf-8")
    (tmp_path / "secret.txt").write_text("不能被讀到", encoding="utf-8")
    boot = tmp_path / "boot-status.json"
    boot.write_text(json.dumps({"overall": "starting"}), encoding="utf-8")

    app = FastAPI()

    @app.get("/api/v1/ping")
    async def ping():
        return {"ok": True}

    web_ui.install(app, dist=dist, boot_status=boot)
    return TestClient(app), boot


class TestServeUi:
    def test_root_and_unknown_pages_get_the_app(self, client):
        c, _ = client
        for path in ("/", "/chat/123", "/admin"):
            r = c.get(path)
            assert r.status_code == 200 and "介面" in r.text
            assert r.headers["cache-control"] == "no-cache"

    def test_hashed_assets_are_cached_forever(self, client):
        c, _ = client
        r = c.get("/assets/app-abc123.js")
        assert r.status_code == 200 and "immutable" in r.headers["cache-control"]

    def test_other_files_are_served_but_not_cached(self, client):
        c, _ = client
        r = c.get("/favicon.svg")
        assert r.status_code == 200 and r.headers["cache-control"] == "no-cache"

    def test_api_routes_still_work_and_unknown_api_is_404_not_html(self, client):
        c, _ = client
        assert c.get("/api/v1/ping").json() == {"ok": True}
        r = c.get("/api/v1/nope")
        assert r.status_code == 404 and "介面" not in r.text
        assert c.get("/ws/chat/x").status_code == 404

    def test_boot_status_is_read_live(self, client):
        c, boot = client
        assert c.get("/boot-status.json").json() == {"overall": "starting"}
        boot.write_text(json.dumps({"overall": "ready"}), encoding="utf-8")
        r = c.get("/boot-status.json")
        assert r.json() == {"overall": "ready"} and r.headers["cache-control"] == "no-store"

    @pytest.mark.parametrize("path", ["../secret.txt", "assets/../../secret.txt", "..%2Fsecret.txt", "%2e%2e/secret.txt"])
    def test_cannot_escape_the_dist_folder(self, client, tmp_path, path):
        c, _ = client
        assert web_ui.resolve_asset(tmp_path / "dist", "../secret.txt") is None
        r = c.get("/" + path)
        assert "不能被讀到" not in r.text

    def test_unbuilt_ui_says_so(self, tmp_path):
        app = FastAPI()
        web_ui.install(app, dist=tmp_path / "missing", boot_status=tmp_path / "none.json")
        r = TestClient(app).get("/")
        assert r.status_code == 503
        assert TestClient(app).get("/boot-status.json").status_code == 404


def test_flag_is_off_by_default(monkeypatch):
    monkeypatch.delenv(web_ui.ENV_FLAG, raising=False)
    assert web_ui.enabled() is False
    monkeypatch.setenv(web_ui.ENV_FLAG, "1")
    assert web_ui.enabled() is True
