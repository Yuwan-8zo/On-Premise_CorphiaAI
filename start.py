"""
Corphia AI - 一鍵啟動腳本
執行方式: python start.py
按下 Ctrl+C 可同時關閉前端、後端與 Ngrok

功能：
  - 自動啟動 Docker / 後端 / 前端 / Ngrok
  - 瀏覽器自動開啟並顯示「引擎啟動中」畫面
  - 優先沿用現有 Ngrok 通道（URL 保持不變）
  - 最後顯示本機 / 區網 / 公開 三合一網址
"""

import subprocess
import os
import sys
import time
import signal
import socket
import urllib.request
import json
import shutil
import threading

# 修正 Windows 終端機編碼問題
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
BACKEND_DIR = os.path.join(BASE_DIR, "backend")

# 儲存所有已啟動的子程序
processes: list[subprocess.Popen] = []


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
    """Ctrl+C 觸發時，關閉所有服務"""
    print("\n\n  正在關閉所有服務...")
    for proc in processes:
        try:
            kill_process_tree(proc.pid)
        except Exception:
            pass
    if sys.platform == "win32":
        subprocess.run("taskkill /F /IM ngrok.exe", shell=True, capture_output=True)
    print("  [OK] 所有服務已全部關閉\n")
    sys.exit(0)


signal.signal(signal.SIGINT, shutdown)
signal.signal(signal.SIGTERM, shutdown)


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
    """尋找 ngrok 執行檔"""
    ngrok_in_path = shutil.which("ngrok")
    if ngrok_in_path:
        return ngrok_in_path

    local_ngrok = os.path.join(BASE_DIR, "ngrok.exe")
    if os.path.exists(local_ngrok):
        return local_ngrok

    common_paths = [
        os.path.join(
            os.environ.get("LOCALAPPDATA", ""),
            "Microsoft", "WinGet", "Packages", "ngrok.ngrok"
        ),
        r"C:\ngrok\ngrok.exe",
        os.path.join(os.environ.get("USERPROFILE", ""), "ngrok.exe"),
        r"C:\Windows\System32\ngrok.exe",
    ]
    for path in common_paths:
        if os.path.exists(path):
            return path
    return None


def _query_ngrok_url() -> str | None:
    """查詢本機 ngrok API，取得目前正在運作的 https 通道 URL"""
    for api_port in [4040, 4041, 4042]:
        try:
            res = urllib.request.urlopen(
                f"http://127.0.0.1:{api_port}/api/tunnels", timeout=1
            )
            data = json.loads(res.read())
            for tunnel in data.get("tunnels", []):
                if tunnel.get("proto") == "https":
                    return tunnel["public_url"]
        except Exception:
            pass
    return None


