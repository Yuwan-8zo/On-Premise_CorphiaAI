"""
Corphia AI 桌面版：一個視窗顯示公司伺服器上的介面，加上本機小幫手（操控這台電腦的 Word、Excel、PowerPoint）

為什麼要桌面版：瀏覽器裡的網頁碰不到這台電腦上的程式；桌面版多了一個「橋」，介面按按鈕時可以請小幫手做事。
介面本身還是伺服器上的那一套，所以伺服器更新後這裡重開就是新版，不用重新安裝。

  伺服器位址   存在 %APPDATA%\\CorphiaAI\\desktop.json；連不上時顯示連線設定頁，可以改位址
  橋           介面用 window.pywebview.api.xxx() 呼叫下面 Api 的方法（前端包在 lib/desktop.ts）
  安全         只有「目前顯示的是設定的那台伺服器」時才接受操控 Office 的呼叫（別的網頁叫不動）；
               每個動作都是使用者按按鈕才發生，小幫手自己不會主動做事
  登入狀態     存在 %LOCALAPPDATA%\\CorphiaAI\\webview，關掉再開不用重新登入

用法：
  corphia_desktop.py                         一般啟動
  corphia_desktop.py --server http://主機:埠  指定伺服器（會記住）
  corphia_desktop.py --selftest 結果檔.json   自我檢查：開視窗、載入介面、試一次橋，結果寫到檔案後自動關閉
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlsplit

import webview

import office_bridge

VERSION = "0.1.0"
APP_NAME = "Corphia AI"
DEFAULT_SERVER = "http://localhost:5173"
WINDOW_SIZE = (1280, 800)
WINDOW_MIN = (420, 640)
CONNECT_TIMEOUT = 3
SELFTEST_TIMEOUT = 40

logger = logging.getLogger("corphia.desktop")


def config_path() -> Path:
    return Path(os.environ.get("APPDATA") or Path.home()) / "CorphiaAI" / "desktop.json"


def storage_dir() -> Path:
    return Path(os.environ.get("LOCALAPPDATA") or Path.home()) / "CorphiaAI" / "webview"


def load_server() -> str:
    try:
        return json.loads(config_path().read_text(encoding="utf-8")).get("server") or DEFAULT_SERVER
    except (OSError, ValueError):
        return DEFAULT_SERVER


def save_server(url: str) -> None:
    path = config_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"server": url}, ensure_ascii=False), encoding="utf-8")


def normalize_server(url: str) -> str:
    """整理使用者輸入的位址：補 http://、去掉結尾斜線；格式不對回空字串"""
    url = (url or "").strip().rstrip("/")
    if url and "://" not in url:
        url = "http://" + url
    parts = urlsplit(url)
    return url if parts.scheme in ("http", "https") and parts.netloc else ""


def origin(url: str) -> str:
    parts = urlsplit(url or "")
    return f"{parts.scheme}://{parts.netloc}".lower() if parts.scheme and parts.netloc else ""


def reachable(url: str) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=CONNECT_TIMEOUT):
            return True
    except urllib.error.HTTPError:
        return True  # 有回應（就算是 404）就代表伺服器在
    except Exception:
        return False


CONNECT_PAGE = """<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><title>Corphia AI</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; height:100vh; display:flex; align-items:center; justify-content:center; background:#18181a; color:#fff;
         font-family:"Microsoft JhengHei","Noto Sans TC",system-ui,sans-serif; }
  .card { width:min(420px,calc(100vw - 40px)); padding:28px; border-radius:32px; background:#262629; box-shadow:0 12px 40px rgba(0,0,0,.4); }
  h1 { margin:0 0 6px; font-size:22px; } p { margin:0 0 18px; font-size:14px; line-height:1.6; color:#b6b6c0; }
  input { width:100%; box-sizing:border-box; height:46px; padding:0 18px; border:0; border-radius:23px; background:#38383c; color:#fff; font-size:15px; outline:none; }
  input:focus { box-shadow:0 0 0 2px #0a84ff; }
  button { margin-top:14px; width:100%; height:46px; border:0; border-radius:23px; background:#0a84ff; color:#fff; font-size:15px; font-weight:600; cursor:pointer; }
  button:active { transform:scale(.98); } .err { min-height:20px; margin-top:10px; font-size:13px; color:#ff6961; }
</style></head><body><div class="card">
  <h1>連不上伺服器</h1>
  <p>請確認公司的 Corphia AI 伺服器已經啟動，或輸入正確的位址（例如 http://192.168.1.10:5173）。</p>
  <input id="url" value="__SERVER__" spellcheck="false" autofocus>
  <button id="go">連線</button><div class="err" id="err"></div>
</div><script>
  const go = async () => {
    const err = document.getElementById('err'); err.textContent = '連線中…';
    const r = await window.pywebview.api.set_server(document.getElementById('url').value);
    if (!r.ok) err.textContent = r.error;
  };
  document.getElementById('go').onclick = go;
  document.getElementById('url').onkeydown = (e) => { if (e.key === 'Enter') go(); };
</script></body></html>"""


