"""
Corphia AI Platform - 一鍵啟動腳本

同時啟動後端和前端服務
"""

import subprocess
import sys
import os
import time
import signal
from pathlib import Path

# 專案根目錄
PROJECT_ROOT = Path(__file__).parent
BACKEND_DIR = PROJECT_ROOT / "backend"
FRONTEND_DIR = PROJECT_ROOT / "frontend"

# 子進程列表
processes = []


def check_requirements():
    """檢查必要條件"""
    # 檢查 Python
    print("🔍 檢查環境...")
    
    # 檢查後端依賴
    if not (BACKEND_DIR / "app").exists():
        print("❌ 找不到 backend/app 目錄")
        return False
    
    # 檢查前端依賴
    if not (FRONTEND_DIR / "node_modules").exists():
        print("⚠️  前端依賴未安裝，正在安裝...")
        result = subprocess.run(
            ["npm", "install", "--legacy-peer-deps"],
            cwd=FRONTEND_DIR,
            shell=True
        )
        if result.returncode != 0:
            print("❌ 前端依賴安裝失敗")
            return False
    
    print("✅ 環境檢查通過")
    return True


def start_backend():
    """啟動後端服務"""
    print("\n🚀 正在啟動後端服務...")
    process = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--reload", "--port", "8000"],
        cwd=BACKEND_DIR,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0
    )
    processes.append(process)
    print("   ✅ 後端: http://localhost:8000")
    print("   📖 API 文檔: http://localhost:8000/docs")
    return process


def start_frontend():
    """啟動前端服務"""
    print("\n🚀 正在啟動前端服務...")
    process = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=FRONTEND_DIR,
        shell=True,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0
    )
    processes.append(process)
    print("   ✅ 前端: http://localhost:5173")
    return process


def cleanup(signum=None, frame=None):
    """清理子進程"""
    print("\n\n🛑 正在關閉服務...")
    for p in processes:
        try:
            if os.name == 'nt':
                p.terminate()
            else:
                os.killpg(os.getpgid(p.pid), signal.SIGTERM)
        except:
            pass
    print("👋 所有服務已關閉")
    sys.exit(0)


def main():
    print("=" * 50)
    print("   Corphia AI Platform - 啟動腳本")
    print("=" * 50)
    
    # 檢查必要條件
    if not check_requirements():
        sys.exit(1)
    
    # 註冊信號處理
    signal.signal(signal.SIGINT, cleanup)
    if hasattr(signal, 'SIGTERM'):
        signal.signal(signal.SIGTERM, cleanup)
    
    # 啟動服務
    backend = start_backend()
    time.sleep(2)  # 等待後端啟動
    frontend = start_frontend()
    
    print("\n" + "=" * 50)
    print("   🎉 所有服務已啟動！")
    print("=" * 50)
    print("\n📌 存取位址:")
    print("   • 前端網站: http://localhost:5173")
    print("   • 後端 API:  http://localhost:8000")
    print("   • API 文檔:  http://localhost:8000/docs")
    print("\n💡 按 Ctrl+C 停止所有服務")
    print("-" * 50)
    
    # 等待進程
    try:
        while True:
            if backend.poll() is not None:
                print("\n⚠️ 後端服務已停止")
                break
            if frontend.poll() is not None:
                print("\n⚠️ 前端服務已停止")
                break
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        cleanup()


if __name__ == "__main__":
    main()
