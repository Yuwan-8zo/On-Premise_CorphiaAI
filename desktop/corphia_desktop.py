"""
Corphia AI 桌面版：一個視窗顯示公司伺服器上的介面，加上本機小幫手（操控這台電腦的 Word、Excel、PowerPoint）

為什麼要桌面版：瀏覽器裡的網頁碰不到這台電腦上的程式；桌面版多了一個「橋」，介面按按鈕時可以請小幫手做事。
介面本身還是伺服器上的那一套，所以伺服器更新後這裡重開就是新版，不用重新安裝。

  伺服器位址   存在 %APPDATA%\\CorphiaAI\\desktop.json；連不上時顯示連線設定頁，可以改位址
  橋           介面用 window.pywebview.api.xxx() 呼叫下面 Api 的方法（前端包在 lib/desktop.ts）
  安全         只有「目前顯示的是設定的那台伺服器」時才接受操控 Office 的呼叫（別的網頁叫不動）；
               而且每個動作都要帶「這一頁的通行碼」：伺服器的頁面載入完成時才發給它，每次載入換一把、換頁就作廢。
               只看網址不夠——換頁的瞬間，上一頁（可能是外部網頁）送出的呼叫有機會在網址已經變回伺服器之後才被處理；
               每個動作都是使用者按按鈕才發生，小幫手自己不會主動做事；
               視窗只顯示伺服器的頁面：點到外部連結會改用系統瀏覽器開，視窗回到伺服器
               （不然外部網頁可以嘗試呼叫橋）；改伺服器位址只有內建的連線設定頁可以做
  登入狀態     存在 %LOCALAPPDATA%\\CorphiaAI\\webview，關掉再開不用重新登入
  更新         啟動時向伺服器問最新版本（GET /api/v1/desktop/latest，只連公司自己的伺服器，不連外網）；
               有新版時介面會提示，使用者按「更新」才下載（核對大小與 SHA-256）→ 啟動下載下來的新版請它換檔 → 自己關閉
               → 新版把自己複製到原本的位置（等舊版完全關閉）→ 從原本的位置重新開啟

用法：
  corphia_desktop.py                         一般啟動
  corphia_desktop.py --server http://主機:埠  指定伺服器（會記住）
  corphia_desktop.py --selftest 結果檔.json   自我檢查：開視窗、載入介面、試一次橋，結果寫到檔案後自動關閉
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import secrets
import shutil
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path
from urllib.parse import urlsplit

import webview

import office_bridge

VERSION = "0.1.2"
APP_NAME = "Corphia AI"
DEFAULT_SERVER = "http://localhost:5173"
WINDOW_SIZE = (1280, 800)
WINDOW_MIN = (420, 640)
CONNECT_TIMEOUT = 3
SELFTEST_TIMEOUT = 40
UPDATE_CHECK_TIMEOUT = 5
DOWNLOAD_TIMEOUT = 120
DOWNLOAD_BLOCK = 1 << 20
SWAP_TIMEOUT = 60  # 換檔最多等舊版關閉多久（秒）
SWAP_RETRY = 0.5

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


DEFAULT_PORTS = {"http": 80, "https": 443}
# 發通行碼給頁面：由頁面自己再確認一次來源（就算剛好在這一瞬間換頁，別的網頁也拿不到）
TOKEN_SCRIPT = """(function () {
  if (location.origin.toLowerCase() !== %s) return;
  window.__corphiaDesktop = %s;
  window.dispatchEvent(new Event('corphiadesktopready'));
})()"""


def origin(url: str) -> str:
    """網址的來源（協定＋主機＋埠，小寫；預設埠省略，和瀏覽器的 location.origin 一樣）"""
    parts = urlsplit(url or "")
    if not (parts.scheme and parts.hostname):
        return ""
    scheme, host = parts.scheme.lower(), parts.hostname.lower()
    try:
        port = parts.port
    except ValueError:
        return ""
    if ":" in host:
        host = f"[{host}]"  # IPv6
    return f"{scheme}://{host}" if port in (None, DEFAULT_PORTS.get(scheme)) else f"{scheme}://{host}:{port}"


def reachable(url: str) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=CONNECT_TIMEOUT):
            return True
    except urllib.error.HTTPError:
        return True  # 有回應（就算是 404）就代表伺服器在
    except Exception:
        return False


def parse_version(text: str) -> tuple:
    """'0.10.2' → (0, 10, 2)；格式不對回空的（空的永遠不算比較新）"""
    try:
        return tuple(int(x) for x in str(text).strip().split("."))
    except ValueError:
        return ()


def update_dir() -> Path:
    return Path(os.environ.get("LOCALAPPDATA") or Path.home()) / "CorphiaAI" / "update"


def check_update(server: str) -> dict | None:
    """伺服器上有沒有比現在新的桌面版；有就回它的資訊（version、size、sha256），沒有或問不到回 None"""
    try:
        with urllib.request.urlopen(f"{server}/api/v1/desktop/latest", timeout=UPDATE_CHECK_TIMEOUT) as r:
            latest = json.loads(r.read().decode("utf-8"))
    except Exception:
        return None
    if latest.get("available") and parse_version(latest.get("version", "")) > parse_version(VERSION):
        return {k: latest.get(k) for k in ("version", "size", "sha256")}
    return None


def download_update(server: str, latest: dict) -> Path:
    """下載新版到自己的更新資料夾，核對大小與 SHA-256；不對就丟錯（不會留下壞檔）"""
    dest = update_dir() / "Corphia AI.exe"
    dest.parent.mkdir(parents=True, exist_ok=True)
    digest, size = hashlib.sha256(), 0
    try:
        with urllib.request.urlopen(f"{server}/api/v1/desktop/download", timeout=DOWNLOAD_TIMEOUT) as r, dest.open("wb") as f:
            for block in iter(lambda: r.read(DOWNLOAD_BLOCK), b""):
                f.write(block)
                digest.update(block)
                size += len(block)
        if size != int(latest.get("size") or -1) or digest.hexdigest() != latest.get("sha256"):
            raise ValueError("下載的檔案和伺服器公布的不一致")
    except Exception:
        dest.unlink(missing_ok=True)
        raise
    return dest


def _spawn(args: list[str]) -> None:
    """另開一個獨立的程序（這個程式關掉後它還會繼續跑）"""
    env = dict(os.environ)
    # 打包成單一 exe 的程式開另一個同類程式時，要請它重新建立自己的執行環境，不要沿用這一個的
    env["PYINSTALLER_RESET_ENVIRONMENT"] = "1"
    flags = getattr(subprocess, "DETACHED_PROCESS", 0) | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
    subprocess.Popen(args, env=env, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                     creationflags=flags, close_fds=True)


def apply_update(target: Path) -> int:
    """
    由「下載下來的新版」執行：把自己複製到原本的位置（舊版還沒完全關閉時檔案被佔用，就等一下再試），
    然後從原本的位置重新開啟。為什麼由新版自己做：不靠批次檔，中文路徑、沒有主控台視窗都不會出問題。
    """
    source = Path(sys.executable)
    deadline = time.time() + SWAP_TIMEOUT
    while True:
        try:
            shutil.copy2(source, target)
            break
        except OSError:
            if time.time() > deadline:
                return 1
            time.sleep(SWAP_RETRY)
    _spawn([str(target)])
    return 0


def cleanup_update() -> None:
    """上次更新留下的安裝檔（它執行時刪不掉自己）：下次正常啟動時清掉"""
    leftover = update_dir() / "Corphia AI.exe"
    try:
        if leftover.is_file() and leftover.resolve() != Path(sys.executable).resolve():
            leftover.unlink()
    except OSError:
        pass


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
        # 現在顯示的是不是我們自己的連線設定頁（只有它可以改伺服器位址）
        self._connect_page = False
        # 伺服器上比較新的桌面版（背景檢查到才有值）
        self._update: dict | None = None
        # 這一頁的通行碼：伺服器的頁面載入完成時發給它；空的＝目前沒有任何頁面可以操控
        self._token = ""

    # ── 內部 ──
    def _trusted(self) -> bool:
        """目前顯示的是不是設定的那台伺服器（不是的話一律不操控 Office）"""
        try:
            return origin(self._window.get_current_url()) == origin(self._server)
        except Exception:
            return False

    def _allowed(self, token) -> bool:
        """帶著這一頁的通行碼、而且目前顯示的是伺服器，才可以操控"""
        return bool(self._token) and isinstance(token, str) and secrets.compare_digest(token.encode(), self._token.encode()) and self._trusted()

    def _guard(self, token, fn):
        return fn() if self._allowed(token) else {"ok": False, "error": "這個頁面不能使用桌面功能"}

    # ── 給介面用 ──
    def info(self, token: str = "") -> dict:
        """桌面版的版本、有沒有新版；帶通行碼才附上三個 Office 程式的狀態（裡面有開著的文件名稱，不給別的頁面看）"""
        out = {"ok": True, "desktop": True, "version": VERSION, "trusted": self._trusted(), "update": self._update}
        return {**out, **office_bridge.status()} if self._allowed(token) else out

    def update(self, token: str = "") -> dict:
        """下載新版並換掉自己（使用者在介面上按「更新」才會呼叫）；成功後視窗會關閉、自動重新開啟"""
        def run() -> dict:
            if not self._update:
                return {"ok": False, "error": "目前已經是最新版"}
            if not getattr(sys, "frozen", False):
                return {"ok": False, "error": "開發模式不能自動更新，請重新打包"}
            try:
                new_exe = download_update(self._server, self._update)
            except Exception as e:
                return {"ok": False, "error": f"下載新版失敗：{str(e)[:120]}"}
            _spawn([str(new_exe), "--apply-update", str(Path(sys.executable))])
            threading.Timer(0.8, self._window.destroy).start()  # 先讓這次呼叫回到介面，再關視窗
            return {"ok": True, "version": self._update["version"]}

        return self._guard(token, run)

    def office_read(self, token: str, app: str = "") -> dict:
        return self._guard(token, lambda: office_bridge.read(str(app)))

    def office_write(self, token: str, app: str = "", markdown: str = "") -> dict:
        return self._guard(token, lambda: office_bridge.write(str(app), str(markdown)))

    def open_file(self, token: str, filename: str = "", data_b64: str = "") -> dict:
        return self._guard(token, lambda: office_bridge.open_file(str(filename), str(data_b64)))

    def set_server(self, url: str) -> dict:
        """連線設定頁用：換伺服器位址（連得上才記住並切過去）"""
        # 只有內建的連線設定頁可以改；任何網頁（包含被帶去的外部網頁）都不行，
        # 不然惡意網頁可以把「伺服器」改成自己，變成被信任的來源去操控 Office
        if not self._connect_page or origin(self._current_url()):
            return {"ok": False, "error": "這個頁面不能變更伺服器位址"}
        target = normalize_server(url)
        if not target:
            return {"ok": False, "error": "位址格式不對，例如 http://192.168.1.10:5173"}
        if not reachable(target):
            return {"ok": False, "error": "連不上這個位址，請確認伺服器已經啟動"}
        self._server = target
        save_server(target)
        self._connect_page = False
        self._window.load_url(target)
        return {"ok": True}

    def _current_url(self) -> str:
        try:
            return self._window.get_current_url() or ""
        except Exception:
            return ""

    def _on_loaded(self) -> None:
        """每次頁面載入後檢查：不是伺服器的網頁 → 用系統瀏覽器開，視窗回到伺服器；是伺服器 → 發這一頁的通行碼"""
        self._token = ""  # 換頁了：上一頁的通行碼作廢
        url = self._current_url()
        where = origin(url)
        if where and where != origin(self._server):
            logger.info("外部連結改用系統瀏覽器開啟：%s", where)
            webbrowser.open(url)
            self._window.load_url(self._server)
            return
        if where:
            token = secrets.token_urlsafe(24)
            try:
                self._window.evaluate_js(TOKEN_SCRIPT % (json.dumps(where), json.dumps(token)))
            except Exception as e:
                logger.warning("發通行碼失敗：%s", e)
                return
            self._token = token


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
        # 通行碼：伺服器的頁面拿得到；沒帶或帶錯的呼叫要被擋下（連線設定頁沒有通行碼，一律被擋）
        for _ in range(20):
            if api._token or not api._trusted():
                break
            time.sleep(0.25)
        page_token = window.evaluate_js("window.__corphiaDesktop || ''")
        result["token_issued"] = bool(api._token) and page_token == api._token
        result["office_guard"] = api.office_read("", "word")
        result["wrong_token"] = api.office_read("x" * 32, "word")
        result["info_without_token_has_documents"] = "apps" in api.info()
        result["info_with_token_has_documents"] = "apps" in api.info(api._token) if api._token else "no-token"
        # 一般網頁不能改伺服器位址（連線設定頁以外一律拒絕）；位址給一個連不上的，確保真的被擋而不是剛好連線失敗
        result["update_check"] = check_update(api._server) or "none"
        if os.environ.get("CORPHIA_SELFTEST_UPDATE") == "1":
            # 更新流程的自我檢查：直接查版本並執行更新（會關閉視窗、換掉 exe、重新開啟）
            api._update = check_update(api._server)
            result["update_result"] = api.update(api._token)
        result["set_server_from_page"] = api.set_server("http://127.0.0.1:1") if api._trusted() else "connect-page"
        result["info"] = api.info()
        result["root_children"] = window.evaluate_js("document.getElementById('root') ? document.getElementById('root').children.length : -1")
        # 從介面那一側真的呼叫一次（和按鈕走同一條路）：結果先放在頁面上，再讀回來
        window.evaluate_js("window.__selftest = null; window.pywebview.api.info(window.__corphiaDesktop || '').then(function (r) { window.__selftest = r })")
        for _ in range(SELFTEST_TIMEOUT * 4):
            called = window.evaluate_js("window.__selftest")
            if called:
                break
            time.sleep(0.25)
        result["js_call"] = bool(called and called.get("ok") and called.get("desktop"))
        result["js_call_has_documents"] = bool(called and "apps" in called)
    except Exception as e:
        result["error"] = str(e)[:300]
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    window.destroy()


def main() -> int:
    parser = argparse.ArgumentParser(description="Corphia AI 桌面版")
    parser.add_argument("--server", help="伺服器位址（會記住）")
    parser.add_argument("--selftest", metavar="結果檔", help="自我檢查後自動關閉")
    parser.add_argument("--apply-update", metavar="原本的位置", help=argparse.SUPPRESS)  # 更新時由新版自己呼叫
    args = parser.parse_args()
    if args.apply_update:
        return apply_update(Path(args.apply_update))
    if not args.selftest:
        cleanup_update()
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
    api._connect_page = not online
    window.events.loaded += api._on_loaded
    webview.settings["ALLOW_DOWNLOADS"] = True  # 讓介面的「下載」可以存檔

    if online and not args.selftest:
        # 背景問伺服器有沒有新版（問不到就算了，不影響使用）
        threading.Thread(target=lambda: setattr(api, "_update", check_update(server)), daemon=True).start()

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