def start_ngrok_background(port: int = 5173, result_container: list = None):
    """
    在背景執行緒中啟動 Ngrok 並取得公開網址
    優先沿用現有的 ngrok 通道（URL 保持不變，不重複取得新網址）
    結果儲存在 result_container[0]
    """
    ngrok_path = find_ngrok()
    if not ngrok_path:
        if result_container is not None:
            result_container.append(None)
        return

    # ── 優先沿用現有通道 ──
    existing_url = _query_ngrok_url()
    if existing_url:
        if result_container is not None:
            result_container.append(existing_url)
        return

    # ── 無可用通道，才關掉舊的並重新啟動 ──
    if sys.platform == "win32":
        subprocess.run("taskkill /F /IM ngrok.exe", shell=True, capture_output=True)
        kill_port(4040)
        kill_port(4041)
        kill_port(4042)
        time.sleep(0.5)

    ngrok_proc = subprocess.Popen(
        f'"{ngrok_path}" http {port}',
        shell=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    processes.append(ngrok_proc)

    # 等待 ngrok 啟動（最多 30 秒）
    ngrok_url = None
    for _ in range(60):
        time.sleep(0.5)
        ngrok_url = _query_ngrok_url()
        if ngrok_url:
            break

    if result_container is not None:
        result_container.append(ngrok_url)


def wait_for_backend(port: int = 8168, timeout: int = 60) -> bool:
    """
    等待後端服務啟動（輪詢 health endpoint）
    顯示動態進度點讓使用者知道程式在運行中
    """
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
#  主程序
# ─────────────────────────────────────────────────────────────

def main():
    print("=" * 52)
    print("  🏃 Corphia AI Platform - 正在啟動，請稍候...")
    print("=" * 52)

    # ── [1/5] Docker ──────────────────────────────────────────
    if os.path.exists("docker-compose.yml"):
        print("  [1/5] 啟動 Docker 容器...")
        try:
            subprocess.run(
                "docker-compose up -d", shell=True, check=True,
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
            )
            print("  [OK] Docker 容器已啟動")
        except Exception:
            print("  [跳過] Docker 啟動失敗或未安裝，繼續...")
    else:
        print("  [1/5] 未偵測到 docker-compose.yml，跳過 Docker...")

    # ── [2/5] 清理 Port + 提前啟動 Ngrok（趁後端加載時取得網址）──
    print("  [2/5] 清理佔用的 Port，並在背景啟動 Ngrok...")
    kill_port(8168)
    kill_port(5173)

    ngrok_result: list = []
    ngrok_thread: threading.Thread | None = None
    if find_ngrok():
        ngrok_thread = threading.Thread(
            target=start_ngrok_background,
            args=(5173, ngrok_result),
            daemon=True
        )
        ngrok_thread.start()
        print("  [OK] Ngrok 已在背景啟動（趁後端加載期間取得公開網址）")
    else:
        print("  [略過] 未找到 ngrok 執行檔，公開網址功能停用")

    # ── [3/5] 硬體偵測 ────────────────────────────────────────
    print("  [3/5] 偵測硬體環境...")
    if os.path.exists(BACKEND_DIR):
        engine_script = os.path.join(BACKEND_DIR, "auto_engine.py")
        if os.path.exists(engine_script):
            venv_python = os.path.join(BACKEND_DIR, "venv", "Scripts", "python.exe")
            py_exec = venv_python if os.path.exists(venv_python) else sys.executable
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

    # ── [4/5] 前端先啟動 → 瀏覽器自動開啟 ──────────────────────
    print("  [4/5] 啟動前端服務 (Port 5173)...")
    if os.path.exists(FRONTEND_DIR):
        proc = subprocess.Popen(
            "npm run dev -- --host --logLevel silent",
            cwd=FRONTEND_DIR, shell=True,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
        )
        processes.append(proc)
        print(f"  [OK] 前端程序已啟動 (PID: {proc.pid})")

    # 等待 Vite 就緒後自動開啟瀏覽器
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
    if sys.platform == "win32":
        subprocess.Popen("start http://localhost:5173", shell=True)
    elif sys.platform == "darwin":
        subprocess.Popen(["open", "http://localhost:5173"])
    else:
        subprocess.Popen(["xdg-open", "http://localhost:5173"])
    print("  [OK] 瀏覽器已開啟（顯示「Corphia AI 引擎啟動中」畫面）✅")

    # ── [5/5] 後端啟動，前端持續輪詢直到就緒 ────────────────────
    print("  [5/5] 啟動後端服務 (Port 8168)...")
    if os.path.exists(BACKEND_DIR):
        venv_python = os.path.join(BACKEND_DIR, "venv", "Scripts", "python.exe")
        if os.path.exists(venv_python):
            backend_cmd = [
                venv_python, "-m", "uvicorn", "app.main:app",
                "--host", "0.0.0.0", "--port", "8168", "--log-level", "warning"
            ]
        else:
            backend_cmd = [
                sys.executable, "-m", "uvicorn", "app.main:app",
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
            print("  [警告] 後端啟動逾時，請確認 PostgreSQL 是否正在執行（Docker 需先啟動）⚠️")

    # ── 等待 Ngrok 結果（後端加載期間 ngrok 早應完成）────────────
    if ngrok_thread and ngrok_thread.is_alive():
        # 最多再等 10 秒（通常 ngrok 幾秒內就好了）
        ngrok_thread.join(timeout=10)

    # 取得公開網址（若 ngrok_result 仍空，再查詢一次）
    public_url = (ngrok_result[0] if ngrok_result else None) or _query_ngrok_url()

    # ── 顯示完整服務資訊 ──────────────────────────────────────
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
    if public_url:
        print(f"  🌍 公開網址（Ngrok）")
        print(f"     前端: {public_url}")
        print(f"     後端: {public_url.replace(':5173', ':8168') if ':5173' in public_url else public_url + ' → port 5173'}")
        print()
        print(f"  💡 想換新公開網址？執行: python ngrok_reset.py")
    else:
        print(f"  🌍 公開網址（Ngrok）")
        print(f"     ⚠️  Ngrok 連線失敗或未安裝")
        print(f"     💡 嘗試重設：python ngrok_reset.py")
    print()
    print("  🛑 按下 Ctrl+C 可隨時關閉所有服務")
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
