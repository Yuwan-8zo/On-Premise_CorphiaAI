"""
Corphia AI - 一鍵啟動腳本
執行方式: python start.py
按下 Ctrl+C 可同時關閉前端與後端
"""

import subprocess
import os
import sys
import time
import signal

# 修正 Windows 終端機編碼問題
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
BACKEND_DIR = os.path.join(BASE_DIR, "backend")

# 儲存所有已啟動的子程序
processes: list[subprocess.Popen] = []


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
    print("  [OK] 前端與後端已全部關閉\n")
    sys.exit(0)


# 攔截 Ctrl+C
signal.signal(signal.SIGINT, shutdown)
signal.signal(signal.SIGTERM, shutdown)


def start_service(title: str, cwd: str, command: str) -> subprocess.Popen:
    """
    在新的視窗中啟動服務，並返回程序物件
    使用 CREATE_NEW_CONSOLE 讓日誌顯示在獨立視窗中
    """
    proc = subprocess.Popen(
        command,
        cwd=cwd,
        shell=True,
        creationflags=subprocess.CREATE_NEW_CONSOLE,
    )
    print(f"  [OK] {title} 已啟動 (PID: {proc.pid})")
    return proc


def main():
    print("=" * 50)
    print("  Corphia AI - 啟動中...")
    print("  按下 Ctrl+C 可同時關閉前端與後端")
    print("=" * 50)

    # --- 啟動後端 ---
    print("\n[1] 啟動後端 (FastAPI)...")
    if os.path.exists(BACKEND_DIR):
        venv_python = os.path.join(BACKEND_DIR, "venv", "Scripts", "python.exe")
        if os.path.exists(venv_python):
            backend_cmd = f'"{venv_python}" -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000'
        else:
            backend_cmd = "uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

        proc = start_service("Backend (FastAPI :8000)", BACKEND_DIR, backend_cmd)
        processes.append(proc)
    else:
        print("  [SKIP] 找不到 backend 資料夾，跳過")

    time.sleep(1)

    # --- 啟動前端 ---
    print("[2] 啟動前端 (Vite)...")
    if os.path.exists(FRONTEND_DIR):
        proc = start_service("Frontend (Vite :5173)", FRONTEND_DIR, "npm run dev -- --host")
        processes.append(proc)
    else:
        print("  [SKIP] 找不到 frontend 資料夾，跳過")

    print("\n" + "=" * 50)
    print("  前端: http://localhost:5173")
    print("  後端: http://localhost:8000")
    print("  API 文件: http://localhost:8000/docs")
    print("=" * 50)
    print("\n  服務運行中... 按 Ctrl+C 可關閉所有服務\n")

    # 持續等待，直到 Ctrl+C
    while True:
        time.sleep(1)
        # 若子程序意外退出，提示使用者
        for proc in processes:
            if proc.poll() is not None:
                print(f"  [WARN] PID {proc.pid} 意外退出 (code: {proc.returncode})")
                processes.remove(proc)
                break


if __name__ == "__main__":
    main()
