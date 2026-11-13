"""
Corphia AI one-click shutdown.

Stops everything started by start.py and shuts Docker Desktop down cleanly:
  1. the start.py launcher window
  2. backend (port 8168) and frontend (port 5173)
  3. PostgreSQL (native via pg_ctl if set up, otherwise the Docker container; data is kept either way)
  4. Docker Desktop itself, using its own "stop" command (no-op if it was never started)

A clean Docker shutdown matters: when Docker is killed it leaves socket files
behind and crashes on the next start.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE_DIR = Path(__file__).resolve().parent
PORTS = (8168, 5173)

sys.path.insert(0, str(BASE_DIR / "scripts"))
from setup_postgres import PGDATA_DIR as NATIVE_PGDATA_DIR  # noqa: E402
from setup_postgres import native_postgres_ready, pg_bin_dir  # noqa: E402


def say(msg: str) -> None:
    print(msg, flush=True)


def run(cmd: list[str], timeout: int = 60) -> subprocess.CompletedProcess:
    try:
        return subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8",
                              errors="replace", timeout=timeout, check=False)
    except subprocess.TimeoutExpired:
        return subprocess.CompletedProcess(cmd, 1, "", "timeout")


def powershell(script: str, timeout: int = 60) -> str:
    return run(["powershell", "-NoProfile", "-NonInteractive", "-Command", script], timeout).stdout


def stop_launcher() -> None:
    # The launcher runs as "python start.py ..." (the .bat starts it from this folder).
    powershell(
        "Get-CimInstance Win32_Process -Filter \"Name='python.exe' OR Name='py.exe'\" | "
        "Where-Object { $_.CommandLine -match '(^|[\\\\/ \"])start\\.py' } | "
        "ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
    )
    # 後端開的推論引擎（llama-server，命令列帶 --alias corphia-engine）：後端被強制結束時它不會自己關
    powershell(
        "Get-CimInstance Win32_Process -Filter \"Name='llama-server.exe'\" | "
        "Where-Object { $_.CommandLine -match 'corphia-engine' } | "
        "ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
    )
    # Close the launcher's console window too (title set in 一鍵啟動.bat).
    run(["taskkill", "/F", "/T", "/FI", "WINDOWTITLE eq Corphia AI Launcher*"], timeout=30)


def stop_app_processes() -> None:
    # The backend venv's python.exe is a small launcher that starts the real
    # interpreter as a child; both must go or the port stays held. Same for the
    # npm -> node (vite) chain of the frontend.
    powershell(
        "Get-CimInstance Win32_Process | Where-Object { "
        "$_.CommandLine -match 'uvicorn\\s+app\\.main:app' -or "
        "($_.Name -eq 'node.exe' -and $_.CommandLine -match 'vite') -or "
        "($_.Name -match '^(cmd|npm)' -and $_.CommandLine -match 'npm(\\.cmd)?\"?\\s+run\\s+dev') } | "
        "ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
    )


def stop_ports() -> None:
    stop_app_processes()
    for port in PORTS:
        # Kill the listener and its whole process tree (uvicorn / vite workers).
        out = powershell(
            f"Get-NetTCPConnection -LocalPort {port} -State Listen -ErrorAction SilentlyContinue | "
            "Select-Object -ExpandProperty OwningProcess -Unique"
        )
        for pid in {p.strip() for p in out.splitlines() if p.strip().isdigit()}:
            run(["taskkill", "/F", "/T", "/PID", pid], timeout=30)


def ports_closed() -> bool:
    out = powershell(
        "Get-NetTCPConnection -LocalPort " + ",".join(map(str, PORTS)) +
        " -State Listen -ErrorAction SilentlyContinue | Measure-Object | Select-Object -ExpandProperty Count"
    )
    return out.strip() in ("", "0")


def docker() -> str | None:
    return shutil.which("docker")


def docker_desktop_running() -> bool:
    out = run(["tasklist", "/FI", "IMAGENAME eq Docker Desktop.exe", "/NH"]).stdout
    return "Docker Desktop.exe" in out


def stop_native_database() -> None:
    """跑過 scripts/setup_postgres.py 的機器：原生 PostgreSQL 用 pg_ctl 關，跟 Docker 無關"""
    if not native_postgres_ready():
        return
    bin_dir = pg_bin_dir()
    run([str(bin_dir / "pg_ctl.exe"), "-D", str(NATIVE_PGDATA_DIR), "-m", "fast", "stop"], timeout=60)


def stop_database() -> None:
    stop_native_database()

    exe = docker()
    if not exe:
        return
    if run([exe, "info"], timeout=10).returncode != 0:
        return
    # --profile search：就算這次沒開對外搜尋，也要把自架 SearXNG 一起列進「這次要管的服務」裡，
    # 不然它若曾經被 --profile search 啟動過，不加這個旗標的 stop 不會把它算進去，會被漏關
    # corphia-postgres：原生安裝時這個容器本來就不存在，docker stop 會回報「找不到」，無害地跳過
    run([exe, "compose", "--profile", "search", "stop"], timeout=120) if (BASE_DIR / "docker-compose.yml").exists() else None
    run([exe, "stop", "corphia-postgres", "corphia-searxng"], timeout=60)


def clear_stale_docker_sockets() -> None:
    """Docker Desktop leaves socket files behind even after a clean stop; on the
    next start (including from its own icon) it then crashes with
    "The file cannot be accessed by the system". Move them aside right away."""
    import stat as stat_mod
    local = Path(os.environ.get("LOCALAPPDATA", ""))
    for folder in (local / "Docker" / "run", local / "docker-secrets-engine"):
        if not folder.is_dir():
            continue
        try:
            stale = any(getattr(e.stat(follow_symlinks=False), "st_file_attributes", 0)
                        & stat_mod.FILE_ATTRIBUTE_REPARSE_POINT for e in os.scandir(folder))
        except OSError:
            stale = True
        if stale:
            try:
                folder.rename(folder.with_name(f"{folder.name}.stale-{time.strftime('%Y%m%d-%H%M%S')}"))
            except OSError:
                pass


def reset_docker_vm() -> None:
    # Make sure Docker's own WSL VM is really off, so the next start is clean.
    run(["wsl", "--terminate", "docker-desktop"], timeout=60)
    clear_stale_docker_sockets()


def stop_docker_desktop() -> bool:
    if not docker_desktop_running():
        reset_docker_vm()
        return True
    exe = docker()
    if exe:
        run([exe, "desktop", "stop"], timeout=180)
    deadline = time.time() + 90
    while time.time() < deadline:
        if not docker_desktop_running():
            reset_docker_vm()
            return True
        time.sleep(2)
    # Last resort only if the clean stop did not finish.
    for name in ("Docker Desktop.exe", "com.docker.backend.exe", "com.docker.build.exe",
                 "docker-ai.exe", "docker-mcp.exe"):
        run(["taskkill", "/F", "/IM", name], timeout=15)
    time.sleep(3)
    reset_docker_vm()
    return not docker_desktop_running()


def mark_stopped() -> None:
    """Tell an open browser tab that the system was shut down."""
    import json
    path = BASE_DIR / "frontend" / "public" / "boot-status.json"
    try:
        path.write_text(json.dumps({"overall": "stopped", "updated_at": time.time(), "steps": []}), encoding="utf-8")
    except OSError:
        pass


def main() -> int:
    os.chdir(BASE_DIR)
    say("=" * 56)
    say(" Corphia AI 一鍵關閉")
    say("=" * 56)

    say("[1/4] 關閉啟動視窗...")
    stop_launcher()

    say("[2/4] 關閉後端與前端...")
    stop_ports()
    for _ in range(10):
        if ports_closed():
            break
        time.sleep(1)
        stop_ports()

    say("[3/4] 關閉資料庫（資料會保留）...")
    stop_database()

    mark_stopped()

    say("[4/4] 正常關閉 Docker Desktop（約 10～60 秒）...")
    docker_ok = stop_docker_desktop()

    say("")
    if ports_closed() and docker_ok:
        say("全部關閉完成，可以直接關機或下次再按「一鍵啟動」。")
        return 0
    if not ports_closed():
        say("[警告] 仍有程式佔用 8168 / 5173，請重開機。")
    if not docker_ok:
        say("[警告] Docker Desktop 沒有完全關閉，請從右下角鯨魚圖示選 Quit。")
    return 1


if __name__ == "__main__":
    sys.exit(main())
