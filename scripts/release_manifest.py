"""
一個版本「算是程式碼」的路徑清單——唯一來源，update.py（備份）和 build_release.py（打包）都讀這裡，
不要各自維護一份清單（兩邊會抓不同步）。

使用者資料和機密設定本來就不該出現在這裡：.env、uploads/、generated/、ai_model/、.venv、
node_modules/、.runtime/、searxng 的 cache 等——不在清單上＝一鍵更新永遠不會去動它。
"""

from __future__ import annotations

RELEASE_PATHS: list[str] = [
    "VERSION",
    "docker-compose.yml",
    "start.py",
    "stop.py",
    "update.py",
    "一鍵啟動.bat",
    "一鍵關閉.bat",
    "一鍵更新.bat",
    "scripts/net_utils.py",
    "scripts/release_manifest.py",
    "scripts/build_release.py",
    "scripts/setup_postgres.py",
    "scripts/setup_pgvector.py",
    "backend/app",
    "backend/requirements.txt",
    "frontend/src",
    "frontend/package.json",
    "frontend/package-lock.json",
    "frontend/index.html",
    "frontend/vite.config.ts",
    "frontend/vite-plugins",
    "frontend/tsconfig.json",
    "frontend/tsconfig.node.json",
    "searxng/settings.yml",
    "searxng/limiter.toml",
    "searxng/Dockerfile",
]

__all__ = ["RELEASE_PATHS"]
