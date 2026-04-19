"""
Corphia AI - 一鍵啟動腳本
執行方式: python start.py
按下 Ctrl+C 可同時關閉前端、後端與 Ngrok
"""

import subprocess
import os
import sys
import time
import signal
import socket
import urllib.request
import urllib.error
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


def get_local_ip() -> str:
    """取得本機區網 IP"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "無法取得 IP"


def kill_process_tree(pid: int):
    """強制終止 Windows 上的整個程序樹（包含子程序）"""
    subprocess.run(
        ["taskkill", "/F", "/T", "/PID", str(pid)],
        capture_output=True
    )


def shutdown(sig=None, frame=None):
    """Ctrl+C 或訊號觸發時，關閉所有服務"""
    print("\n\n  正在關閉所有服務...")
    for proc in processes:
        try:
            kill_process_tree(proc.pid)
        except Exception:
            pass

    # NOTE: 也嘗試關閉可能殘留的 ngrok 程序
    if sys.platform == "win32":
        subprocess.run("taskkill /F /IM ngrok.exe", shell=True, capture_output=True)

    print("  [OK] 所有服務已全部關閉\n")
    sys.exit(0)


# 攔截 Ctrl+C
signal.signal(signal.SIGINT, shutdown)
signal.signal(signal.SIGTERM, shutdown)


def kill_port(port: int):
    """找出佔用指定 Port 的程序並強制終止 (僅限 Windows)"""
    if sys.platform != "win32":
        return
    try:
        result = subprocess.run(
            "netstat -ano",
            shell=True, capture_output=True, text=True
        )
        if result.stdout:
            for line in result.stdout.strip().split("\n"):
                if "LISTENING" not in line:
                    continue
                parts = line.strip().split()
                if len(parts) >= 5:
                    # parts[1] is Local Address like 0.0.0.0:8000
                    if parts[1].endswith(f":{port}"):
                        pid = parts[-1]
                        if pid != "0":
                            subprocess.run(f"taskkill /F /T /PID {pid}", shell=True, capture_output=True)
    except Exception:
        pass


def start_service(title: str, cwd: str, command: str | list) -> subprocess.Popen:
    """
    啟動服務，並返回程序物件
    """
    proc = subprocess.Popen(
        command,
        cwd=cwd,
        shell=isinstance(command, str),
    )
    print(f"  [OK] {title} 已啟動 (PID: {proc.pid})")
    return proc


def find_ngrok() -> str | None:
    """
    尋找 ngrok 執行檔位置
    搜尋順序: 系統 PATH → 專案根目錄 → 常見安裝位置
    """
    # 先從 PATH 找
    ngrok_in_path = shutil.which("ngrok")
    if ngrok_in_path:
        return ngrok_in_path

    # 從專案根目錄找
    local_ngrok = os.path.join(BASE_DIR, "ngrok.exe")
    if os.path.exists(local_ngrok):
        return local_ngrok

    # 常見 Windows 安裝位置
    common_paths = [
        os.path.join(os.environ.get("LOCALAPPDATA", ""), "Microsoft", "WinGet", "Packages", "ngrok.ngrok"),
        r"C:\ngrok\ngrok.exe",
        os.path.join(os.environ.get("USERPROFILE", ""), "ngrok.exe"),
        r"C:\Windows\System32\ngrok.exe",
    ]
    for path in common_paths:
        if os.path.exists(path):
            return path

    return None


def start_ngrok_background(port: int = 5173, result_container: list = None):
    """
    在背景執行緒中啟動 Ngrok 並取得公開網址
    結果儲存在 result_container[0]，None 表示失敗
    """
    ngrok_path = find_ngrok()

    if not ngrok_path:
        if result_container is not None:
            result_container.append(None)
        return

    # 先關掉殘留的 ngrok 程序
    if sys.platform == "win32":
        subprocess.run("taskkill /F /IM ngrok.exe", shell=True, capture_output=True)
        kill_port(4040)
        kill_port(4041)
        kill_port(4042)
        time.sleep(0.5)

    # 啟動 ngrok
    ngrok_proc = subprocess.Popen(
        f'"{ngrok_path}" http {port}',
        shell=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    processes.append(ngrok_proc)

    # 等待 ngrok 啟動（最多 20 秒）
    ngrok_url = None
    for attempt in range(40):
        time.sleep(0.5)
        for api_port in [4040, 4041, 4042]:
            try:
                res = urllib.request.urlopen(f"http://127.0.0.1:{api_port}/api/tunnels", timeout=1)
                data = json.loads(res.read())
                tunnels = data.get("tunnels", [])
                for tunnel in tunnels:
                    if tunnel.get("proto") == "https":
                        ngrok_url = tunnel["public_url"]
                        break
                if ngrok_url:
                    break
            except Exception:
                pass
        if ngrok_url:
            break

    if result_container is not None:
        result_container.append(ngrok_url)


def wait_for_backend(port: int = 8168, timeout: int = 60) -> bool:
    """
    等待後端服務啟動（輪詢 health endpoint）
    顯示動態進度點讓使用者知道程式在運行中
    回傳 True 表示後端已就緒，False 表示逾時
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
        # 每秒印一個點，每 20 個點換行
        print(".", end="", flush=True)
        dots += 1
        if dots % 20 == 0:
            print(f"\n  ", end="", flush=True)
        time.sleep(1)
    print(" 逾時", flush=True)
    return False


