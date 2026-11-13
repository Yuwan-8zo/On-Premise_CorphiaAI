"""
由後端直接提供介面（不需要前端開發伺服器、不需要 Node）

開關：環境變數 CORPHIA_SERVE_FRONTEND=1（start.py --built、桌面版自己啟動時會設）。沒設時這裡什麼都不做，
開發模式照舊由 Vite 提供介面、後端只聽本機。

開了之後：
  介面       frontend/dist（npm run build 的結果）；找不到的路徑一律回 index.html（單頁應用自己處理網址）
  啟動進度   /boot-status.json 每次都讀 start.py 寫的最新內容（frontend/public/boot-status.json），不是打包時的舊檔
  區網門檢   這個模式下後端要聽所有網路介面（手機才連得到），所以把 Vite 那一套門檢搬進來（LanGate）：
             本機連線一律放行；其他裝置要管理後台開了「區域網路」（.runtime/lan.json）才放行，
             沒開時網頁回 403、WebSocket 直接拒絕。規則和 frontend/vite-plugins/lanGate.ts 一致。

來源 IP 不用另外處理：request_utils.get_client_ip 只在「直接連進來的是本機」時才採用轉送標頭，
區網裝置直接連進來時用的就是實際連線的 IP。
"""

from __future__ import annotations

import ipaddress
import json
import os
import time
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response

PROJECT_ROOT = Path(__file__).resolve().parents[3]
DIST_DIR = PROJECT_ROOT / "frontend" / "dist"
BOOT_STATUS_PATH = PROJECT_ROOT / "frontend" / "public" / "boot-status.json"
LAN_PATH = PROJECT_ROOT / ".runtime" / "lan.json"
ENV_FLAG = "CORPHIA_SERVE_FRONTEND"
# 區網裝置要連的協定和埠（run_server.py 啟動時填；None＝開發模式，由前端開發伺服器決定）
LAN_ENDPOINT: dict | None = None
# 最多每隔多久重讀一次區網設定（秒）；不看修改時間：Windows 的修改時間只精確到秒，一秒內連續切換會讀不到
LAN_REREAD_SEC = 0.3
# 不屬於介面的路徑：找不到就是找不到，不能回 index.html（不然打錯的 API 網址會拿到一頁 HTML）
API_PREFIXES = ("api/", "ws/")
NO_CACHE = {"Cache-Control": "no-cache"}
# 檔名帶內容雜湊的資源（dist/assets/）內容永遠不變，可以長期快取
IMMUTABLE = {"Cache-Control": "public, max-age=31536000, immutable"}

BLOCKED_PAGE = """<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>區域網路未開啟</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#000;color:#fff;font-family:system-ui,'Noto Sans TC',sans-serif;text-align:center;padding:24px">
<div><h1 style="font-size:22px;margin:0 0 8px">區域網路未開啟</h1><p style="margin:0;color:#b6b6c0;font-size:15px">請在主機的管理後台開啟「區域網路」後，再重新整理這一頁。</p></div></body></html>"""


def enabled() -> bool:
    return os.environ.get(ENV_FLAG) == "1"


def is_loopback(host: str | None) -> bool:
    try:
        ip = ipaddress.ip_address(host or "")
    except ValueError:
        return False
    # ::ffff:127.0.0.1（IPv6 包著的本機位址）也算本機
    mapped = getattr(ip, "ipv4_mapped", None)
    return ip.is_loopback or bool(mapped and mapped.is_loopback)


# 內部網路的位址範圍：公司／家用區網（10、172.16～31、192.168）、沒有 DHCP 時自動配的位址（169.254）、
# IPv6 的區網位址（fc00::/7）與同一段網路才通的位址（fe80::/10）。其他一律當成外面來的。
PRIVATE_NETWORKS = tuple(ipaddress.ip_network(n) for n in (
    "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "169.254.0.0/16", "fc00::/7", "fe80::/10",
))


