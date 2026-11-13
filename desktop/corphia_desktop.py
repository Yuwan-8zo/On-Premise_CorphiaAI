"""
Corphia AI 桌面版：一個視窗顯示公司伺服器上的介面，加上本機小幫手（操控這台電腦的 Word、Excel、PowerPoint）

為什麼要桌面版：瀏覽器裡的網頁碰不到這台電腦上的程式；桌面版多了一個「橋」，介面按按鈕時可以請小幫手做事。
介面本身還是伺服器上的那一套，所以伺服器更新後這裡重開就是新版，不用重新安裝。

  單機使用     桌面程式放在完整安裝裡（往上找得到 start.py）、伺服器又是這台電腦時，服務沒開就自己在背景帶起來
               （顯示啟動畫面，不用先按一鍵啟動、不用開瀏覽器），關掉視窗時一起關掉；原本就開著的服務不動（見 local_stack.py）
  伺服器位址   存在 %APPDATA%\\CorphiaAI\\desktop.json；連不上（而且不是上面那種情況）時顯示連線設定頁，可以改位址
  橋           介面用 window.pywebview.api.xxx() 呼叫下面 Api 的方法（前端包在 lib/desktop.ts）
  存檔         AI 寫的程式碼／文字可以存成這台電腦的檔案：使用者按「存檔」→ 系統的另存新檔視窗 → 才寫（見 local_files.py）
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
import ssl
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

import host_trust
import local_files
import single_instance
import office_bridge
from local_stack import LOCAL_UI_URL, LocalStack, find_install_dir, is_local_server, serves_ui

VERSION = "0.3.6"
APP_NAME = "Corphia AI"
DEFAULT_SERVER = "http://localhost:5173"
# 主機（--built）提供介面的埠；連線設定頁的範例、和只打 IP 時要補的埠都用它
HOST_PORT = 8168
# 主機開著區網加密時，公司其他電腦要連的埠（backend/app/core/config.py 的 lan_https_port）
HOST_HTTPS_PORT = 8443
EXAMPLE_SERVER = "192.168.1.10"
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


def server_candidates(url: str) -> list[str]:
    """
    要試的位址：先照使用者打的；只打了主機位址、沒有埠號的，再試主機的加密埠（公司其他電腦用的）
    和沒加密的埠（主機關掉加密時）。加密的排前面：連得上就不會退回沒加密的。
    """
    parts = urlsplit(url)
    try:
        has_port = parts.port is not None
    except ValueError:
        return []
    if has_port:
        return [url]
    return [url, f"https://{parts.netloc}:{HOST_HTTPS_PORT}", f"http://{parts.netloc}:{HOST_PORT}"]


# 這台電腦已經信任的主機憑證（第一次連線核對指紋後記住，見 host_trust.py）
TRUST = host_trust.HostTrust()


def enable_pinned_certificates() -> None:
    """
    視窗裡的瀏覽器遇到 Windows 不認得的憑證（主機自己簽的）時，改問 TRUST：是我們信任的那台主機簽的才放行，
    其他一律取消載入。要在建立視窗之前呼叫。不改 Windows 的系統設定，只影響這個程式自己的視窗。
    """
    from webview.platforms import edgechromium

    action = edgechromium.CoreWebView2ServerCertificateErrorAction

    def on_certificate_error(_self, _sender, args):
        allowed = False
        try:
            target = urlsplit(str(args.RequestUri))
            leaf = ssl.PEM_cert_to_DER_cert(str(args.ServerCertificate.ToPemEncoding()))
            allowed = TRUST.allows(target.hostname or "", target.port or DEFAULT_PORTS["https"], leaf)
        except Exception as e:
            logger.warning("檢查主機憑證時出錯，不放行：%s", e)
        args.set_Action(action.AlwaysAllow if allowed else action.Cancel)

    edgechromium.EdgeChrome.on_certificate_error = on_certificate_error
    # 這個設定在 pywebview 裡的意思是「把上面那個檢查函式掛上去」；放不放行由函式決定，不是一律略過
    webview.settings["IGNORE_SSL_ERRORS"] = True


def connect_page(server: str, first_run: bool) -> str:
    """連線設定頁：第一次用（還沒設定過主機）和「原本連得上、現在連不上」說法不一樣"""
    if first_run:
        title, text, value = "連線到公司的 Corphia AI", f"請輸入主機的位址（例如 {EXAMPLE_SERVER}）。位址可以問管理者，或在主機的管理後台「區域網路」查看。", ""
    else:
        title, text, value = "連不上主機", f"請確認公司的 Corphia AI 主機已經啟動，或輸入正確的位址（例如 {EXAMPLE_SERVER}）。", server
    return CONNECT_PAGE.replace("__TITLE__", title).replace("__TEXT__", text).replace("__SERVER__", value)


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
  .pin { display:none; margin-top:16px; } .pin p { margin:0 0 10px; }
  code { display:block; padding:12px 16px; border-radius:16px; background:#18181a; color:#fff; font:13px/1.6 Consolas,monospace; word-break:break-all; user-select:text; }
</style></head><body><div class="card">
  <h1>__TITLE__</h1>
  <p>__TEXT__</p>
  <input id="url" value="__SERVER__" spellcheck="false" autofocus>
  <div class="pin" id="pin"><p>第一次連這台主機。請核對下面這串指紋和主機管理後台「區域網路」的 QR 碼畫面上顯示的開頭一樣，確認連到的是公司的主機：</p><code id="fp"></code></div>
  <button id="go">連線</button><div class="err" id="err"></div>
</div><script>
  let confirmed = '';  // 使用者核對過的指紋；改了位址就要重新核對
  const go = async () => {
    const err = document.getElementById('err'); err.textContent = '連線中…';
    const r = await window.pywebview.api.set_server(document.getElementById('url').value, confirmed);
    if (r.confirm) {
      confirmed = r.confirm;
      document.getElementById('fp').textContent = r.confirm;
      document.getElementById('pin').style.display = 'block';
      document.getElementById('go').textContent = '指紋相符，連線';
      err.textContent = '';
    } else if (!r.ok) err.textContent = r.error;
  };
  document.getElementById('url').oninput = () => {
    confirmed = '';
    document.getElementById('pin').style.display = 'none';
    document.getElementById('go').textContent = '連線';
  };
  document.getElementById('go').onclick = go;
  document.getElementById('url').onkeydown = (e) => { if (e.key === 'Enter') go(); };
</script></body></html>"""


