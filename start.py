"""
Corphia AI - 一鍵啟動腳本
執行方式: python start.py
"""

import subprocess
import os
import sys
import time

# 修正 Windows 終端機編碼問題
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
BACKEND_DIR = os.path.join(BASE_DIR, "backend")

def start_service(title: str, cwd: str, command: str):
    """在新的 PowerShell 視窗中啟動服務"""
    ps_command = f'Start-Process powershell -ArgumentList \'-NoExit\', \'-Command\', \'cd "{cwd}"; {command}\' -WindowStyle Normal'
    subprocess.Popen(
        ["powershell", "-Command", ps_command],
        creationflags=subprocess.CREATE_NO_WINDOW
    )
    print(f"  [OK] {title} 已啟動")

def main():
    print("=" * 50)
    print("  Corphia AI - 啟動中...")
    print("=" * 50)

    # 啟動後端
    print("\n[1] 啟動後端 (FastAPI)...")
    if os.path.exists(BACKEND_DIR):
        venv_python = os.path.join(BACKEND_DIR, "venv", "Scripts", "python.exe")
        # 優先使用 venv 內的 python，避免 Windows launcher 路徑問題
        if os.path.exists(venv_python):
            backend_cmd = f'"{venv_python}" -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000'
        else:
            backend_cmd = "uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
        start_service(
            title="Backend (FastAPI :8000)",
            cwd=BACKEND_DIR,
            command=backend_cmd
        )
    else:
        print("  [SKIP] 找不到 backend 資料夾，跳過")

    time.sleep(1)

    # 啟動前端
    print("[2] 啟動前端 (Vite)...")
    if os.path.exists(FRONTEND_DIR):
        start_service(
            title="Frontend (Vite :5173)",
            cwd=FRONTEND_DIR,
            command="npm run dev -- --host"
        )
    else:
        print("  [SKIP] 找不到 frontend 資料夾，跳過")

    print("\n" + "=" * 50)
    print("  前端: http://localhost:5173")
    print("  後端: http://localhost:8000")
    print("  API 文件: http://localhost:8000/docs")
    print("=" * 50)
    print("\n  兩個視窗已開啟，按 Enter 結束此視窗...")
    input()

if __name__ == "__main__":
    main()
