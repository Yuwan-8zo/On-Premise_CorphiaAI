"""
Corphia AI - Ngrok 公開網址重設工具
執行方式: python ngrok_reset.py
效果: 關閉舊 ngrok → 啟動新 ngrok → 顯示新公開網址
"""

import subprocess
import sys
import time
import socket
import urllib.request
import json
import shutil
import os

# 修正 Windows 終端機編碼問題
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

NGROK_PORT = 5173  # 前端 Port


def kill_port(port: int):
    """釋放指定 Port 的佔用程序"""
    if sys.platform != "win32":
        return
    try:
        result = subprocess.run("netstat -ano", shell=True, capture_output=True, text=True)
        for line in result.stdout.strip().split("\n"):
            if "LISTENING" not in line:
                continue
            parts = line.strip().split()
            if len(parts) >= 5 and parts[1].endswith(f":{port}"):
                pid = parts[-1]
                if pid != "0":
                    subprocess.run(f"taskkill /F /T /PID {pid}", shell=True, capture_output=True)
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
        os.path.join(os.environ.get("LOCALAPPDATA", ""), "Microsoft", "WinGet", "Packages", "ngrok.ngrok"),
        r"C:\ngrok\ngrok.exe",
        os.path.join(os.environ.get("USERPROFILE", ""), "ngrok.exe"),
        r"C:\Windows\System32\ngrok.exe",
    ]
    for path in common_paths:
        if os.path.exists(path):
            return path
    return None


def reset_ngrok() -> str | None:
    """重設 Ngrok：關閉舊的 → 啟動新的 → 回傳新網址"""

    # 1. 關閉舊 Ngrok
    print("  [1/3] 關閉舊 Ngrok 程序...")
    if sys.platform == "win32":
        subprocess.run("taskkill /F /IM ngrok.exe", shell=True, capture_output=True)
        kill_port(4040)
        kill_port(4041)
        kill_port(4042)
        time.sleep(1)
    print("  [OK] 舊 Ngrok 已關閉")

    # 2. 尋找 Ngrok
    ngrok_path = find_ngrok()
    if not ngrok_path:
        print("\n  ❌ 找不到 ngrok 執行檔！")
        print("  請安裝 ngrok：https://ngrok.com/download")
        return None

    # 啟動新 Ngrok
    print(f"  [2/3] 啟動新 Ngrok (Forwarding port {NGROK_PORT})...")
    subprocess.Popen(
        f'"{ngrok_path}" http {NGROK_PORT}',
        shell=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(1)

    # 4. 等待並取得新網址（最多 25 秒，顯示進度點）
    print("  [3/3] 等待 Ngrok 建立通道：", end="", flush=True)
    ngrok_url = None
    for attempt in range(50):  # 最多 25 秒（0.5s * 50）
        time.sleep(0.5)
        if attempt % 2 == 0:  # 每秒印一個點
            print(".", end="", flush=True)
        for api_port in [4040, 4041, 4042]:
            try:
                res = urllib.request.urlopen(f"http://127.0.0.1:{api_port}/api/tunnels", timeout=1)
                data = json.loads(res.read())
                for tunnel in data.get("tunnels", []):
                    if tunnel.get("proto") == "https":
                        ngrok_url = tunnel["public_url"]
                        break
                if ngrok_url:
                    break
            except Exception:
                pass
        if ngrok_url:
            break

    print()  # 換行
    return ngrok_url


def main():
    print("=" * 50)
    print("  🔄 Ngrok 公開網址重設工具")
    print("=" * 50)
    print()

    ngrok_url = reset_ngrok()

    print()
    print("=" * 50)
    if ngrok_url:
        # 取得本機 IP
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            local_ip = s.getsockname()[0]
            s.close()
        except Exception:
            local_ip = "無法取得"

        print("  ✅ Ngrok 重設完成！")
        print("-" * 50)
        print("  🌍 新公開網址 (前端 + 後端 API 共用同一 URL):")
        print(f"    前端:       {ngrok_url}")
        print(f"    後端 API:   {ngrok_url}/api/v1/")
        print(f"    WebSocket:  {ngrok_url.replace('https://', 'wss://')}/ws/")
        print()
        print("  ⚡ 架構說明：前後端皆透過 ngrok → Vite Proxy 路由")
        print("     /api/*  → port 8168 (FastAPI)")
        print("     /ws/*   → port 8168 (WebSocket)")
        print()
        print("  本機存取（若公開網址無效請改用）:")
        print(f"    前端: http://localhost:5173")
        print(f"    後端: http://localhost:8168")
        print(f"    LAN:  http://{local_ip}:5173")
    else:
        print("  ⚠️  Ngrok 網址取得失敗")
        print("-" * 50)
        print("  常見原因：")
        print("    1. Ngrok 帳號未設定 authtoken")
        print("       → 執行: ngrok config add-authtoken <your-token>")
        print("    2. 重啟過快，Ngrok 伺服器阻擋")
        print("       → 請稍候 30 秒後重試")
        print("    3. 網路連線問題")

    print("=" * 50)


if __name__ == "__main__":
    main()
