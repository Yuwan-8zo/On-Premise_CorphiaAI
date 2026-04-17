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


def start_ngrok(port: int = 5173) -> str | None:
    """
    啟動 Ngrok 並取得公開網址
    回傳格式: https://xxxx.ngrok-free.app 或 None（失敗時）
    """
    ngrok_path = find_ngrok()

    if not ngrok_path:
        return None

    # 先關掉殘留的 ngrok 程序與可能佔用的 4040 api port（避免 port 與 tunnel 衝突）
    if sys.platform == "win32":
        subprocess.run("taskkill /F /IM ngrok.exe", shell=True, capture_output=True)
        kill_port(4040)
        time.sleep(0.5)

    # 啟動 ngrok（在背景，不開新視窗）
    ngrok_proc = subprocess.Popen(
        f'"{ngrok_path}" http {port}',
        shell=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    processes.append(ngrok_proc)

    # 等待 ngrok 啟動（最多 8 秒）
    ngrok_url = None
    for attempt in range(16):
        time.sleep(0.5)
        try:
            # NOTE: ngrok 的本地管理 API 在 localhost:4040
            res = urllib.request.urlopen("http://127.0.0.1:4040/api/tunnels", timeout=2)
            data = json.loads(res.read())
            tunnels = data.get("tunnels", [])
            for tunnel in tunnels:
                if tunnel.get("proto") == "https":
                    ngrok_url = tunnel["public_url"]
                    break
            if ngrok_url:
                break
        except Exception:
            pass  # 尚未啟動，繼續等待

    return ngrok_url


def main():
    print("=" * 50)
    print("  🏃 Corphia AI Platform - 正在啟動，請稍候...")
    print("=" * 50)

    # --- 啟動 Docker 容器 (背景靜默啟動) ---
    if os.path.exists("docker-compose.yml"):
        try:
            subprocess.run("docker-compose up -d", shell=True, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            pass

    # --- 清理可能殘留的 Port ---
    kill_port(8168)
    kill_port(5173)

    # --- 自動硬體適配與 AI 引擎配置 ---
    if os.path.exists(BACKEND_DIR):
        engine_script = os.path.join(BACKEND_DIR, "auto_engine.py")
        if os.path.exists(engine_script):
            venv_python = os.path.join(BACKEND_DIR, "venv", "Scripts", "python.exe")
            py_exec = venv_python if os.path.exists(venv_python) else sys.executable
            # 靜默執行引擎偵測
            subprocess.run([py_exec, engine_script] + sys.argv[1:], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # --- 啟動後端 ---
    if os.path.exists(BACKEND_DIR):
        venv_python = os.path.join(BACKEND_DIR, "venv", "Scripts", "python.exe")
        if os.path.exists(venv_python):
            backend_cmd = [venv_python, "-m", "uvicorn", "app.main:app", "--reload", "--host", "0.0.0.0", "--port", "8168", "--log-level", "warning"]
        else:
            backend_cmd = [sys.executable, "-m", "uvicorn", "app.main:app", "--reload", "--host", "0.0.0.0", "--port", "8168", "--log-level", "warning"]
        
        proc = subprocess.Popen(backend_cmd, cwd=BACKEND_DIR, shell=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        processes.append(proc)

    time.sleep(1)

    # --- 啟動前端 ---
    if os.path.exists(FRONTEND_DIR):
        proc = subprocess.Popen("npm run dev -- --host --logLevel silent", cwd=FRONTEND_DIR, shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        processes.append(proc)

    time.sleep(2)

    # --- 啟動 Ngrok ---
    ngrok_url = start_ngrok(port=5173)

    # --- 顯示存取資訊 ---
    local_ip = get_local_ip()
    print("\n" + "=" * 50)
    print("  🟢 服務已全面啟動完成")
    print("-" * 50)
    print("  本機存取")
    print(f"    前端: http://localhost:5173")
    print("    後端: http://localhost:8168")
    print("  區域網路存取 (手機/其他裝置)")
    print(f"    前端: http://{local_ip}:5173")
    print(f"    後端: http://{local_ip}:8168")
    if ngrok_url:
        print("  🌍 公開網址 (可分享給任何人)")
        print(f"    前端: {ngrok_url}")
    else:
        print("  ⚠️  未啟動 Ngrok，(可能因重啟過快被伺服器阻擋，請稍候重試)")
    print(f"  API 文件: http://localhost:8168/docs")
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
