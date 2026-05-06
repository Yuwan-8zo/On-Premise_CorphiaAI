"""
Corphia AI Backend — PyInstaller 入口點
========================================

這個檔是「打包後 exe」的進入點，跟 dev 用的 `uvicorn app.main:app` 不同：

- 不依賴 uvicorn CLI（CLI reload 在 PyInstaller bundle 裡會壞）
- 直接用 uvicorn.Server 程式化啟動
- 處理 Tauri sidecar 透過環境變數 / argv 傳進來的 host / port
- 提供 graceful shutdown（Tauri 視窗關閉時送 SIGTERM 會被接到）

執行模式：
    1. 開發：       python corphia_server.py                  → 127.0.0.1:8168
    2. 自訂 port：  python corphia_server.py --port 9000
    3. PyInstaller：bundled exe 走同樣 argv 介面

Tauri sidecar 預設會把這個 exe 放在 resources/binaries/，
配上 externalBin 設定，視窗啟動時自動 spawn、視窗關閉時自動 kill。
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path


def _resolve_base_path() -> Path:
    """
    取得「程式根目錄」。

    PyInstaller bundle 模式下，sys.executable 指向 exe 自己（例如
    `corphia-server.exe`），而不是 source code 路徑。我們需要這個路徑來：
      - 定位旁邊的 .env、config 檔
      - 定位旁邊的 ai_model/ GGUF 模型資料夾
      - 寫 log 檔到正確位置

    開發模式（直接 python corphia_server.py）就是 backend/ 目錄。
    """
    if getattr(sys, "frozen", False):
        # PyInstaller bundle
        return Path(sys.executable).parent
    return Path(__file__).resolve().parent


def _setup_runtime_paths(base: Path) -> None:
    """
    把 PyInstaller bundle 的工作目錄調整對。

    打包後 exe 啟動時 cwd 通常是使用者按下執行檔的位置（例如桌面），
    但我們的程式預期 cwd 是 backend/ 根（讀 .env、寫 logs/、抓 ai_model/）。

    所以 bundled 模式下強制 chdir 到 exe 同目錄。
    """
    if getattr(sys, "frozen", False):
        os.chdir(base)
        # 把 base/ 也加進 sys.path 讓 `from app.xxx` 能 work
        if str(base) not in sys.path:
            sys.path.insert(0, str(base))


def main() -> int:
    parser = argparse.ArgumentParser(description="Corphia AI Backend Server")
    parser.add_argument(
        "--host",
        default=os.environ.get("CORPHIA_HOST", "127.0.0.1"),
        help="綁定 host (預設 127.0.0.1，只接受本機連線)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.environ.get("CORPHIA_PORT", "8168")),
        help="綁定 port (預設 8168)",
    )
    parser.add_argument(
        "--log-level",
        default=os.environ.get("CORPHIA_LOG_LEVEL", "info"),
        choices=["critical", "error", "warning", "info", "debug", "trace"],
        help="uvicorn log level (預設 info)",
    )
    args = parser.parse_args()

    # 調整路徑（bundle 模式才會生效）
    base = _resolve_base_path()
    _setup_runtime_paths(base)

    # 印出啟動 banner（讓 Tauri sidecar log / 使用者看到狀態）
    print(f"[Corphia] base path: {base}", flush=True)
    print(f"[Corphia] mode: {'bundled exe' if getattr(sys, 'frozen', False) else 'dev'}", flush=True)
    print(f"[Corphia] listening on http://{args.host}:{args.port}", flush=True)

    # 延後 import — uvicorn / app.main 載入很重，要在路徑設好後才能正確
    # 讀到 .env / 找到 modules
    import uvicorn

    config = uvicorn.Config(
        "app.main:app",
        host=args.host,
        port=args.port,
        log_level=args.log_level,
        # 不要 reload — bundle 模式 watcher 壞掉而且也不需要
        reload=False,
        # 單 worker — Tauri sidecar 場景就一個使用者，多 worker 浪費記憶體
        workers=1,
        # 不要 access log（太吵），Tauri sidecar 看 stdout 會被洗版
        access_log=False,
        # log 用我們自己的格式（在 app.core.logging_config 裡設）
        log_config=None,
    )
    server = uvicorn.Server(config)

    try:
        server.run()
    except KeyboardInterrupt:
        # 預期的 Ctrl+C / Tauri 送 SIGTERM
        logging.getLogger(__name__).info("Server interrupted by signal, exiting cleanly")
        return 0
    except Exception as e:
        logging.getLogger(__name__).exception(f"Server crashed: {e}")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