def main():
    print("=" * 50)
    print("  🏃 Corphia AI Platform - 正在啟動，請稍候...")
    print("=" * 50)

    # --- 啟動 Docker 容器 (背景靜默啟動) ---
    if os.path.exists("docker-compose.yml"):
        print("  [1/5] 啟動 Docker 容器...")
        try:
            subprocess.run("docker-compose up -d", shell=True, check=True,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            print("  [OK] Docker 容器已啟動")
        except Exception:
            print("  [跳過] Docker 啟動失敗或未安裝，繼續...")
    else:
        print("  [1/5] 未偵測到 docker-compose.yml，跳過 Docker...")

    # --- 清理可能殘留的 Port ---
    print("  [2/5] 清理佔用的 Port 8168, 5173...")
    kill_port(8168)
    kill_port(5173)

    # --- 自動硬體適配與 AI 引擎配置 ---
    print("  [3/5] 偵測硬體環境...")
    if os.path.exists(BACKEND_DIR):
        engine_script = os.path.join(BACKEND_DIR, "auto_engine.py")
        if os.path.exists(engine_script):
            venv_python = os.path.join(BACKEND_DIR, "venv", "Scripts", "python.exe")
            py_exec = venv_python if os.path.exists(venv_python) else sys.executable
            # 靜默執行引擎偵測（設定超時保護，避免卡住）
            try:
                subprocess.run(
                    [py_exec, engine_script] + sys.argv[1:],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    timeout=10  # NOTE: 最多等待 10 秒，避免卡住
                )
            except subprocess.TimeoutExpired:
                print("  [跳過] 硬體偵測超時，使用預設設定")
            except Exception:
                pass

    # --- [4/5] 前端先啟動（速度快，讓瀏覽器可以馬上開啟） ---
    print("  [4/5] 啟動前端服務 (Port 5173)...")
    if os.path.exists(FRONTEND_DIR):
        proc = subprocess.Popen(
            "npm run dev -- --host --logLevel silent",
            cwd=FRONTEND_DIR, shell=True,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
        )
        processes.append(proc)
        print(f"  [OK] 前端程序已啟動 (PID: {proc.pid})")

    # 等待 Vite 就緒（通常 2~3 秒）後自動開啟瀏覽器
    print("  [瀏覽器] 等待前端就緒，即將自動開啟瀏覽器...", end="", flush=True)
    for _ in range(6):  # 最多等待 3 秒 (6 * 0.5s)
        time.sleep(0.5)
        print(".", end="", flush=True)
        try:
            r = urllib.request.urlopen("http://127.0.0.1:5173", timeout=1)
            if r.status < 500:
                break
        except Exception:
            pass
    print()
    # 自動開啟瀏覽器
    if sys.platform == "win32":
        subprocess.Popen("start http://localhost:5173", shell=True)
    elif sys.platform == "darwin":
        subprocess.Popen(["open", "http://localhost:5173"])
    else:
        subprocess.Popen(["xdg-open", "http://localhost:5173"])
    print("  [OK] 瀏覽器已開啟，前端正在顯示啟動畫面 ✅")

    # --- [5/5] 後端在背景啟動，前端的啟動畫面會一直輪詢直到就緒 ---
    print("  [5/5] 啟動後端服務 (Port 8168)...")
    if os.path.exists(BACKEND_DIR):
        venv_python = os.path.join(BACKEND_DIR, "venv", "Scripts", "python.exe")
        if os.path.exists(venv_python):
            backend_cmd = [venv_python, "-m", "uvicorn", "app.main:app",
                           "--host", "0.0.0.0", "--port", "8168", "--log-level", "warning"]
        else:
            backend_cmd = [sys.executable, "-m", "uvicorn", "app.main:app",
                           "--host", "0.0.0.0", "--port", "8168", "--log-level", "warning"]

        proc = subprocess.Popen(backend_cmd, cwd=BACKEND_DIR, shell=False,
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        processes.append(proc)
        print(f"  [OK] 後端程序已啟動 (PID: {proc.pid})")
        print("  [等待] 後端 API 就緒中（LLM 模型載入可能需要 1~2 分鐘）：")

        # 等待後端健康檢查通過（最多 60 秒，LLM 模型載入需時）
        backend_ready = wait_for_backend(8168, timeout=60)
        if backend_ready:
            print("  [OK] 後端 API 已就緒 ✅")
        else:
            print("  [警告] 後端啟動逾時，請確認 PostgreSQL 是否正在執行（Docker 需先啟動）⚠️")

    # --- 在背景啟動 Ngrok（不阻塞）---
    ngrok_result = []
    ngrok_thread = None
    ngrok_path = find_ngrok()
    if ngrok_path:
        print("  [Ngrok] 正在背景取得公開網址...")
        ngrok_thread = threading.Thread(
            target=start_ngrok_background,
            args=(5173, ngrok_result),
            daemon=True
        )
        ngrok_thread.start()

    # --- 顯示存取資訊 ---
    local_ip = get_local_ip()
    print("\n" + "=" * 50)
    print("  🟢 服務已全面啟動完成")
    print("-" * 50)
    print("  本機存取")
    print(f"    前端: http://localhost:5173")
    print(f"    後端: http://localhost:8168")
    print("  區域網路存取 (手機/其他裝置)")
    print(f"    前端: http://{local_ip}:5173")
    print(f"    後端: http://{local_ip}:8168")
    print(f"  API 文件: http://localhost:8168/docs")
    print("-" * 50)

    if ngrok_thread:
        # 非阻塞：若 ngrok 已完成就顯示，否則在後台繼續嘗試
        ngrok_thread.join(timeout=0.1)
        if ngrok_result and ngrok_result[0]:
            print(f"  🌍 公開網址 (Ngrok): {ngrok_result[0]}")
        else:
            print("  ⏳ Ngrok 公開網址正在背景取得中，請稍候...")
    else:
        print("  ℹ️  未安裝 Ngrok，無法提供公開存取網址")

    print("-" * 50)
    print("  🛑 按下 Ctrl+C 可隨時關閉所有服務")
    print("=" * 50 + "\n")

    # 持續等待，直到 Ctrl+C
    while True:
        time.sleep(1)
        # 若子程序意外退出，提示使用者
        for proc in list(processes):
            if proc.poll() is not None:
                # 不顯示 Vite 正常重啟產生的退出碼，保持靜默
                processes.remove(proc)
                break


if __name__ == "__main__":
    main()
