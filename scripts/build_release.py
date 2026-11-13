"""
打包一個版本的「更新包」，給開發者（我們自己）在發新版本時用的，不是給客戶端跑的。

把 scripts/release_manifest.py 的 RELEASE_PATHS 列的程式碼／設定檔打成一個 zip，再算一個 SHA-256
的檔案，兩個檔案一起上傳到 GitHub Release（update.py 會去抓這兩個檔案來更新客戶端的伺服器）。

那份清單就是「一鍵更新」會不會動到某個路徑的唯一依據（update.py 的備份步驟也讀同一份）：
想讓某個檔案跟著更新，就加進 RELEASE_PATHS；使用者資料（.env、uploads/、generated/、ai_model/、
.venv、node_modules、.runtime/）本來就不该列進去，不在清單上＝update.py 永遠不會去動它。

用法：
    python scripts/build_release.py 2.4.0
    # 產生 dist/corphia-update-v2.4.0.zip 和 .zip.sha256

發布到 GitHub（需要先 git tag v2.4.0 && git push --tags）：
    gh release create v2.4.0 dist/corphia-update-v2.4.0.zip dist/corphia-update-v2.4.0.zip.sha256 --notes "..."
"""

from __future__ import annotations

import hashlib
import sys
import zipfile
from pathlib import Path

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

BASE_DIR = Path(__file__).resolve().parents[1]
DIST_DIR = BASE_DIR / "dist"

from release_manifest import RELEASE_PATHS  # noqa: E402 - 同一個資料夾，python 已把這個目錄放進 sys.path

_SKIP_DIR_NAMES = {"__pycache__", "node_modules", ".venv"}


def _iter_files(path: Path):
    for file in path.rglob("*"):
        if file.is_file() and not _SKIP_DIR_NAMES.intersection(file.parts):
            yield file


def build(version: str) -> Path:
    DIST_DIR.mkdir(exist_ok=True)
    zip_path = DIST_DIR / f"corphia-update-v{version}.zip"

    missing = [p for p in RELEASE_PATHS if not (BASE_DIR / p).exists()]
    if missing:
        print(f"[警告] 清單裡這些路徑現在不存在，打包時會跳過：{missing}")

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for rel in RELEASE_PATHS:
            path = BASE_DIR / rel
            if not path.exists():
                continue
            if path.is_file():
                zf.write(path, rel)
            else:
                for file in _iter_files(path):
                    zf.write(file, Path(rel) / file.relative_to(path))

    checksum_path = zip_path.with_suffix(zip_path.suffix + ".sha256")
    h = hashlib.sha256()
    with zip_path.open("rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    checksum_path.write_text(f"{h.hexdigest()}  {zip_path.name}\n", encoding="utf-8")

    print(f"[OK] 已產生 {zip_path}（{zip_path.stat().st_size // 1024} KB）")
    print(f"[OK] 已產生 {checksum_path}")
    return zip_path


def main() -> int:
    if len(sys.argv) != 2:
        print("用法：python scripts/build_release.py <版本號，例如 2.4.0>")
        return 1
    version = sys.argv[1].lstrip("vV")

    version_file = BASE_DIR / "VERSION"
    current = version_file.read_text(encoding="utf-8").strip() if version_file.exists() else ""
    if current != version:
        print(f"[提醒] 專案根目錄的 VERSION 檔還是 {current!r}，打包前記得先更新成 {version!r} 再重新執行。")
        return 1

    build(version)
    return 0


if __name__ == "__main__":
    sys.exit(main())
