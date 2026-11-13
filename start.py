"""
Corphia AI one-click local launcher.

This starts the full local development stack:
  1. PostgreSQL + pgvector — native (scripts/setup_postgres.py) if set up, otherwise Docker
  2. Backend environment checks, llama-cpp-python, and DB initialization
  3. FastAPI backend
  4. Vite frontend
  5. Browser at http://localhost:5173

Docker (if used at all) only runs PostgreSQL as a fallback, plus the optional self-hosted
SearXNG for external web search (ENABLE_WEB_SEARCH=true). See README "不靠 Docker".
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import signal
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from urllib.parse import urlparse


if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


BASE_DIR = Path(__file__).resolve().parent
BACKEND_DIR = BASE_DIR / "backend"
FRONTEND_DIR = BASE_DIR / "frontend"
RUNTIME_DIR = BASE_DIR / ".runtime"
BACKEND_PORT = 8168
FRONTEND_PORT = 5173

sys.path.insert(0, str(BASE_DIR / "scripts"))
from setup_postgres import PGDATA_DIR as NATIVE_PGDATA_DIR  # noqa: E402
from setup_postgres import PG_PORT as NATIVE_PG_PORT  # noqa: E402
from setup_postgres import native_postgres_ready, pg_bin_dir  # noqa: E402
DEFAULT_DB_PORT = 5433

PROCESSES: list[subprocess.Popen] = []
SHUTDOWN_PROCESSES: list[subprocess.Popen] = []
LOG_HANDLES = []

LAN_RUNTIME_PATH = RUNTIME_DIR / "lan.json"


def read_lan_enabled() -> bool:
    """
    區域網路 (LAN) 開關（只用來顯示目前狀態）：
    - False: 只允許本機
    - True:  允許區網其他裝置

    寫入來源：管理後台的「區域網路開關」會更新 .runtime/lan.json。
    生效時機：立即。前端伺服器一律聽 0.0.0.0，由 frontend/vite-plugins/lanGate.ts 每個請求讀 lan.json 決定放不放行；
    後端固定只聽 127.0.0.1，區網裝置經由前端伺服器轉送。
    """
    try:
        if not LAN_RUNTIME_PATH.exists():
            return False
        import json
        data = json.loads(LAN_RUNTIME_PATH.read_text(encoding="utf-8"))
        return bool(data.get("lan_enabled"))
    except Exception:
        return False


# 後端只給本機（前端伺服器轉送 /api、/ws）；前端伺服器聽所有介面，區網放不放行由 lanGate 即時決定
BACKEND_HOST = "127.0.0.1"
FRONTEND_HOST = "0.0.0.0"


def info(message: str = "") -> None:
    print(message, flush=True)


def ok(message: str) -> None:
    info(f"[OK] {message}")


def warn(message: str) -> None:
    info(f"[WARN] {message}")


def fail(message: str) -> None:
    info(f"[ERROR] {message}")


def run(
    cmd: list[str],
    cwd: Path = BASE_DIR,
    timeout: int | None = None,
    quiet: bool = False,
    env: dict[str, str] | None = None,
) -> subprocess.CompletedProcess:
    # NOTE: 必須指定 encoding="utf-8"。
    # Windows 上 text=True 預設用 locale 的 cp950，子程序若印 emoji 或非 BMP 字元
    # （例如 schema init 印 ✅ 🚀），讀取執行緒會丟 UnicodeDecodeError 並炸出 traceback，
    # 雖然不會中斷 start.py 主流程，但 console 看起來像出錯。
    # errors="replace" 是雙保險：萬一遇到無法解碼的 byte 就替換掉而不是 raise。
    return subprocess.run(
        cmd,
        cwd=str(cwd),
        timeout=timeout,
        env=env,
        text=True,
        encoding="utf-8",
        errors="replace",
        capture_output=quiet,
        check=False,
    )


def run_logged(
    cmd: list[str],
    cwd: Path,
    log_name: str,
    timeout: int | None = None,
    env: dict[str, str] | None = None,
) -> subprocess.CompletedProcess:
    result = run(cmd, cwd=cwd, timeout=timeout, quiet=True, env=env)
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
    log_path = RUNTIME_DIR / log_name
    output = (result.stdout or "") + (result.stderr or "")
    log_path.write_text(output, encoding="utf-8", errors="replace")
    return result


def read_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values

    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def database_port() -> int:
    backend_env = read_env(BACKEND_DIR / ".env")
    url = backend_env.get("DATABASE_URL", "")
    if url:
        try:
            parsed = urlparse(url)
            if parsed.port:
                return parsed.port
        except ValueError:
            pass

    root_env = read_env(BASE_DIR / ".env")
    return int(os.environ.get("POSTGRES_PORT") or root_env.get("POSTGRES_PORT") or DEFAULT_DB_PORT)


def wait_for_tcp(host: str, port: int, timeout: int = 60) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection((host, port), timeout=2):
                return True
        except OSError:
            time.sleep(1)
    return False


def wait_for_http(url: str, timeout: int = 90) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=3) as response:
                if response.status < 500:
                    return True
        except Exception:
            time.sleep(1)
    return False


def find_backend_python() -> Path:
    candidates = [
        BACKEND_DIR / ".venv" / "Scripts" / "python.exe",
        BACKEND_DIR / "venv" / "Scripts" / "python.exe",
        BACKEND_DIR / ".venv" / "bin" / "python",
        BACKEND_DIR / "venv" / "bin" / "python",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return Path(sys.executable)


def create_backend_venv() -> Path:
    venv_python = BACKEND_DIR / ".venv" / "Scripts" / "python.exe"
    if venv_python.exists():
        return venv_python

    info("[setup] Creating backend virtual environment...")
    result = run([sys.executable, "-m", "venv", str(BACKEND_DIR / ".venv")], timeout=300)
    if result.returncode != 0:
        raise RuntimeError("Failed to create backend virtual environment.")
    return venv_python if venv_python.exists() else find_backend_python()


def python_can_import(python_exe: Path, modules: list[str]) -> bool:
    # 只檢查「是否已安裝」而不真的 import 執行模組本體。
    # 像 sentence_transformers / torch 在 Windows 上首次 import 可能很慢，
    # 直接 import 容易超時誤判成「未安裝」。
    probe = (
        "import importlib.util\n"
        "mods = " + repr(modules) + "\n"
        "missing = [m for m in mods if importlib.util.find_spec(m) is None]\n"
        "raise SystemExit(1 if missing else 0)\n"
    )
    result = run([str(python_exe), "-c", probe], cwd=BACKEND_DIR, quiet=True, timeout=30)
    return result.returncode == 0


def ensure_backend_dependencies(python_exe: Path) -> None:
    # 這裡檢查「實際會在啟動期被 import/使用」的核心依賴，避免只檢查 fastapi/uvicorn
    # 卻漏掉 RAG/搜尋相關套件，導致服務啟動後才在 log 裡爆 ModuleNotFoundError。
    if python_can_import(
        python_exe,
        [
            "fastapi",
            "uvicorn",
            "sqlalchemy",
            "asyncpg",
            "sentence_transformers",
        ],
    ):
        ok("Backend Python dependencies are ready")
        return

    requirements = BACKEND_DIR / "requirements.txt"
    if not requirements.exists():
        raise RuntimeError("backend/requirements.txt was not found.")

    # Windows 偶發 WinError 32（檔案被掃毒/索引/殘留 python process 鎖住）
    # 導致 pip 安裝中斷。這裡做有限次重試，讓一鍵啟動更穩定。
    info("[setup] Installing backend dependencies...")
    cmd = [
        str(python_exe),
        "-m",
        "pip",
        "install",
        "--no-cache-dir",
        "-r",
        str(requirements),
    ]
    last_rc = 1
    for attempt in range(1, 4):
        result = run(cmd, cwd=BACKEND_DIR, timeout=1800)
        last_rc = result.returncode
        if last_rc == 0:
            ok("Backend dependencies installed")
            return
        warn(f"Backend dependency installation failed (attempt {attempt}/3). Retrying in {attempt * 3}s...")
        time.sleep(attempt * 3)

    raise RuntimeError("Backend dependency installation failed.")


def ensure_frontend_dependencies() -> None:
    node_modules = FRONTEND_DIR / "node_modules"
    if node_modules.exists():
        ok("Frontend dependencies are ready")
        return

    npm = shutil.which("npm")
    if not npm:
        raise RuntimeError("npm was not found. Please install Node.js first.")

    info("[setup] Installing frontend dependencies...")
    result = run([npm, "install"], cwd=FRONTEND_DIR, timeout=1200)
    if result.returncode != 0:
        raise RuntimeError("Frontend dependency installation failed.")
    ok("Frontend dependencies installed")


def llama_cpp_installed(python_exe: Path) -> bool:
    return python_can_import(python_exe, ["llama_cpp"])


def run_auto_engine(python_exe: Path, force: bool) -> None:
    script = BACKEND_DIR / "auto_engine.py"
    if not script.exists():
        warn("backend/auto_engine.py was not found; skipping llama-cpp-python auto setup")
        return

    if llama_cpp_installed(python_exe) and not force:
        ok("llama-cpp-python is installed")
        return

    info("[setup] Checking llama-cpp-python...")
    args = [str(python_exe), str(script), "--force"]
    result = run_logged(args, cwd=BACKEND_DIR, log_name="auto-engine.log", timeout=1200)
    if result.returncode != 0:
        warn(f"llama-cpp-python auto setup reported a problem. See {RUNTIME_DIR / 'auto-engine.log'}")
    elif llama_cpp_installed(python_exe):
        ok("llama-cpp-python is installed")
    else:
        warn(f"llama-cpp-python is still missing after auto setup. See {RUNTIME_DIR / 'auto-engine.log'}")


def docker_info_ok() -> bool:
    docker = shutil.which("docker")
    if not docker:
        return False
    try:
        result = run([docker, "info"], quiet=True, timeout=8)
    except subprocess.TimeoutExpired:
        # Docker Desktop is still booting; treat as "not ready yet" and keep waiting.
        return False
    return result.returncode == 0


# ── Live startup status for the browser ─────────────────────────────────────
# start.py writes each step's state to frontend/public/boot-status.json; the
# frontend boot screen polls it (plus /api/v1/health for the AI models) so the
# audience sees what is loading instead of a blank wait.
BOOT_STATUS_PATH = FRONTEND_DIR / "public" / "boot-status.json"
BOOT_STEPS = [
    ("docker", "Docker 容器服務"),
    ("database", "PostgreSQL 資料庫"),
    ("engine", "AI 推論引擎（llama.cpp）"),
    ("schema", "資料表與預設資料"),
    ("backend", "後端 API 伺服器"),
]
BOOT: dict = {}
_BOOT_WRITE_LOCK = __import__("threading").Lock()


def _boot_write() -> None:
    # 對外搜尋在背景啟動時也會更新進度：兩邊同時寫同一個暫存檔會互相蓋掉，一次只讓一邊寫
    with _BOOT_WRITE_LOCK:
        _boot_write_locked()


def _boot_write_locked() -> None:
    import json

    if not BOOT:
        return
    BOOT["updated_at"] = time.time()
    data = json.dumps(BOOT, ensure_ascii=False)
    try:
        BOOT_STATUS_PATH.parent.mkdir(parents=True, exist_ok=True)
        tmp = BOOT_STATUS_PATH.with_suffix(".tmp")
        tmp.write_text(data, encoding="utf-8")
    except OSError:
        return  # status display is best-effort; never block startup
    # On Windows the replace fails while the dev server is reading the file
    # for the browser, so retry briefly and fall back to a direct write.
    for _ in range(10):
        try:
            os.replace(tmp, BOOT_STATUS_PATH)
            return
        except OSError:
            time.sleep(0.05)
    try:
        BOOT_STATUS_PATH.write_text(data, encoding="utf-8")
    except OSError:
        pass


def boot_init() -> None:
    BOOT.clear()
    BOOT.update({
        "run_id": f"{os.getpid()}-{int(time.time())}",
        "overall": "starting",
        "started_at": time.time(),
        "message": "",
        "steps": [
            {"key": k, "label": label, "state": "pending", "detail": "", "started_at": None, "finished_at": None}
            for k, label in BOOT_STEPS
            # 資料庫直接裝在這台電腦時，系統本身用不到 Docker（只剩對外搜尋在背景用）：啟動畫面不列這一項
            if not (k == "docker" and native_postgres_ready())
        ],
    })
    _boot_write()


def boot(key: str, state: str | None = None, detail: str | None = None, code: str | None = None) -> None:
    """Update one step: state in pending/running/done/error/skipped.
    code：說明的代碼，前端啟動畫面用它顯示目前語言的文字（沒有代碼就直接顯示 detail，例如網址）"""
    if not BOOT:
        return
    for step in BOOT["steps"]:
        if step["key"] != key:
            continue
        now = time.time()
        if state:
            if state == "running" and step["started_at"] is None:
                step["started_at"] = now
            if state in ("done", "error", "skipped"):
                step["started_at"] = step["started_at"] or now
                step["finished_at"] = now
            step["state"] = state
        if detail is not None:
            step["detail"] = detail
            step["code"] = code
    _boot_write()


def boot_fail_running(message: str) -> None:
    if not BOOT:
        return
    for step in BOOT["steps"]:
        if step["state"] == "running":
            step["state"] = "error"
            step["finished_at"] = time.time()
            step["detail"] = message[:300]
            step["code"] = None  # 顯示錯誤原因本身，不要用之前的說明代碼
    BOOT["overall"] = "error"
    BOOT["message"] = message[:300]
    _boot_write()


DOCKER_PROCESS_NAMES = ("Docker Desktop.exe", "com.docker.backend.exe", "com.docker.build.exe",
                        "docker-ai.exe", "docker-mcp.exe")


def docker_desktop_running() -> bool:
    if sys.platform != "win32":
        return False
    result = run(["tasklist", "/FI", "IMAGENAME eq Docker Desktop.exe", "/NH"], quiet=True, timeout=15)
    return "Docker Desktop.exe" in (result.stdout or "")


def reset_docker_vm() -> None:
    """Stop only Docker's own WSL virtual machine. When Docker Desktop is killed,
    this VM can stay half-running and the engine then never answers."""
    if sys.platform == "win32":
        try:
            run(["wsl", "--terminate", "docker-desktop"], quiet=True, timeout=60)
        except subprocess.TimeoutExpired:
            pass


def kill_docker_desktop() -> None:
    for name in DOCKER_PROCESS_NAMES:
        run(["taskkill", "/F", "/IM", name], quiet=True, timeout=15)
    time.sleep(3)
    reset_docker_vm()


def clear_stale_docker_sockets() -> None:
    """
    If Docker Desktop was not shut down cleanly, it leaves socket files behind
    (e.g. Docker\\run\\dockerInference, docker-secrets-engine\\engine.sock).
    On the next start it cannot delete them and crashes with
    "The file cannot be accessed by the system". Only call this while Docker
    Desktop is NOT running: the folders are moved aside (nothing is deleted)
    and Docker recreates them.
    """
    import stat as stat_mod

    local = Path(os.environ.get("LOCALAPPDATA", ""))
    for folder in (local / "Docker" / "run", local / "docker-secrets-engine"):
        if not folder.is_dir():
            continue
        has_socket = False
        try:
            for entry in os.scandir(folder):
                attrs = getattr(entry.stat(follow_symlinks=False), "st_file_attributes", 0)
                if attrs & stat_mod.FILE_ATTRIBUTE_REPARSE_POINT:
                    has_socket = True
                    break
        except OSError:
            has_socket = True
        if has_socket:
            target = folder.with_name(f"{folder.name}.stale-{time.strftime('%Y%m%d-%H%M%S')}")
            try:
                folder.rename(target)
                info(f"[docker] Moved leftover Docker files aside: {target.name}")
            except OSError as exc:
                warn(f"Could not move {folder}: {exc}")


def launch_docker_desktop() -> None:
    candidates = [
        Path(os.environ.get("PROGRAMFILES", r"C:\Program Files")) / "Docker" / "Docker" / "Docker Desktop.exe",
        Path(os.environ.get("LOCALAPPDATA", "")) / "Docker" / "Docker" / "Docker Desktop.exe",
    ]
    for candidate in candidates:
        if candidate.exists():
            subprocess.Popen([str(candidate)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return
    raise RuntimeError("Docker Desktop was not found. Install Docker Desktop or start it manually.")


def wait_for_docker(seconds: int) -> bool:
    deadline = time.time() + seconds
    while time.time() < deadline:
        if docker_info_ok():
            return True
        _boot_write()  # heartbeat so the browser knows we are still working
        time.sleep(2)
    return False


def start_docker_desktop() -> None:
    boot("docker", "running", "檢查 Docker 是否已在執行…", code="docker_check")
    if docker_info_ok():
        ok("Docker daemon is ready")
        boot("docker", "done", "已在執行", code="docker_running")
        return

    info("[docker] Docker daemon is not ready. Starting Docker Desktop...")
    if docker_desktop_running():
        # Docker was opened some other way (e.g. its own icon) and is not answering:
        # usually it crashed on leftover files and is showing an error dialog.
        # Give it a short grace period in case it is still booting, then repair.
        boot("docker", detail="Docker 已開啟但沒有回應，確認中…", code="docker_unresponsive")
        if wait_for_docker(30):
            ok("Docker daemon is ready")
            boot("docker", "done", "已在執行", code="docker_running")
            return
        warn("Docker Desktop is open but not responding. Restarting it cleanly...")
        boot("docker", detail="Docker 沒有回應：重置 Docker 虛擬機並重新啟動…", code="docker_reset")
        kill_docker_desktop()
    boot("docker", detail="清理上次留下的殘留檔…", code="docker_cleanup")
    reset_docker_vm()
    clear_stale_docker_sockets()
    launch_docker_desktop()

    # A cold boot of Docker Desktop can take a couple of minutes.
    boot("docker", detail="啟動 Docker Desktop（冷開機約 1～2 分鐘）…", code="docker_starting")
    if wait_for_docker(150):
        ok("Docker daemon is ready")
        boot("docker", "done", "啟動完成", code="docker_started")
        return

    # Still not up: most likely Docker crashed on leftover files. Restart it cleanly once.
    warn("Docker Desktop did not start. Closing it, cleaning leftover files and trying once more...")
    boot("docker", detail="Docker 沒有回應：重置 Docker 虛擬機並重新啟動…", code="docker_reset")
    kill_docker_desktop()
    clear_stale_docker_sockets()
    launch_docker_desktop()
    if wait_for_docker(240):
        ok("Docker daemon is ready")
        boot("docker", "done", "自動修復後啟動完成", code="docker_autofixed")
        return

    raise RuntimeError("Docker Desktop did not become ready in time.")


def web_search_enabled() -> bool:
    """對外搜尋功能的開關：讀 backend/.env 的 ENABLE_WEB_SEARCH（和後端 app/core/config.py 的
    enable_web_search 設定共用同一個環境變數，預設關閉——開了才會連自架 SearXNG，也才會把搜尋關鍵字送出網）"""
    value = read_env(BACKEND_DIR / ".env").get("ENABLE_WEB_SEARCH", "")
    return value.strip().lower() in ("1", "true", "yes", "on")


def start_native_database() -> bool:
    """跑過 scripts/setup_postgres.py 的機器：用 pg_ctl 管原生 PostgreSQL，完全不需要 Docker。
    回傳 True 代表這條路走成功了（呼叫端不用再試 Docker）。"""
    if not native_postgres_ready():
        return False
    bin_dir = pg_bin_dir()
    info("[db] Starting native PostgreSQL (no Docker)...")
    boot("database", "running", "啟動原生 PostgreSQL（不靠 Docker）…", code="db_starting")
    log_path = NATIVE_PGDATA_DIR.parent / "postgres.log"
    # 不能接 pg_ctl 的輸出（capture_output）：Windows 上資料庫的背景程序會繼承那條管線，
    # pg_ctl 自己結束後這裡仍然會一直等下去（和 scripts/setup_postgres.py 是同一個問題）。
    # 成不成功看連接埠通不通就好：資料庫已經在執行時 pg_ctl 會回報失敗，但連接埠是通的。
    subprocess.run(
        [str(bin_dir / "pg_ctl.exe"), "-D", str(NATIVE_PGDATA_DIR), "-l", str(log_path), "-w", "start"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, stdin=subprocess.DEVNULL, timeout=120, check=False,
    )
    if not wait_for_tcp("127.0.0.1", NATIVE_PG_PORT, timeout=60):
        raise RuntimeError(f"Native PostgreSQL did not become reachable on localhost:{NATIVE_PG_PORT}. See {log_path}")
    ok(f"Native PostgreSQL is ready on localhost:{NATIVE_PG_PORT}")
    boot("database", "done", f"localhost:{NATIVE_PG_PORT}（原生，無 Docker）")
    return True


def start_database() -> None:
    if start_native_database():
        return

    start_docker_desktop()

    compose_file = BASE_DIR / "docker-compose.yml"
    if not compose_file.exists():
        raise RuntimeError("docker-compose.yml was not found.")

    info("[docker] Starting PostgreSQL + pgvector...")
    boot("database", "running", "啟動 PostgreSQL＋pgvector 容器…", code="db_starting")
    commands = [
        ["docker", "compose", "up", "-d", "postgres"],
        ["docker-compose", "up", "-d", "postgres"],
    ]
    last_output = ""
    for cmd in commands:
        exe = shutil.which(cmd[0])
        if not exe:
            continue
        result = run([exe, *cmd[1:]], cwd=BASE_DIR, quiet=True, timeout=180)
        last_output = (result.stdout or "") + (result.stderr or "")
        if result.returncode == 0:
            port = database_port()
            if wait_for_tcp("127.0.0.1", port, timeout=90):
                ok(f"PostgreSQL + pgvector is ready on localhost:{port}")
                boot("database", "done", f"localhost:{port}")
                return
            raise RuntimeError(f"Database container started, but localhost:{port} did not become reachable.")

    raise RuntimeError(f"Could not start Docker database.\n{last_output}".strip())


def start_searxng_if_enabled() -> None:
    """自架 SearXNG（對外搜尋用）一律走 Docker，跟資料庫是原生還是 Docker 無關；
    沒開對外搜尋功能就什麼都不做（不會為了這個單獨把 Docker Desktop 叫起來）"""
    if not web_search_enabled():
        return
    start_docker_desktop()
    info("[docker] 對外搜尋已開啟，啟動自架 SearXNG…")
    for cmd in (["docker", "compose"], ["docker-compose"]):
        exe = shutil.which(cmd[0])
        if not exe:
            continue
        result = run([exe, *cmd[1:], "--profile", "search", "up", "-d", "searxng"], cwd=BASE_DIR, quiet=True, timeout=180)
        if result.returncode == 0:
            ok("自架 SearXNG 已啟動")
            return
    warn("自架 SearXNG 啟動失敗，對外搜尋這一題會回報「服務目前無法使用」，其他功能不受影響")


def start_searxng_in_background() -> None:
    """背景啟動對外搜尋（見 main）：失敗只影響對外搜尋，不能讓整個啟動失敗"""
    try:
        start_searxng_if_enabled()
    except Exception as exc:
        warn(f"對外搜尋沒有啟動（Docker 沒有就緒）：{exc}")
        boot("docker", "skipped", "Docker 沒有啟動，對外搜尋暫時不能用")


def init_database(python_exe: Path) -> None:
    script = BACKEND_DIR / "scripts" / "init_db.py"
    if not script.exists():
        warn("backend/scripts/init_db.py was not found; skipping DB initialization")
        return

    info("[db] Initializing database schema and default data...")
    result = run_logged([str(python_exe), str(script)], cwd=BACKEND_DIR, log_name="init-db.log", timeout=180)
    if result.returncode != 0:
        raise RuntimeError(f"Database initialization failed. See {RUNTIME_DIR / 'init-db.log'}")
    ok("Database schema is ready")


def kill_port(port: int) -> None:
    if sys.platform != "win32":
        return

    # 參數用清單、不經過系統 shell（和其他指令一致）
    result = subprocess.run(["netstat", "-ano", "-p", "tcp"], capture_output=True, text=True)
    pattern = re.compile(rf"^\s*TCP\s+\S+:{port}\s+\S+\s+LISTENING\s+(\d+)\s*$", re.IGNORECASE)
    pids = set()
    for line in result.stdout.splitlines():
        match = pattern.match(line)
        if match:
            pids.add(match.group(1))

    for pid in pids:
        if pid != "0":
            subprocess.run(["taskkill", "/F", "/T", "/PID", pid], capture_output=True)


def open_log(name: str):
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
    handle = open(RUNTIME_DIR / name, "a", encoding="utf-8", errors="replace")
    LOG_HANDLES.append(handle)
    return handle


MODEL_CHOICE: str | None = None
# --built：不開前端開發伺服器，後端自己提供打包好的介面（frontend/dist），執行時不需要 Node
SERVE_BUILT = False
FRONTEND_DIST = FRONTEND_DIR / "dist"
# 介面的原始檔：比打包結果新就要重新打包
FRONTEND_SOURCES = ("src", "index.html", "package.json", "vite.config.ts", "tailwind.config.js")


def frontend_build_is_stale() -> bool:
    """打包結果不存在，或原始檔比它新（改了介面卻沒重新打包，桌面版會看到舊畫面）"""
    index = FRONTEND_DIST / "index.html"
    if not index.is_file():
        return True
    built_at = index.stat().st_mtime
    for name in FRONTEND_SOURCES:
        path = FRONTEND_DIR / name
        files = path.rglob("*") if path.is_dir() else [path]
        for file in files:
            try:
                if file.is_file() and file.stat().st_mtime > built_at:
                    return True
            except OSError:
                continue
    return False


def ensure_frontend_build() -> None:
    """--built 模式：確保 frontend/dist 是最新的。有 Node 就自動打包；沒有 Node 但已經有打包結果就直接用"""
    if not frontend_build_is_stale():
        ok("Frontend build is up to date")
        return
    npm = shutil.which("npm")
    if not npm:
        if (FRONTEND_DIST / "index.html").is_file():
            warn("Frontend sources changed but npm was not found; using the existing build.")
            return
        raise RuntimeError("介面還沒打包，而且這台電腦沒有 Node.js。請安裝 Node.js 後重試，或放入打包好的 frontend/dist。")
    ensure_frontend_dependencies()
    info("[frontend] Building the interface (first time or after changes, about a minute)...")
    result = run_logged([npm, "run", "build"], cwd=FRONTEND_DIR, log_name="frontend-build.log", timeout=900)
    if result.returncode != 0 or not (FRONTEND_DIST / "index.html").is_file():
        raise RuntimeError(f"Frontend build failed. See {RUNTIME_DIR / 'frontend-build.log'}")
    ok("Frontend build is ready")


PRE_UI = None  # 後端啟動前暫時提供介面的小伺服器（見 start_pre_ui）


def start_pre_ui() -> None:
    """
    --built：後端還沒起來之前，先在同一個埠提供打包好的介面（只給這台電腦），
    視窗一打開就是完整的啟動進度畫面（和開發模式先開前端是同一個道理）。
    只給檔案和 boot-status.json；/api、/ws 一律回 503（啟動畫面本來就會一直重試）。
    後端要啟動時由 stop_pre_ui() 關掉，把埠讓出來。開不起來（埠被佔用）就算了，不影響啟動。
    """
    global PRE_UI
    if PRE_UI or not (FRONTEND_DIST / "index.html").is_file():
        return
    import mimetypes
    import threading
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

    dist = FRONTEND_DIST.resolve()

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args) -> None:  # 不要把每個請求印到啟動記錄
            pass

        def _send(self, status: int, body: bytes, content_type: str, cache: str = "no-cache") -> None:
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", cache)
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(body)

        def do_GET(self) -> None:
            path = self.path.split("?", 1)[0].lstrip("/")
            try:
                if path.startswith(("api/", "ws/")):
                    return self._send(503, b'{"detail":"starting"}', "application/json", "no-store")
                if path == "boot-status.json":
                    return self._send(200, BOOT_STATUS_PATH.read_bytes(), "application/json", "no-store")
                target = (dist / path).resolve() if path else dist / "index.html"
                if not target.is_file() or dist not in target.parents:
                    target = dist / "index.html"  # 單頁應用：找不到的路徑都回首頁（也擋掉 ../ 跑到外面）
                kind = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
                if kind.startswith("text/") or kind in ("application/javascript", "application/json"):
                    kind += "; charset=utf-8"
                self._send(200, target.read_bytes(), kind)
            except OSError:
                self._send(404, b"", "text/plain")

        do_HEAD = do_GET

    try:
        PRE_UI = ThreadingHTTPServer(("127.0.0.1", BACKEND_PORT), Handler)
    except OSError:
        return
    PRE_UI.daemon_threads = True
    threading.Thread(target=PRE_UI.serve_forever, daemon=True).start()
    ok(f"Startup screen is available at {ui_url()}")


def stop_pre_ui() -> None:
    global PRE_UI
    if PRE_UI:
        PRE_UI.shutdown()
        PRE_UI.server_close()
        PRE_UI = None


def ui_url() -> str:
    return f"http://localhost:{BACKEND_PORT if SERVE_BUILT else FRONTEND_PORT}"


def find_model_file(choice: str) -> Path | None:
    """Pick a GGUF in ai_model/ by size tag, e.g. '3B' or '7B'."""
    tag = choice.strip().upper()
    for path in sorted((BASE_DIR / "ai_model").glob("*.gguf")):
        if f"-{tag}-" in path.name.upper():
            return path
    return None


def start_backend(python_exe: Path) -> None:
    stop_pre_ui()  # 先把埠讓出來（不然下面清埠會清到自己）
    kill_port(BACKEND_PORT)
    log = open_log("backend.log")
    # 聽哪些網路介面、區網走不走加密，由 backend/run_server.py 依模式決定：
    # 開發模式只聽這台電腦；--built 時這台電腦走原本的埠，區網裝置走加密的埠（誰能進來另由區網門檢決定，app/core/web_ui.py）
    cmd = [
        str(python_exe),
        "run_server.py",
        "--port",
        str(BACKEND_PORT),
        "--log-level",
        "info",
    ]
    # 強制 HuggingFace / sentence-transformers 走離線快取。
    # 這個專案是「地端部署、資料 100% 留在本機」的定位，不該在啟動期打 HF Hub。
    # 線上環境常見的卡點：sentence-transformers 載入 paraphrase-multilingual-MiniLM-L12-v2
    # 時 huggingface_hub 會做 metadata revalidation，網路慢/被擋時整個 lifespan startup
    # 會被卡住一兩分鐘，導致 start.py 的 health 檢查超時、誤判後端啟動失敗並 kill backend。
    # 注：cache 必須已存在於 ~/.cache/huggingface/，第一次安裝完 requirements 後就會有。
    backend_env = os.environ.copy()
    backend_env.setdefault("HF_HUB_OFFLINE", "1")
    backend_env.setdefault("TRANSFORMERS_OFFLINE", "1")
    if SERVE_BUILT:
        backend_env["CORPHIA_SERVE_FRONTEND"] = "1"
    else:
        backend_env.pop("CORPHIA_SERVE_FRONTEND", None)
    if MODEL_CHOICE:
        model_file = find_model_file(MODEL_CHOICE)
        if model_file:
            backend_env["LLAMA_MODEL_PATH"] = str(model_file)
            ok(f"AI model for this session: {model_file.name}")
        else:
            warn(f"No model matching '{MODEL_CHOICE}' in ai_model/; using the default model.")
    process = subprocess.Popen(
        cmd,
        cwd=str(BACKEND_DIR),
        stdout=log,
        stderr=subprocess.STDOUT,
        env=backend_env,
    )
    PROCESSES.append(process)
    ok(f"Backend started on http://localhost:{BACKEND_PORT} (PID {process.pid})")


def start_frontend() -> None:
    kill_port(FRONTEND_PORT)
    npm = shutil.which("npm")
    if not npm:
        raise RuntimeError("npm was not found. Please install Node.js first.")

    log = open_log("frontend.log")
    cmd = [npm, "run", "dev", "--", "--host", FRONTEND_HOST, "--logLevel", "silent"]
    process = subprocess.Popen(cmd, cwd=str(FRONTEND_DIR), stdout=log, stderr=subprocess.STDOUT)
    PROCESSES.append(process)
    ok(f"Frontend started on http://localhost:{FRONTEND_PORT} (PID {process.pid})")


def open_browser() -> None:
    url = ui_url()
    if sys.platform == "win32":
        os.startfile(url)  # type: ignore[attr-defined]
    elif sys.platform == "darwin":
        subprocess.Popen(["open", url])
    else:
        subprocess.Popen(["xdg-open", url])
    ok(f"Browser opened: {url}")


def shutdown(*_args) -> None:
    info("")
    info("[stop] Shutting down local backend and frontend...")
    # PROCESSES (watchdog-monitored) + SHUTDOWN_PROCESSES (extras like ngrok)
    # are both killed together on Ctrl+C / SIGTERM.
    for process in list(PROCESSES) + list(SHUTDOWN_PROCESSES):
        if process.poll() is not None:
            continue
        try:
            if sys.platform == "win32":
                subprocess.run(["taskkill", "/F", "/T", "/PID", str(process.pid)], capture_output=True)
            else:
                process.terminate()
        except Exception:
            pass

    for handle in LOG_HANDLES:
        try:
            handle.close()
        except Exception:
            pass

    info("[OK] Local services stopped. Docker database remains running.")
    sys.exit(0)


def print_summary(ngrok_url: str | None = None) -> None:
    info("")
    info("=" * 64)
    info("Corphia AI is ready")
    info("=" * 64)
    info(f"Frontend: {ui_url()}" + (" (served by the backend, no dev server)" if SERVE_BUILT else ""))
    info(f"Backend:  http://localhost:{BACKEND_PORT}")
    info(f"API docs: http://localhost:{BACKEND_PORT}/docs")
    info(f"DB:       localhost:{database_port()} (Docker PostgreSQL + pgvector)")
    # LAN mode: allow access from other devices on same network when enabled.
    info(f"LAN:      {'enabled' if read_lan_enabled() else 'disabled (this computer only)'} — switch it any time in the admin page, no restart needed")
    info("")
    info("Logs:")
    info(f"Backend:  {RUNTIME_DIR / 'backend.log'}")
    info(f"Frontend: {RUNTIME_DIR / 'frontend.log'}")
    info(f"DB init:  {RUNTIME_DIR / 'init-db.log'}")
    info("")
    info("Press Ctrl+C in this window to stop backend and frontend.")
    info("Docker database will keep running for fast next startup.")
    info("=" * 64)
    info("")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Start the full Corphia AI local stack.")
    parser.add_argument("--force-engine", action="store_true", help="Force llama-cpp-python backend detection/install.")
    parser.add_argument("--skip-browser", action="store_true", help="Do not open the browser automatically.")
    parser.add_argument("--skip-init-db", action="store_true", help="Skip database schema/default data initialization.")
    parser.add_argument(
        "--backend-only",
        action="store_true",
        help="Only start Docker DB + backend (frontend must already run separately).",
    )
    parser.add_argument(
        "--skip-frontend",
        action="store_true",
        help="Do not start Vite dev server.",
    )
    parser.add_argument(
        "--built",
        action="store_true",
        help="Serve the built interface (frontend/dist) from the backend instead of running the Vite dev server.",
    )
    parser.add_argument(
        "--model",
        default=None,
        help="Size tag of the GGUF model to load for this session, e.g. 3B or 7B (default: LLAMA_MODEL_PATH / 7B).",
    )
    return parser.parse_args()


def wait_for_ai_ready(timeout: int = 600) -> None:
    """Wait until the active model, the preloaded models and document search are loaded."""
    import json

    url = f"http://127.0.0.1:{BACKEND_PORT}/api/v1/health"
    deadline = time.time() + timeout
    last: dict = {}
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=3) as resp:
                last = json.loads(resp.read().decode("utf-8"))
        except Exception:
            last = {}
        models = last.get("models") or []
        if last.get("llm") == "error" or last.get("rag") == "error" or any(m.get("state") == "error" for m in models):
            bad = [m["name"] for m in models if m.get("state") == "error"]
            raise RuntimeError(
                f"AI 模型載入失敗（llm={last.get('llm')}, rag={last.get('rag')}, models={bad}）。See {RUNTIME_DIR / 'backend.log'}"
            )
        waiting = [m["name"] for m in models if m.get("state") in ("pending", "loading")]
        if last.get("llm") == "ready" and last.get("rag") == "ready" and not waiting:
            loaded = [m["name"] for m in models if m.get("state") == "ready"]
            ok("Real AI models loaded: " + ", ".join(loaded))
            return
        _boot_write()
        time.sleep(2)
    raise RuntimeError(f"AI 模型載入逾時（llm={last.get('llm')}, rag={last.get('rag')}）。")


def wait_for_api_health(timeout: int = 120) -> bool:
    """等待 API 層就緒（不必等 LLM/RAG 背景預熱完成）。"""
    deadline = time.time() + timeout
    url = f"http://127.0.0.1:{BACKEND_PORT}/api/v1/health"
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=3) as resp:
                if resp.status == 200:
                    import json
                    body = json.loads(resp.read().decode("utf-8"))
                    if body.get("status") == "ok":
                        return True
        except Exception:
            pass
        time.sleep(1.5)
    return False


def main() -> int:
    args = parse_args()
    global MODEL_CHOICE, SERVE_BUILT
    MODEL_CHOICE = args.model
    SERVE_BUILT = args.built
    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    info("=" * 64)
    info("Corphia AI one-click startup")
    info("=" * 64)
    info("Docker is used only for PostgreSQL + pgvector.")
    info("Backend, frontend, and GGUF model run locally.")
    info("")

    try:
        boot_init()
        if SERVE_BUILT and not frontend_build_is_stale():
            start_pre_ui()  # 介面不用重新打包：馬上就能顯示啟動進度
        python_exe = create_backend_venv()
        ensure_backend_dependencies(python_exe)
        if SERVE_BUILT:
            ensure_frontend_build()
            start_pre_ui()  # 剛打包完的情況：現在才有介面可以顯示
        else:
            ensure_frontend_dependencies()

        # Frontend first: it does not need the backend, and the browser can then
        # show the live startup status while everything else comes up.
        skip_frontend = args.skip_frontend or args.backend_only or SERVE_BUILT
        if not skip_frontend:
            start_frontend()
            info("[wait] Checking frontend...")
            if not wait_for_http(f"http://127.0.0.1:{FRONTEND_PORT}", timeout=90):
                raise RuntimeError(f"Frontend check timed out. See {RUNTIME_DIR / 'frontend.log'}")
            ok("Frontend is reachable")
            if not args.skip_browser:
                open_browser()
        else:
            ok("Skipped frontend startup (use existing dev server or production build)")

        start_database()
        if native_postgres_ready() and web_search_enabled():
            # 資料庫不靠 Docker 時，Docker 只剩對外搜尋在用：放到背景啟動，不讓整個系統等它
            # （Docker Desktop 冷開機要一兩分鐘；它好之前只有對外搜尋那一題會回報暫時無法使用）
            import threading
            threading.Thread(target=start_searxng_in_background, daemon=True).start()
        else:
            start_searxng_if_enabled()
        # 原生資料庫、又沒開對外搜尋：整個流程都沒用到 Docker，這一項標成「不需要」（不然啟動畫面會一直停在等待）
        if any(s["key"] == "docker" and s["state"] == "pending" for s in BOOT.get("steps", [])):
            boot("docker", "skipped", "不需要（資料庫直接裝在這台電腦）")

        boot("engine", "running", "檢查 llama-cpp-python…", code="engine_check")
        run_auto_engine(python_exe, force=args.force_engine)
        boot("engine", "done", "已安裝", code="engine_ok")

        if not args.skip_init_db:
            boot("schema", "running", "建立 / 檢查資料表…", code="schema_check")
            init_database(python_exe)
            boot("schema", "done", "資料表已就緒", code="schema_ready")
        else:
            boot("schema", "skipped", "略過", code="skipped")

        boot("backend", "running", "啟動 FastAPI 伺服器…", code="backend_starting")
        start_backend(python_exe)

        info("[wait] Checking backend API health...")
        # Loading the GGUF model can briefly freeze the API on a cold disk, so allow plenty of time.
        if not wait_for_api_health(timeout=420):
            raise RuntimeError(f"Backend API health check timed out. See {RUNTIME_DIR / 'backend.log'}")
        ok("Backend API is ready")
        boot("backend", "done", f"http://localhost:{BACKEND_PORT}")
        if SERVE_BUILT and not args.skip_browser:
            open_browser()  # 介面由後端提供：後端好了才有東西可以開

        info("[wait] Loading the AI model and document search... progress is shown in the browser.")
        wait_for_ai_ready()
        BOOT["overall"] = "ready"
        _boot_write()

        if args.backend_only:
            info(f"[hint] Backend: http://127.0.0.1:{BACKEND_PORT} — attach your frontend separately")

        print_summary(ngrok_url=None)
        while True:
            time.sleep(1)
            for process in PROCESSES:
                if process.poll() is not None:
                    raise RuntimeError(f"A service exited unexpectedly. See logs in {RUNTIME_DIR}.")

    except Exception as exc:
        boot_fail_running(str(exc))
        fail(str(exc))
        fail("Startup did not complete. Check .runtime/backend.log and .runtime/frontend.log if they exist.")
        for process in list(PROCESSES) + list(SHUTDOWN_PROCESSES):
            try:
                if process.poll() is None:
                    process.terminate()
            except Exception:
                pass
        if SERVE_BUILT:
            # 介面是後端提供的，後端沒起來畫面就沒了：留一個小伺服器讓啟動畫面顯示失敗原因，
            # 直到使用者關掉（一鍵關閉／關桌面版視窗會結束這個程式）
            time.sleep(1.5)  # 等後端把埠放掉
            start_pre_ui()
            while PRE_UI:
                time.sleep(1)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
