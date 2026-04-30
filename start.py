"""
Corphia AI - 一鍵啟動腳本
執行方式: python start.py
按下 Ctrl+C 可同時關閉前端與後端

功能：
  - 自動啟動 Docker / 後端 / 前端
  - 瀏覽器自動開啟並顯示「引擎啟動中」畫面
  - 查詢現有 Ngrok 通道並顯示公開網址
  - 最後顯示 本機 / 區網 / 公開 三合一網址

  ※ 公開網址由 ngrok_reset.py 獨立管理：
     首次或想換網址 → python ngrok_reset.py
"""

import os
import signal
import socket
import subprocess
import sys
import threading
import time
import urllib.request

# 修正 Windows 終端機編碼問題
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
BACKEND_DIR = os.path.join(BASE_DIR, "backend")

if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.services.ngrok_service import (  # noqa: E402
    find_ngrok_binary,
    get_ngrok_state,
    start_ngrok_tunnel,
    start_ngrok_watcher,
)


def find_backend_python() -> str:
    """
    找出最適合用來跑後端 uvicorn 的 Python 直譯器。

    優先順序：
      1. backend/.venv/Scripts/python.exe  ← 推薦寫法（前面有點）
      2. backend/venv/Scripts/python.exe   ← 舊命名，向下相容
      3. sys.executable                    ← 跑這個 start.py 的 Python
    """
    candidates = [
        os.path.join(BACKEND_DIR, ".venv", "Scripts", "python.exe"),
        os.path.join(BACKEND_DIR, "venv", "Scripts", "python.exe"),
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
    return sys.executable

# 儲存後端與前端程序
processes: list[subprocess.Popen] = []
ngrok_stop_event = threading.Event()


# ─────────────────────────────────────────────────────────────
#  工具函數
# ─────────────────────────────────────────────────────────────

def get_local_ip() -> str:
    """取得本機區網 IP"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "無法取得"


def kill_process_tree(pid: int):
    """強制終止 Windows 上的整個程序樹"""
    subprocess.run(
        ["taskkill", "/F", "/T", "/PID", str(pid)],
        capture_output=True
    )


def shutdown(sig=None, frame=None):
    """Ctrl+C 觸發時，關閉前端與後端服務"""
    print("\n\n  正在關閉前端與後端服務...")
    ngrok_stop_event.set()
    for proc in processes:
        try:
            kill_process_tree(proc.pid)
        except Exception:
            pass
    print("  [OK] 服務已全部關閉\n")
    sys.exit(0)


signal.signal(signal.SIGINT, shutdown)
signal.signal(signal.SIGTERM, shutdown)


def open_frontend():
    """Open the frontend after services have had a chance to come up."""
    url = "http://localhost:5173"
    if sys.platform == "win32":
        subprocess.Popen(f"start {url}", shell=True)
    elif sys.platform == "darwin":
        subprocess.Popen(["open", url])
    else:
        subprocess.Popen(["xdg-open", url])


def kill_port(port: int):
    """找出佔用指定 Port 的程序並強制終止 (僅限 Windows)"""
    if sys.platform != "win32":
        return
    try:
        result = subprocess.run(
            "netstat -ano", shell=True, capture_output=True, text=True
        )
        for line in result.stdout.strip().split("\n"):
            if "LISTENING" not in line:
                continue
            parts = line.strip().split()
            if len(parts) >= 5 and parts[1].endswith(f":{port}"):
                pid = parts[-1]
                if pid != "0":
                    subprocess.run(
                        f"taskkill /F /T /PID {pid}",
                        shell=True, capture_output=True
                    )
    except Exception:
        pass


def find_ngrok() -> str | None:
    """尋找 ngrok 執行檔。實作委派給 backend/app/services/ngrok_service.find_ngrok_binary。"""
    return find_ngrok_binary(BASE_DIR)


def _query_ngrok_url() -> str | None:
    """查詢本機 ngrok API 上正在運作的 https 通道 URL。"""
    state = get_ngrok_state(include_stale=False)
    return state.url if state.active else None


def start_ngrok() -> str | None:
    """啟動 ngrok 通道，回傳 HTTPS public URL；失敗回傳 None。"""
    print("  [ngrok] Waiting for public URL...", end="", flush=True)
    process, state = start_ngrok_tunnel(frontend_port=5173, base_dir=BASE_DIR)
    if process:
        processes.append(process)
    if state.active:
        print(" ready", flush=True)
        start_ngrok_watcher(stop_event=ngrok_stop_event)
        return state.url
    print(" failed", flush=True)
    return None



def wait_for_backend(port: int = 8168, timeout: int = 120) -> bool:
    """等待後端服務啟動（顯示動態進度點）"""
    url = f"http://127.0.0.1:{port}/api/v1/health"
    deadline = time.time() + timeout
    dots = 0
    print("  ", end="", flush=True)
    while time.time() < deadline:
        try:
            res = urllib.request.urlopen(url, timeout=2)
            if res.status == 200:
                print(" 就緒！", flush=True)
                return True
        except Exception:
            pass
        print(".", end="", flush=True)
        dots += 1
        if dots % 20 == 0:
            print("\n  ", end="", flush=True)
        time.sleep(1)
    print(" 逾時", flush=True)
    return False


# ─────────────────────────────────────────────────────────────
#  自動喚醒 Docker Desktop
# ─────────────────────────────────────────────────────────────

def is_docker_running() -> bool:
    """偵測 Docker daemon 是否已就緒"""
    try:
        result = subprocess.run(
            ["docker", "info"],
            capture_output=True, timeout=5
        )
        return result.returncode == 0
    except Exception:
        return False


def ensure_docker_desktop_running():
    """若 Docker Desktop 未啟動，自動喚醒並等待就緒"""
    if is_docker_running():
        return  # 已就緒，直接跳過

    print("  [啟動] Docker Desktop 尚未執行，正在自動開啟...", flush=True)

    # 常見安裝路徑
    docker_desktop_paths = [
        os.path.join(os.environ.get("PROGRAMFILES", r"C:\Program Files"),
                     "Docker", "Docker", "Docker Desktop.exe"),
        os.path.join(os.environ.get("LOCALAPPDATA", ""),
                     "Docker", "Docker", "Docker Desktop.exe"),
    ]
    launched = False
    for path in docker_desktop_paths:
        if os.path.exists(path):
            subprocess.Popen([path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            launched = True
            break

    if not launched:
        print("  [警告] 找不到 Docker Desktop，請手動開啟後再執行。")
        return

    # 等待 Docker daemon 就緒（最多 90 秒）
    print("  [等待] Docker Desktop 啟動中", end="", flush=True)
    deadline = time.time() + 90
    while time.time() < deadline:
        time.sleep(2)
        print(".", end="", flush=True)
        if is_docker_running():
            print(" 就緒！", flush=True)
            return
    print(" 逾時，繼續嘗試...", flush=True)


# ─────────────────────────────────────────────────────────────
#  主程序
# ─────────────────────────────────────────────────────────────

def main():
    print("=" * 52)
    print("  🏃 Corphia AI Platform - 正在啟動，請稍候...")
    print("=" * 52)
    has_ngrok = bool(find_ngrok())

    # ── [0/6] 自動喚醒 Docker Desktop ────────────────────────
    print("  [0/6] 檢查 Docker Desktop...")
    ensure_docker_desktop_running()
    print()

    # ── [1/6] Docker ──────────────────────────────────────────
    if os.path.exists("docker-compose.yml"):
        print("  [1/6] 啟動 Docker 容器...")
        try:
            subprocess.run(
                "docker-compose up -d", shell=True, check=True,
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
            )
            print("  [OK] Docker 容器已啟動")
        except Exception:
            print("  [跳過] Docker 啟動失敗或未安裝，繼續...")
    else:
        print("  [1/6] 未偵測到 docker-compose.yml，跳過 Docker...")

    # ── [2/6] 清理 Port ────────────────────────────────────────
    print("  [2/6] 清理佔用的 Port...")
    kill_port(8168)
    kill_port(5173)

    # ── [3/6] 硬體偵測 ────────────────────────────────────────
    print("  [3/6] 偵測硬體環境...")
    if os.path.exists(BACKEND_DIR):
        engine_script = os.path.join(BACKEND_DIR, "auto_engine.py")
        if os.path.exists(engine_script):
            py_exec = find_backend_python()
            try:
                subprocess.run(
                    [py_exec, engine_script] + sys.argv[1:],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    timeout=10
                )
            except subprocess.TimeoutExpired:
                print("  [跳過] 硬體偵測超時，使用預設設定")
            except Exception:
                pass

    # ── [4/6] 前端先啟動 → 瀏覽器自動開啟 ──────────────────────
    print("  [4/6] 啟動前端服務 (Port 5173)...")
    if os.path.exists(FRONTEND_DIR):
        proc = subprocess.Popen(
            "npm run dev -- --host --logLevel silent",
            cwd=FRONTEND_DIR, shell=True,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
        )
        processes.append(proc)
        print(f"  [OK] 前端程序已啟動 (PID: {proc.pid})")

    print("  [瀏覽器] 等待前端就緒，即將自動開啟瀏覽器...", end="", flush=True)
    for _ in range(6):
        time.sleep(0.5)
        print(".", end="", flush=True)
        try:
            r = urllib.request.urlopen("http://127.0.0.1:5173", timeout=1)
            if r.status < 500:
                break
        except Exception:
            pass
    print()
    print("  [OK] Frontend is ready; browser will open after backend check.")

    # ── [5/6] 後端啟動 ───────────────────────────────────────
    print("  [5/6] 啟動後端服務 (Port 8168)...")
    if os.path.exists(BACKEND_DIR):
        backend_python = find_backend_python()
        backend_cmd = [
            backend_python, "-m", "uvicorn", "app.main:app",
            "--host", "0.0.0.0", "--port", "8168", "--log-level", "warning"
        ]
        proc = subprocess.Popen(
            backend_cmd, cwd=BACKEND_DIR, shell=False,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
        )
        processes.append(proc)
        print(f"  [OK] 後端程序已啟動 (PID: {proc.pid})")
        print("  [等待] 後端 API 就緒中（LLM 模型載入可能需要 1~2 分鐘）：")

        backend_ready = wait_for_backend(8168, timeout=120)
        if backend_ready:
            print("  [OK] 後端 API 已就緒 ✅")
        else:
            print("  [警告] 後端啟動逾時，請確認 PostgreSQL 是否正在執行⚠️")

    open_frontend()
    print("  [OK] Browser opened: http://localhost:5173")

    # ── [6/6] 啟動 Ngrok 公開通道 ────────────────────────────
    public_url: str | None = None
    if has_ngrok:
        print("  [6/6] 啟動 Ngrok 公開通道...")
        public_url = start_ngrok()
        if public_url:
            print("  [OK] Ngrok 通道就緒 ✅")
        else:
            print("  [跳過] Ngrok 通道建立失敗（請確認 authtoken 是否已設定）")
    else:
        print("  [6/6] 未安裝 Ngrok（跳過，可選安裝：https://ngrok.com/download）")

    # ── 最終：顯示三合一服務資訊 ─────────────────────────────────
    local_ip = get_local_ip()
    print()
    print("=" * 52)
    print("  🟢 Corphia AI Platform 已全面啟動！")
    print("=" * 52)
    print()
    print("  📍 本機存取")
    print(f"     前端: http://localhost:5173")
    print(f"     後端: http://localhost:8168")
    print(f"     文件: http://localhost:8168/docs")
    print()
    print(f"  📡 區域網路（手機 / 其他裝置）")
    print(f"     前端: http://{local_ip}:5173")
    print(f"     後端: http://{local_ip}:8168")
    print()
    print(f"  🌍 公開網址（Ngrok）")
    if public_url:
        print(f"     前端:       {public_url}")
        print(f"     後端 API:   {public_url}/api/v1/")
        print(f"     WebSocket:  {public_url.replace('https://', 'wss://')}/ws/")
        print()
        print(f"  ⚡ 架構：前後端共用同一 ngrok URL，透過 Vite Proxy 路由")
        print(f"     /api/* → port 8168 (FastAPI)  /ws/* → port 8168 (WebSocket)")
        print()
        print(f"  💡 重新取得網址：python ngrok_reset.py")
    else:
        if has_ngrok:
            print(f"     （Ngrok 啟動失敗，請確認 authtoken：ngrok config add-authtoken <token>）")
        else:
            print(f"     （未安裝 Ngrok，可至 https://ngrok.com/download 下載）")
    print()
    print("  🛑 按下 Ctrl+C 可隨時關閉服務")
    print("=" * 52)
    print()

    # 持續等待，直到 Ctrl+C
    while True:
        time.sleep(1)
        for proc in list(processes):
            if proc.poll() is not None:
                processes.remove(proc)
                break


if __name__ == "__main__":
    main()
