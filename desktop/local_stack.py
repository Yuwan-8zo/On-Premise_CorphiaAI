"""
這台電腦上的整套服務（資料庫、後端、AI 引擎、介面）：桌面版點開時自己帶起來，關掉視窗時一起關掉

桌面程式放在一份完整安裝裡（往上找得到 start.py、stop.py、backend/）而且設定的伺服器就是這台電腦時，
使用者不用先按「一鍵啟動」、也不用開瀏覽器：
  啟動  在背景執行安裝資料夾的 start.py --built（不開瀏覽器、不跳黑色視窗、不開前端開發伺服器——
        介面由後端直接提供，執行時不需要 Node），輸出寫到 .runtime/desktop-start.log
  關閉  關掉視窗「不會」關服務：這台電腦是主機時，公司其他電腦和手機都連著它。
        stop() 留給明確要求關閉的情況用（執行 stop.py，和按「一鍵關閉」一樣）；
        而且只關「這次是桌面版自己啟動的」，原本就開著的不動

這個檔案不碰視窗（不 import webview），判斷邏輯可以單獨測試（backend/tests/test_backup_and_desktop_helpers.py）。
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Callable, Optional
from urllib.parse import urlsplit
import urllib.request

LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}
# 桌面版自己啟動時介面的位址：後端直接提供介面（start.py --built），和後端同一個埠
LOCAL_UI_URL = "http://localhost:8168"
UI_CHECK_TIMEOUT = 3
# 往上最多找幾層（exe 在 安裝資料夾/desktop/dist/ 底下，三層就夠；多留一點給搬動過的情況）
INSTALL_SEARCH_DEPTH = 6
START_LOG = "desktop-start.log"
STOP_LOG = "desktop-stop.log"
# 關閉服務最多等多久（秒）：資料庫要正常收尾，太早放棄可能留下沒關乾淨的程序
STOP_TIMEOUT = 180
# 打包成單一 exe 時留在環境變數裡、只對自己有意義的設定；帶給別的 Python 會讓它載入錯的程式庫
_FROZEN_ENV_PREFIXES = ("_PYI_", "_MEI")


def find_install_dir(start: Path) -> Optional[Path]:
    """從桌面程式的位置往上找完整安裝（有 start.py、stop.py、backend/ 的資料夾）；找不到回 None"""
    for folder in list(start.resolve().parents)[:INSTALL_SEARCH_DEPTH]:
        if (folder / "start.py").is_file() and (folder / "stop.py").is_file() and (folder / "backend").is_dir():
            return folder
    return None


def is_local_server(url: str) -> bool:
    """設定的伺服器是不是這台電腦（是的話才由桌面版自己啟動；連公司別台伺服器時不啟動任何東西）"""
    try:
        return (urlsplit(url or "").hostname or "").lower() in LOCAL_HOSTS
    except ValueError:
        return False


def serves_ui(url: str) -> bool:
    """這個位址現在有沒有提供介面（回的是網頁）。只開著 API、沒提供介面的後端回的是 JSON，不算"""
    try:
        with urllib.request.urlopen(url, timeout=UI_CHECK_TIMEOUT) as r:
            return "text/html" in (r.headers.get("Content-Type") or "")
    except Exception:
        return False


def find_python(install: Path) -> Optional[str]:
    """執行 start.py／stop.py 用的 Python：安裝資料夾自己的環境優先，沒有才用系統的"""
    venv = install / "backend" / ".venv" / "Scripts" / "python.exe"
    if venv.is_file():
        return str(venv)
    return shutil.which("python") or shutil.which("py")


def clean_env(env: dict[str, str]) -> dict[str, str]:
    """給 start.py／stop.py 的環境變數：拿掉打包程式自己用的設定，輸出固定用 UTF-8（記錄檔才不會亂碼）"""
    out = {k: v for k, v in env.items() if not k.upper().startswith(_FROZEN_ENV_PREFIXES)}
    out["PYTHONIOENCODING"] = "utf-8"
    return out


def _reset_dll_directory() -> None:
    """打包成單一 exe 時，Windows 會把自己的暫存資料夾排在程式庫搜尋路徑最前面，子程序也會繼承；先還原"""
    if sys.platform == "win32" and getattr(sys, "frozen", False):
        try:
            import ctypes
            ctypes.windll.kernel32.SetDllDirectoryW(None)
        except Exception:
            pass


class LocalStack:
    """安裝資料夾裡那一整套服務的啟動與關閉"""

    def __init__(self, install: Path, is_up: Callable[[], bool]):
        self.install = install
        self._is_up = is_up
        self._proc: Optional[subprocess.Popen] = None
        self._log = None
        self._started_at = 0.0
        # 這次是不是桌面版自己啟動的（stop() 只關自己啟動的）
        self.owned = False

    @property
    def log_path(self) -> Path:
        return self.install / ".runtime" / START_LOG

    def _popen(self, script: str, log_name: str) -> subprocess.Popen:
        python = find_python(self.install)
        if not python:
            raise RuntimeError("找不到 Python，請先安裝 Python 3.11 以上版本")
        runtime = self.install / ".runtime"
        runtime.mkdir(parents=True, exist_ok=True)
        self._log = open(runtime / log_name, "w", encoding="utf-8", errors="replace")
        _reset_dll_directory()
        args = [python, str(self.install / script)] + (["--skip-browser", "--built"] if script == "start.py" else [])
        return subprocess.Popen(
            args, cwd=str(self.install), env=clean_env(dict(os.environ)),
            stdin=subprocess.DEVNULL, stdout=self._log, stderr=subprocess.STDOUT,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )

    def start(self) -> None:
        """服務還沒開就在背景啟動（已經開著就什麼都不做，也不算是自己啟動的）"""
        if self._is_up() or (self._proc and self._proc.poll() is None):
            return
        self._proc = self._popen("start.py", START_LOG)
        self._started_at = time.time()
        self.owned = True

    def state(self) -> dict:
        """給啟動畫面看的狀態：ready＝介面連得上了；error＝啟動程式自己結束了（附最後幾行記錄）；其餘是 starting"""
        if self._is_up():
            return {"phase": "ready"}
        seconds = int(time.time() - self._started_at) if self._started_at else 0
        if self._proc and self._proc.poll() is not None:
            return {"phase": "error", "detail": self._log_tail(), "log": str(self.log_path), "seconds": seconds}
        return {"phase": "starting", "seconds": seconds, "step": self._current_step()}

    def _current_step(self) -> str:
        """start.py 現在做到哪一步（它寫在 frontend/public/boot-status.json）；讀不到回空字串"""
        try:
            status = json.loads((self.install / "frontend" / "public" / "boot-status.json").read_text(encoding="utf-8"))
            return next((s.get("label") or "" for s in status.get("steps", []) if s.get("state") == "running"), "")
        except Exception:
            return ""

    def _log_tail(self, lines: int = 6) -> str:
        try:
            text = self.log_path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            return ""
        return "\n".join([line for line in text.splitlines() if line.strip()][-lines:])

    def stop(self) -> None:
        """關掉自己啟動的服務（等它做完）；不是自己啟動的不動"""
        if not self.owned:
            return
        self.owned = False
        try:
            self._popen("stop.py", STOP_LOG).wait(timeout=STOP_TIMEOUT)
        except Exception:
            pass
        # stop.py 會把啟動程式一起關掉；萬一還在（例如 stop.py 自己失敗），連同它開的程序一起結束
        if self._proc and self._proc.poll() is None:
            subprocess.run(["taskkill", "/F", "/T", "/PID", str(self._proc.pid)], capture_output=True,
                           creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
