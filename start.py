"""
Corphia AI one-click local launcher.

This starts the full local development stack:
  1. Docker PostgreSQL + pgvector
  2. Backend environment checks, llama-cpp-python, and DB initialization
  3. FastAPI backend
  4. Vite frontend
  5. Browser at http://localhost:5173

The app itself runs locally. Docker is used only for PostgreSQL + pgvector.
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
DEFAULT_DB_PORT = 5433

PROCESSES: list[subprocess.Popen] = []
# ngrok 開的 process 跟 backend/frontend 不一樣 —
# 免費版 ngrok 偶爾自己斷線重連，主迴圈不該把它退出當致命錯誤。
# 它只進 SHUTDOWN_PROCESSES（用於 Ctrl+C 清理），不進 PROCESSES（watchdog 監看）。
SHUTDOWN_PROCESSES: list[subprocess.Popen] = []
LOG_HANDLES = []


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
    imports = "; ".join(f"import {module}" for module in modules)
    result = run([str(python_exe), "-c", imports], cwd=BACKEND_DIR, quiet=True, timeout=30)
    return result.returncode == 0


def ensure_backend_dependencies(python_exe: Path) -> None:
    if python_can_import(python_exe, ["fastapi", "uvicorn", "sqlalchemy", "asyncpg"]):
        ok("Backend Python dependencies are ready")
        return

    requirements = BACKEND_DIR / "requirements.txt"
    if not requirements.exists():
        raise RuntimeError("backend/requirements.txt was not found.")

    info("[setup] Installing backend dependencies...")
    result = run(
        [str(python_exe), "-m", "pip", "install", "-r", str(requirements)],
        cwd=BACKEND_DIR,
        timeout=1800,
    )
    if result.returncode != 0:
        raise RuntimeError("Backend dependency installation failed.")
    ok("Backend dependencies installed")


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
    result = run([docker, "info"], quiet=True, timeout=8)
    return result.returncode == 0


def start_docker_desktop() -> None:
    if docker_info_ok():
        ok("Docker daemon is ready")
        return

    info("[docker] Docker daemon is not ready. Trying to start Docker Desktop...")
    candidates = [
        Path(os.environ.get("PROGRAMFILES", r"C:\Program Files")) / "Docker" / "Docker" / "Docker Desktop.exe",
        Path(os.environ.get("LOCALAPPDATA", "")) / "Docker" / "Docker" / "Docker Desktop.exe",
    ]
    launched = False
    for candidate in candidates:
        if candidate.exists():
            subprocess.Popen([str(candidate)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            launched = True
            break

    if not launched:
        raise RuntimeError("Docker Desktop was not found. Install Docker Desktop or start it manually.")

    deadline = time.time() + 120
    while time.time() < deadline:
        if docker_info_ok():
            ok("Docker daemon is ready")
            return
        time.sleep(2)

    raise RuntimeError("Docker Desktop did not become ready in time.")


def start_database() -> None:
    start_docker_desktop()

    compose_file = BASE_DIR / "docker-compose.yml"
    if not compose_file.exists():
        raise RuntimeError("docker-compose.yml was not found.")

    info("[docker] Starting PostgreSQL + pgvector...")
    commands = [
        ["docker", "compose", "up", "-d"],
        ["docker-compose", "up", "-d"],
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
                return
            raise RuntimeError(f"Database container started, but localhost:{port} did not become reachable.")

    raise RuntimeError(f"Could not start Docker database.\n{last_output}".strip())


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

    result = subprocess.run("netstat -ano -p tcp", shell=True, capture_output=True, text=True)
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


def start_backend(python_exe: Path) -> None:
    kill_port(BACKEND_PORT)
    log = open_log("backend.log")
    cmd = [
        str(python_exe),
        "-m",
        "uvicorn",
        "app.main:app",
        "--host",
        "0.0.0.0",
        "--port",
        str(BACKEND_PORT),
        "--log-level",
        "info",
    ]
    process = subprocess.Popen(cmd, cwd=str(BACKEND_DIR), stdout=log, stderr=subprocess.STDOUT)
    PROCESSES.append(process)
    ok(f"Backend started on http://localhost:{BACKEND_PORT} (PID {process.pid})")


def start_frontend() -> None:
    kill_port(FRONTEND_PORT)
    npm = shutil.which("npm")
    if not npm:
        raise RuntimeError("npm was not found. Please install Node.js first.")

    log = open_log("frontend.log")
    cmd = [npm, "run", "dev", "--", "--host", "0.0.0.0", "--logLevel", "silent"]
    process = subprocess.Popen(cmd, cwd=str(FRONTEND_DIR), stdout=log, stderr=subprocess.STDOUT)
    PROCESSES.append(process)
    ok(f"Frontend started on http://localhost:{FRONTEND_PORT} (PID {process.pid})")


def start_ngrok() -> str | None:
    """
    啟動 ngrok 公開通道指向 frontend，回傳公開 URL（失敗時回 None）。

    流程：
      1. 從 backend 套件動態 import ngrok_service（共用一份程式碼）
      2. 找 ngrok 執行檔 — 沒裝就直接 warn 跳過、不 fail 整個啟動流程
      3. 殺掉舊的 ngrok process（避免 4040 被前一輪佔走拿不到 tunnel API）
      4. 開新的 ngrok http {FRONTEND_PORT}，poll API 直到拿到 https URL
      5. 寫 .runtime/ngrok.json + frontend/.env.local 讓 admin 頁面 / Vite 同步知道
      6. 啟動背景 watcher：每 10s 檢查 ngrok 公開 URL 是否有變動。
         免費版 ngrok 重連可能會拿到不同子網域；watcher 會把最新 URL 持續寫回
         runtime 檔案，後端 /system/ngrok 端點下次被前端問就拿得到新值。
    """
    backend_path = str(BACKEND_DIR)
    if backend_path not in sys.path:
        sys.path.insert(0, backend_path)

    try:
        from app.services.ngrok_service import (  # noqa: WPS433  延遲 import
            find_ngrok_binary,
            start_ngrok_tunnel,
            start_ngrok_watcher,
        )
    except Exception as exc:  # pragma: no cover
        warn(f"ngrok service import failed: {exc}. Skipping ngrok.")
        return None

    if not find_ngrok_binary(BASE_DIR):
        warn("ngrok binary not found (looked in PATH, C:\\ngrok, project root). "
             "Install ngrok to enable public URL: https://ngrok.com/download")
        return None

    info("[ngrok] Launching public tunnel for frontend...")
    process, state = start_ngrok_tunnel(frontend_port=FRONTEND_PORT, base_dir=BASE_DIR)
    if process is not None:
        # 只進 SHUTDOWN_PROCESSES（Ctrl+C 時會被清掉）；不進 PROCESSES（watchdog），
        # 避免 ngrok 偶發斷線把整個服務棧拉下來。
        SHUTDOWN_PROCESSES.append(process)
    if state.active and state.url:
        ok(f"ngrok tunnel ready: {state.url}")
        # Watcher: 持續把當下 ngrok URL 寫回 .runtime/ngrok.json + frontend/.env.local
        try:
            start_ngrok_watcher(root_dir=BASE_DIR, interval_seconds=10)
        except Exception as exc:
            warn(f"ngrok watcher failed to start (non-fatal): {exc}")
        return state.url
    warn("ngrok started but failed to acquire public URL within timeout. "
         "Check ngrok authtoken: ngrok config add-authtoken <your-token>")
    return None


def open_browser() -> None:
    url = f"http://localhost:{FRONTEND_PORT}"
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
    info(f"Frontend: http://localhost:{FRONTEND_PORT}")
    info(f"Backend:  http://localhost:{BACKEND_PORT}")
    info(f"API docs: http://localhost:{BACKEND_PORT}/docs")
    info(f"DB:       localhost:{database_port()} (Docker PostgreSQL + pgvector)")
    if ngrok_url:
        info("")
        info(f"Public:   {ngrok_url}    (ngrok)")
        info(f"          {ngrok_url}/api/v1/    (REST API)")
        info(f"          {ngrok_url.replace('https://', 'wss://')}/ws/    (WebSocket)")
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
    # Ngrok 預設關閉 —— 公開隧道屬於敏感能力，由 admin 在後台手動開啟比較合理。
    # 如果你還是要在 start.py 啟動時就開，加 --ngrok。
    # 舊的 --no-ngrok 旗標保留為 no-op alias（向後相容，避免之前 bat / docs 寫這個的破掉）。
    parser.add_argument("--ngrok", action="store_true", help="Auto-launch ngrok tunnel at startup (default: off, open manually from admin panel).")
    parser.add_argument("--no-ngrok", action="store_true", help="(deprecated, this is now the default) Skip ngrok at startup.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    info("=" * 64)
    info("Corphia AI one-click startup")
    info("=" * 64)
    info("Docker is used only for PostgreSQL + pgvector.")
    info("Backend, frontend, and GGUF model run locally.")
    info("")

    try:
        python_exe = create_backend_venv()
        ensure_backend_dependencies(python_exe)
        ensure_frontend_dependencies()
        start_database()
        run_auto_engine(python_exe, force=args.force_engine)
        if not args.skip_init_db:
            init_database(python_exe)

        start_backend(python_exe)
        start_frontend()

        info("[wait] Checking backend health...")
        if not wait_for_http(f"http://127.0.0.1:{BACKEND_PORT}/api/v1/health", timeout=120):
            raise RuntimeError(f"Backend health check timed out. See {RUNTIME_DIR / 'backend.log'}")
        ok("Backend health check passed")

        info("[wait] Checking frontend...")
        if not wait_for_http(f"http://127.0.0.1:{FRONTEND_PORT}", timeout=90):
            raise RuntimeError(f"Frontend check timed out. See {RUNTIME_DIR / 'frontend.log'}")
        ok("Frontend is reachable")

        # ngrok 必須在 frontend 監聽之後才能正確建 tunnel。
        # 只有顯式 --ngrok 才在啟動時開；預設關閉，由 admin 後台動態啟動。
        ngrok_url: str | None = None
        if args.ngrok:
            ngrok_url = start_ngrok()
        else:
            info("[ngrok] Skipped (default off). Toggle from admin panel when needed.")

        if not args.skip_browser:
            open_browser()

        print_summary(ngrok_url=ngrok_url)
        while True:
            time.sleep(1)
            for process in PROCESSES:
                if process.poll() is not None:
                    raise RuntimeError(f"A service exited unexpectedly. See logs in {RUNTIME_DIR}.")

    except Exception as exc:
        fail(str(exc))
        fail("Startup did not complete. Check .runtime/backend.log and .runtime/frontend.log if they exist.")
        for process in list(PROCESSES) + list(SHUTDOWN_PROCESSES):
            try:
                if process.poll() is None:
                    process.terminate()
            except Exception:
                pass
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