BOOT_PAGE = """<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><title>Corphia AI</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; height:100vh; display:flex; align-items:center; justify-content:center; background:#18181a; color:#fff;
         font-family:"Microsoft JhengHei","Noto Sans TC",system-ui,sans-serif; }
  .card { width:min(420px,calc(100vw - 40px)); padding:28px; border-radius:32px; background:#262629; box-shadow:0 12px 40px rgba(0,0,0,.4); text-align:center; }
  h1 { margin:0 0 6px; font-size:22px; } p { margin:0; font-size:14px; line-height:1.6; color:#b6b6c0; }
  .spin { width:34px; height:34px; margin:0 auto 18px; border-radius:50%; border:3px solid #38383c; border-top-color:#0a84ff; animation:turn .9s linear infinite; }
  @keyframes turn { to { transform:rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .spin { animation-duration:2.4s; } }
  pre { display:none; margin:16px 0 0; padding:14px 16px; border-radius:16px; background:#18181a; color:#ff6961; font-size:12px; line-height:1.5;
        text-align:left; white-space:pre-wrap; word-break:break-all; max-height:150px; overflow:auto; }
  button { display:none; margin-top:16px; width:100%; height:46px; border:0; border-radius:23px; background:#0a84ff; color:#fff; font-size:15px; font-weight:600; cursor:pointer; }
  button:active { transform:scale(.98); }
  .failed .spin { display:none; } .failed pre, .failed button { display:block; }
  /* 正常情況一兩秒內就會換成介面自己的啟動進度畫面：這張卡片先不出現，等太久或失敗才顯示 */
  .card { opacity:0; transition:opacity .3s ease; } .card.show { opacity:1; }
</style></head><body><div class="card" id="card">
  <div class="spin"></div>
  <h1 id="title">正在啟動 Corphia AI</h1>
  <p id="text">正在開啟這台電腦上的服務，第一次會比較久。</p>
  <pre id="detail"></pre>
  <button id="retry">再試一次</button>
</div><script>
  const $ = (id) => document.getElementById(id);
  let timer = null;
  let asking = false;
  const tick = async () => {
    if (asking || !(window.pywebview && window.pywebview.api)) return;
    asking = true;  // 上一個詢問還沒回來就不再問（桌面版那邊也只會處理一個）
    let s;
    try { s = await window.pywebview.api.boot_state(); } finally { asking = false; }
    if (s.phase === 'error') {
      clearInterval(timer);
      $('card').className = 'card show failed';
      $('title').textContent = '啟動沒有成功';
      $('text').textContent = '完整記錄在 ' + (s.log || '');
      $('detail').textContent = s.detail || '';
    } else if (s.phase === 'starting' && (s.step || s.seconds >= 20)) {
      $('text').textContent = (s.step ? '正在準備：' + s.step : '資料庫和 AI 模型還在準備中') + '（已等 ' + s.seconds + ' 秒）';
    }
  };
  const begin = () => {
    timer = setInterval(tick, 300);
    setTimeout(() => $('card').classList.add('show'), 6000);
  };
  $('retry').onclick = async () => {
    $('card').className = 'card show';
    $('title').textContent = '正在啟動 Corphia AI';
    $('text').textContent = '正在開啟這台電腦上的服務，第一次會比較久。';
    await window.pywebview.api.boot_retry();
    begin();
  };
  begin();
</script></body></html>"""