class Api:
    """介面可以呼叫的方法（pywebview 會把公開方法都暴露給頁面，所以內部用的東西都放在 _ 開頭的屬性）"""

    def __init__(self, server: str):
        self._server = server
        self._window = None

    # ── 內部 ──
    def _trusted(self) -> bool:
        """目前顯示的是不是設定的那台伺服器（不是的話一律不操控 Office）"""
        try:
            return origin(self._window.get_current_url()) == origin(self._server)
        except Exception:
            return False

    def _guard(self, fn):
        return fn() if self._trusted() else {"ok": False, "error": "這個頁面不能使用桌面功能"}

    # ── 給介面用 ──
    def info(self) -> dict:
        """桌面版的版本、三個 Office 程式的狀態"""
        return {"ok": True, "desktop": True, "version": VERSION, "trusted": self._trusted(), **office_bridge.status()}

    def office_read(self, app: str) -> dict:
        return self._guard(lambda: office_bridge.read(str(app)))

    def office_write(self, app: str, markdown: str) -> dict:
        return self._guard(lambda: office_bridge.write(str(app), str(markdown)))

    def open_file(self, filename: str, data_b64: str) -> dict:
        return self._guard(lambda: office_bridge.open_file(str(filename), str(data_b64)))

    def set_server(self, url: str) -> dict:
        """連線設定頁用：換伺服器位址（連得上才記住並切過去）"""
        if self._trusted():
            return {"ok": False, "error": "已經連上伺服器"}
        target = normalize_server(url)
        if not target:
            return {"ok": False, "error": "位址格式不對，例如 http://192.168.1.10:5173"}
        if not reachable(target):
            return {"ok": False, "error": "連不上這個位址，請確認伺服器已經啟動"}
        self._server = target
        save_server(target)
        self._window.load_url(target)
        return {"ok": True}


def run_selftest(window, api: Api, out: Path) -> None:
    """自我檢查：等介面載入 → 讀標題、確認橋在、透過橋問一次狀態 → 寫結果 → 關閉"""
    result: dict = {"version": VERSION, "server": api._server}
    try:
        loaded = threading.Event()
        window.events.loaded += lambda: loaded.set()
        result["loaded"] = loaded.wait(SELFTEST_TIMEOUT)
        result["url"] = window.get_current_url()
        result["title"] = window.evaluate_js("document.title")
        result["bridge"] = bool(window.evaluate_js("!!(window.pywebview && window.pywebview.api && window.pywebview.api.info)"))
        result["trusted"] = api._trusted()
        # 不是設定的那台伺服器（例如連線設定頁）時，操控 Office 的呼叫要被擋下
        result["office_guard"] = api.office_read("word") if not api._trusted() else "trusted"
        result["info"] = api.info()
        result["root_children"] = window.evaluate_js("document.getElementById('root') ? document.getElementById('root').children.length : -1")
        # 從介面那一側真的呼叫一次（和按鈕走同一條路）：結果先放在頁面上，再讀回來
        window.evaluate_js("window.__selftest = null; window.pywebview.api.info().then(function (r) { window.__selftest = r })")
        for _ in range(SELFTEST_TIMEOUT * 4):
            called = window.evaluate_js("window.__selftest")
            if called:
                break
            time.sleep(0.25)
        result["js_call"] = bool(called and called.get("ok") and called.get("desktop"))
    except Exception as e:
        result["error"] = str(e)[:300]
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    window.destroy()


def main() -> int:
    parser = argparse.ArgumentParser(description="Corphia AI 桌面版")
    parser.add_argument("--server", help="伺服器位址（會記住）")
    parser.add_argument("--selftest", metavar="結果檔", help="自我檢查後自動關閉")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")

    server = normalize_server(args.server) if args.server else load_server()
    if args.server and server and not args.selftest:  # 自我檢查用的位址不要記下來
        save_server(server)
    server = server or DEFAULT_SERVER

    api = Api(server)
    online = reachable(server)
    window = webview.create_window(
        APP_NAME,
        url=server if online else None,
        html=None if online else CONNECT_PAGE.replace("__SERVER__", server),
        js_api=api,
        width=WINDOW_SIZE[0], height=WINDOW_SIZE[1], min_size=WINDOW_MIN,
        text_select=True, background_color="#18181a",
    )
    api._window = window
    webview.settings["ALLOW_DOWNLOADS"] = True  # 讓介面的「下載」可以存檔

    storage = storage_dir()
    storage.mkdir(parents=True, exist_ok=True)
    start_args = dict(private_mode=False, storage_path=str(storage))
    if args.selftest:
        webview.start(run_selftest, (window, api, Path(args.selftest)), **start_args)
    else:
        webview.start(**start_args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
