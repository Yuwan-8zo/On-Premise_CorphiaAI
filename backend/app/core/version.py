"""
這個系統的版本號：唯一來源是專案根目錄的 VERSION 檔（一鍵更新也是比對這個檔案）。
之前 main.py／health.py 各自寫死 "2.3.0"，升版會漏改；改成都讀這裡。
"""

from __future__ import annotations

from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[3]


def _read_version() -> str:
    try:
        return (_REPO_ROOT / "VERSION").read_text(encoding="utf-8").strip() or "0.0.0"
    except OSError:
        return "0.0.0"


APP_VERSION = _read_version()

__all__ = ["APP_VERSION"]