class Api:
    """介面可以呼叫的方法（pywebview 會把公開方法都暴露給頁面，所以內部用的東西都放在 _ 開頭的屬性）"""

    def __init__(self, server: str):
        self._server = server
        self._window = None
        # 現在顯示的是不是我們自己的連線設定頁（只有它可以改伺服器位址）
        self._connect_page = False
        # 這台電腦上的整套服務（桌面版自己啟動時才有）；_boot_page＝現在顯示的是內建的啟動畫面
        self._stack: LocalStack | None = None
        self._boot_page = False
        self._boot_lock = threading.Lock()
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
        if self._allowed(token):
            return fn()
        # 被擋下的原因寫進記錄（不記通行碼本身）：按鈕沒反應時才分得出是通行碼沒發到、還是網址不對
        state = "沒帶" if not token else ("桌面版還沒發" if not self._token else ("不符" if token != self._token else "符合"))
        logger.warning("橋的呼叫被擋下：通行碼%s；目前網址 %s；設定的伺服器 %s", state, self._current_url()[:80], self._server)
        return {"ok": False, "error": "這個頁面不能使用桌面功能"}

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

    def note(self, text: str = "") -> dict:
        """介面把「發生了什麼」記到桌面版的記錄檔（只寫記錄、不做任何事；按鈕沒反應時用來查是哪一步斷掉）"""
        logger.info("介面：%s", " ".join(str(text)[:300].split()))
        return {"ok": True}

    def save_file(self, token: str, filename: str = "", content: str = "") -> dict:
        """把 AI 寫的內容存成這台電腦的檔案：跳出「另存新檔」讓使用者自己選位置（按取消就不寫）"""
        logger.info("存檔：收到介面的呼叫（%s，%s 字）", local_files.safe_name(str(filename)), len(str(content)))
        def run() -> dict:
            folder = local_files.output_dir()
            try:
                folder.mkdir(parents=True, exist_ok=True)
                path = self._ask_save_path(str(folder), local_files.safe_name(str(filename)))
            except Exception as e:
                logger.exception("開不了存檔視窗")
                return {"ok": False, "error": f"開不了存檔視窗：{str(e)[:160]}"}
            if not path:
                logger.info("存檔：使用者取消")
                return {"ok": False, "cancelled": True, "error": "已取消"}
            try:
                result = local_files.save_text(path, str(content))
            except local_files.SaveError as e:
                logger.info("存檔被擋下：%s", e)
                return {"ok": False, "error": str(e)}
            logger.info("已存檔：%s（%s 字）", result["path"], result["chars"])
            return {"ok": True, **result}

        return self._guard(token, run)

    def _ask_save_path(self, folder: str, name: str) -> str:
        """
        跳出系統的「另存新檔」，回使用者選的完整路徑（按取消回空字串）；開不起來就丟例外。
        自己開而不用 pywebview 的 create_file_dialog：那個函式出錯時只會回 None，和「使用者按取消」分不出來，
        結果就是按了存檔卻什麼都沒發生、也沒有任何訊息。這裡一律排到視窗自己的主執行緒去開
        （介面呼叫橋是在背景執行緒，系統對話框要在主執行緒才保證開得起來），出錯會如實回報。
        """
        import System.Windows.Forms as WinForms
        from System import Func, Object

        form = self._window.native

        def ask():
            dialog = WinForms.SaveFileDialog()
            dialog.InitialDirectory = folder
            dialog.FileName = name
            dialog.Filter = "所有檔案 (*.*)|*.*"
            dialog.OverwritePrompt = True
            dialog.RestoreDirectory = True
            return dialog.FileName if dialog.ShowDialog(form) == WinForms.DialogResult.OK else ""

        return str(form.Invoke(Func[Object](ask)) or "")

    def set_server(self, url: str, confirmed: str = "") -> dict:
        """
        連線設定頁用：換伺服器位址（連得上才記住並切過去）。
        第一次連一台加密的主機：先回 {"confirm": 指紋} 請使用者核對，使用者按確認後帶著同一串指紋再呼叫一次才會信任。
        """
        # 只有內建的連線設定頁可以改；任何網頁（包含被帶去的外部網頁）都不行，
        # 不然惡意網頁可以把「伺服器」改成自己，變成被信任的來源去操控 Office
        if not self._connect_page or origin(self._current_url()):
            return {"ok": False, "error": "這個頁面不能變更伺服器位址"}
        target = normalize_server(url)
        if not target:
            return {"ok": False, "error": f"位址格式不對，例如 {EXAMPLE_SERVER}"}
        # 只打了主機位址、沒有打埠號：照打的連不上就改試主機預設的埠（多數人只記得 IP）
        candidates = server_candidates(target)
        target = ""
        for candidate in candidates:
            if reachable(candidate):
                target = candidate
                break
            # 連不上可能是「還沒信任這台主機的憑證」：跟它要憑證、實際驗過，再請使用者核對指紋
            found = host_trust.probe(candidate)
            if not found:
                continue
            if confirmed != found["fingerprint"]:
                return {"ok": False, "confirm": found["fingerprint"]}
            TRUST.save(found["pem"])
            TRUST.install_opener()
            logger.info("已信任主機憑證：%s（%s…）", candidate, found["fingerprint"][:23])
            if reachable(candidate):
                target = candidate
                break
        if not target:
            return {"ok": False, "error": "連不上這個位址，請確認主機已經啟動、兩台電腦在同一個網路，而且主機有開啟「區域網路」"}
        self._server = target
        save_server(target)
        self._connect_page = False
        self._window.load_url(target)
        return {"ok": True}

    def boot_state(self) -> dict:
        """啟動畫面用：這台電腦的服務開到哪了；介面連得上就直接切過去"""
        # 一次只處理一個詢問，而且只切換一次：啟動畫面每 0.3 秒問一次，「好了」的那一刻常常有好幾個詢問同時成立。
        # 重複呼叫 load_url 很危險——網址一樣時視窗不會真的重新載入，但「頁面已載入」的狀態已經被清掉、
        # 永遠等不到下一次載入完成，之後所有要確認目前頁面的功能（操控 Office、存檔）都會卡住 20 秒後被擋下。
        with self._boot_lock:
            if not self._on_boot_page():
                return {"phase": "ready"}
            state = self._stack.state()
            if state["phase"] == "ready":
                self._boot_page = False
                logger.info("服務好了，切換到介面：%s", self._server)
                self._window.load_url(self._server)
            return state

    def boot_retry(self) -> dict:
        """啟動畫面用：啟動失敗後再試一次"""
        if not self._on_boot_page():
            return {"ok": False}
        try:
            self._stack.start()
        except Exception as e:
            return {"ok": False, "error": str(e)[:200]}
        return {"ok": True}

    def _on_boot_page(self) -> bool:
        """只有內建的啟動畫面可以問狀態、要求重試（任何網頁都不行）"""
        return bool(self._stack) and self._boot_page and not origin(self._current_url())

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
        logger.info("頁面載入完成：%s", url[:80] or "（內建畫面）")
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
            logger.info("已發通行碼給這一頁")