def is_private(host: str | None) -> bool:
    """是不是內部網路的裝置（本機不算在這裡，見 is_loopback）"""
    try:
        # fe80::1%eth0 這種帶網路介面名稱的寫法，先把名稱拿掉
        ip = ipaddress.ip_address((host or "").split("%")[0])
    except ValueError:
        return False
    ip = getattr(ip, "ipv4_mapped", None) or ip  # ::ffff:192.168.1.5 → 192.168.1.5
    return any(ip.version == net.version and ip in net for net in PRIVATE_NETWORKS)


class LanGate:
    """
    區網門檢（最外層）：不是本機的連線，區域網路沒開就擋在門口，後面的程式完全碰不到。
    區域網路開著也只收內部網路的位址：主機就算被接到外面（路由器轉埠、公開 IP），外面的裝置一樣進不來。
    """

    def __init__(self, app, lan_path: Path = LAN_PATH):
        self.app = app
        self._lan_path = lan_path
        self._cache = (0.0, False)

    def lan_enabled(self) -> bool:
        at, value = self._cache
        now = time.monotonic()
        if at and now - at < LAN_REREAD_SEC:
            return value
        try:
            value = bool(json.loads(self._lan_path.read_text(encoding="utf-8")).get("lan_enabled"))
        except Exception:
            value = False  # 沒有設定檔或讀不到＝只允許本機
        self._cache = (now, value)
        return value

    async def __call__(self, scope, receive, send):
        if scope["type"] not in ("http", "websocket"):
            return await self.app(scope, receive, send)
        client = scope.get("client")
        host = client[0] if client else None
        if is_loopback(host) or (is_private(host) and self.lan_enabled()):
            return await self.app(scope, receive, send)
        if scope["type"] == "websocket":
            # 還沒接受就關閉＝拒絕連線
            await send({"type": "websocket.close", "code": 1008})
            return
        await HTMLResponse(BLOCKED_PAGE, status_code=403)(scope, receive, send)


def resolve_asset(dist: Path, path: str) -> Path | None:
    """網址路徑對應到 dist 裡的檔案；跑出 dist 之外（../）或不是檔案回 None"""
    try:
        target = (dist / path).resolve()
        target.relative_to(dist.resolve())
    except (ValueError, OSError):
        return None
    return target if target.is_file() else None


def install(app: FastAPI, dist: Path = DIST_DIR, boot_status: Path = BOOT_STATUS_PATH) -> None:
    """把介面的路徑掛上去。要在所有 API 路徑都註冊完之後呼叫（最後那條是什麼都接的路徑）"""

    @app.get("/boot-status.json", include_in_schema=False)
    async def boot_status_json() -> Response:
        try:
            return Response(boot_status.read_text(encoding="utf-8"), media_type="application/json", headers={"Cache-Control": "no-store"})
        except OSError:
            return JSONResponse({}, status_code=404, headers={"Cache-Control": "no-store"})

    @app.get("/lan-ca.crt", include_in_schema=False)
    async def lan_ca() -> Response:
        """主機的發證憑證（公開的那一半）：手機裝一次，之後連這台主機就不會再跳「連線不是私人連線」"""
        from app.core.lan_tls import ca_der

        der = ca_der()
        if not der:
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        return Response(der, media_type="application/x-x509-ca-cert",
                        headers={"Content-Disposition": 'attachment; filename="corphia-lan-ca.crt"', "Cache-Control": "no-store"})

    @app.get("/{path:path}", include_in_schema=False)
    async def web_ui(path: str) -> Response:
        if path.startswith(API_PREFIXES):
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        asset = resolve_asset(dist, path) if path else None
        if asset:
            return FileResponse(asset, headers=IMMUTABLE if path.startswith("assets/") else NO_CACHE)
        index = dist / "index.html"
        if not index.is_file():
            return HTMLResponse("<h1>介面還沒打包</h1><p>請在 frontend 資料夾執行 npm run build。</p>", status_code=503)
        return FileResponse(index, headers=NO_CACHE)
