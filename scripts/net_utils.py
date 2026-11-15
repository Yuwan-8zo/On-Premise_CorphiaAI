"""
共用的小工具：console 輸出、版本號比對、下載＋進度、SHA-256、查 GitHub 最新 release。

被 update.py（伺服器一鍵更新）和 scripts/setup_pgvector.py（編譯 pgvector）共用，
避免同一套「連網下載＋核對雜湊」邏輯在兩個地方各寫一份、改一邊忘了改另一邊。
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path
from urllib.request import Request, urlopen

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


def info(message: str = "") -> None:
    print(message, flush=True)


def ok(message: str) -> None:
    info(f"[OK] {message}")


def warn(message: str) -> None:
    info(f"[警告] {message}")


def fail(message: str) -> None:
    info(f"[錯誤] {message}")


def parse_version(v: str) -> tuple[int, ...]:
    """"v2.4.0" / "2.4.0" → (2, 4, 0)；格式不對就當成 (0,)，不會讓程式整個爆掉"""
    v = v.strip().lstrip("vV")
    try:
        return tuple(int(part) for part in v.split("."))
    except ValueError:
        return (0,)


def fetch_latest_release(repo: str) -> dict:
    """問 GitHub 這個 repo（"owner/name"）最新的 release 是什麼；回傳 API 原始 JSON（tag_name／body／assets…）"""
    url = f"https://api.github.com/repos/{repo}/releases/latest"
    req = Request(url, headers={"Accept": "application/vnd.github+json", "User-Agent": "CorphiaAI-Updater"})
    with urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def find_asset(assets: list[dict], suffix: str) -> dict | None:
    for asset in assets:
        if asset.get("name", "").endswith(suffix):
            return asset
    return None


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def download(url: str, dest: Path) -> None:
    info(f"下載中：{url}")
    req = Request(url, headers={"User-Agent": "CorphiaAI-Updater"})
    with urlopen(req, timeout=60) as resp, dest.open("wb") as out:
        total = int(resp.headers.get("Content-Length") or 0)
        written = 0
        last_pct = -1
        while True:
            chunk = resp.read(1 << 20)
            if not chunk:
                break
            out.write(chunk)
            written += len(chunk)
            if total:
                pct = written * 100 // total
                if pct != last_pct:
                    info(f"  {pct}% ({written // 1024} / {total // 1024} KB)")
                    last_pct = pct


def verify_checksum(zip_path: Path, checksum_path: Path) -> bool:
    """checksum 檔格式："<64位hex>  <檔名>"（標準 sha256sum 輸出）；只比對前面那串雜湊值"""
    expected = checksum_path.read_text(encoding="utf-8").strip().split()[0].lower()
    actual = sha256_of(zip_path).lower()
    if expected != actual:
        fail(f"SHA-256 核對失敗：期望 {expected}，實際 {actual}（下載可能不完整或被竄改，已經不會套用）")
        return False
    ok("SHA-256 核對通過")
    return True


__all__ = [
    "info", "ok", "warn", "fail", "parse_version", "fetch_latest_release",
    "find_asset", "sha256_of", "download", "verify_checksum",
]