def _close_file_dialog_when_shown(seen: dict, seconds: int = 8) -> None:
    """自我檢查用：等系統的檔案對話框（視窗類別 #32770）出現，記下來並關掉它"""
    import ctypes
    user32 = ctypes.windll.user32
    found: list = []

    @ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)
    def each(hwnd, _):
        name = ctypes.create_unicode_buffer(32)
        user32.GetClassNameW(hwnd, name, 32)
        pid = ctypes.c_ulong()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        if name.value == "#32770" and pid.value == os.getpid() and user32.IsWindowVisible(hwnd):
            found.append(hwnd)
        return True

    deadline = time.time() + seconds
    while time.time() < deadline and not found:
        user32.EnumWindows(each, 0)
        time.sleep(0.1)
    seen["shown"] = bool(found)
    for hwnd in found:
        user32.PostMessageW(hwnd, 0x0010, 0, 0)  # WM_CLOSE


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
        # 存檔：從介面那一側呼叫（和按鈕走同一條路），確認「另存新檔」視窗真的會出現；出現就自動關掉它（等於按取消）
        result["save_method_exposed"] = bool(window.evaluate_js("!!window.pywebview.api.save_file"))
        shown: dict = {}
        threading.Thread(target=_close_file_dialog_when_shown, args=(shown,), daemon=True).start()
        window.evaluate_js(
            "window.__save = null; window.pywebview.api.save_file(window.__corphiaDesktop || '', 'selftest.txt', 'x')"
            ".then(function (r) { window.__save = r }).catch(function (e) { window.__save = {jsError: String(e)} })")
        for _ in range(SELFTEST_TIMEOUT * 4):
            saved = window.evaluate_js("window.__save")
            if saved:
                break
            time.sleep(0.25)
        result["save_dialog_shown"] = bool(shown.get("shown"))
        result["save_result"] = saved
    except Exception as e:
        result["error"] = str(e)[:300]
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    window.destroy()


def close_splash() -> None:
    """
    收掉啟動畫面。打包成單一 exe 後，從點兩下到視窗出現要 3～5 秒（解壓縮＋視窗元件初始化），
    這段時間由打包工具先顯示一張圖（build.bat 的 --splash），讓使用者知道有點到；視窗一出現就收掉。
    直接用原始碼執行時沒有這張圖，什麼都不做。
    """
    try:
        import pyi_splash  # 只有打包後才有這個模組

        pyi_splash.close()
    except Exception:
        pass


def main() -> int:
    parser = argparse.ArgumentParser(description="Corphia AI 桌面版")
    parser.add_argument("--server", help="伺服器位址（會記住）")
    parser.add_argument("--selftest", metavar="結果檔", help="自我檢查後自動關閉")
    parser.add_argument("--apply-update", metavar="原本的位置", help=argparse.SUPPRESS)  # 更新時由新版自己呼叫
    args = parser.parse_args()
    if args.apply_update:
        close_splash()  # 換檔不開視窗
        return apply_update(Path(args.apply_update))
    # 一次只開一個：已經開著就把那個視窗叫到最前面，自己結束（原因見 single_instance.py）。
    # 要放在開記錄檔之前——不然第二個會把第一個的記錄檔清空。自我檢查不算（它不啟動服務、跑完自己關）
    instance_guard = None if args.selftest else single_instance.acquire()
    if not args.selftest and instance_guard is None:
        close_splash()
        single_instance.focus_existing(APP_NAME)
        return 0
    if not args.selftest:
        cleanup_update()
    # 打包後沒有主控台，記錄寫到檔案（每次啟動重寫）：按鈕沒反應這類問題才查得到原因
    log_file = Path(os.environ.get("LOCALAPPDATA") or Path.home()) / "CorphiaAI" / "desktop.log"
    try:
        log_file.parent.mkdir(parents=True, exist_ok=True)
        logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s",
                            handlers=[logging.FileHandler(log_file, mode="w", encoding="utf-8")])
    except OSError:
        logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    logger.info("Corphia AI 桌面版 %s 啟動", VERSION)

    # 還沒設定過主機、這台電腦也沒有完整安裝：第一次用，直接請使用者輸入主機位址
    first_run = not args.server and not config_path().exists()
    server = normalize_server(args.server) if args.server else load_server()
    if args.server and server and not args.selftest:  # 自我檢查用的位址不要記下來
        save_server(server)
    server = server or DEFAULT_SERVER

    # 主機自己簽的憑證：只信任核對過指紋的那一張（視窗裡的瀏覽器和桌面版自己發的請求都一樣）
    TRUST.install_opener()
    enable_pinned_certificates()

    api = Api(server)
    online = reachable(server)
    # 伺服器就是這台電腦、而且桌面程式放在完整安裝裡：服務沒開就自己帶起來（不用先按一鍵啟動）
    # （用一鍵啟動開著開發模式時，上面那個位址連得上，照舊用它；不然改用後端直接提供的介面）
    install = find_install_dir(Path(sys.executable if getattr(sys, "frozen", False) else __file__))
    boot_html = None
    if not online and not args.selftest and install and is_local_server(server):
        server = api._server = LOCAL_UI_URL
        online = serves_ui(server)
        if not online:
            api._stack = LocalStack(install, lambda: serves_ui(LOCAL_UI_URL))
            try:
                api._stack.start()
                boot_html = BOOT_PAGE
            except Exception as e:
                logger.warning("自動啟動服務失敗：%s", e)
                api._stack = None
    window = webview.create_window(
        APP_NAME,
        url=server if online else None,
        html=None if online else (boot_html or connect_page(server, first_run)),
        js_api=api,
        # 一開就填滿螢幕（最大化，保留工作列和視窗的標題列）；按「還原」時回到 WINDOW_SIZE 這個大小
        width=WINDOW_SIZE[0], height=WINDOW_SIZE[1], min_size=WINDOW_MIN, maximized=True,
        text_select=True, background_color="#18181a",
    )
    api._window = window
    api._boot_page = bool(boot_html)
    api._connect_page = not online and not boot_html
    window.events.loaded += api._on_loaded
    window.events.shown += close_splash  # 視窗出來了：收掉啟動畫面
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
    # 視窗關了：這次是桌面版自己啟動的服務就一起關掉（和一鍵關閉一樣；原本就開著的不動）
    if api._stack:
        api._stack.stop()
    return 0


if __name__ == "__main__":
    sys.exit(main())
