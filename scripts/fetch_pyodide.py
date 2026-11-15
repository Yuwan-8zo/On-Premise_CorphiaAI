"""
下載瀏覽器版的 Python（Pyodide）和資料分析套件，放進 frontend/public/pyodide/ (fetch_pyodide.py)

「執行程式」功能用的：AI 寫的 Python 在使用者自己瀏覽器的沙盒裡跑（不在主機上跑）。
系統不允許從外部網站載入任何東西，所以這些檔案要先下載好、由主機自己提供給瀏覽器；使用時完全不連外網。

    python scripts/fetch_pyodide.py          下載（已經有而且雜湊正確的檔案會跳過）
    python scripts/fetch_pyodide.py --check  只檢查現有的檔案對不對，不下載

每個檔案都核對 SHA-256：
  - Pyodide 自己的套件：對照官方清單 pyodide-lock.json 裡記的雜湊
  - 讀寫 Excel 的兩個套件（Pyodide 沒有內建，從 Python 官方套件庫下載）：對照這個檔案裡寫死的雜湊
  - 本體的幾個檔案官方清單沒有記雜湊：第一次下載後記在 manifest.json，之後 --check 用它確認沒被改過
不符就刪掉、不使用。這個資料夾不進版本控制（二進位檔、可以重新下載），打包介面時會一起包進去。
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import urllib.request
from pathlib import Path

VERSION = "314.0.7"
BASE_URL = f"https://cdn.jsdelivr.net/pyodide/v{VERSION}/full/"
OUT = Path(__file__).resolve().parents[1] / "frontend" / "public" / "pyodide"

# 本體：啟動 Pyodide 一定要的檔案
CORE = ("pyodide.mjs", "pyodide.asm.mjs", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json")
# 要帶的套件（它們需要的其他套件會照官方清單自動加進來）：表格、數值、畫圖
PACKAGES = ("numpy", "pandas", "matplotlib")
# 讀寫 Excel：純 Python 的套件，Pyodide 沒有內建。（檔名, 下載網址, SHA-256）
PYPI_WHEELS = (
    ("openpyxl-3.1.5-py2.py3-none-any.whl",
     "https://files.pythonhosted.org/packages/c0/da/977ded879c29cbd04de313843e76868e6e13408a94ed6b987245dc7c8506/openpyxl-3.1.5-py2.py3-none-any.whl",
     "5282c12b107bffeef825f4617dc029afaf41d0ea60823bbb665ef3079dc79de2"),
    ("et_xmlfile-2.0.0-py3-none-any.whl",
     "https://files.pythonhosted.org/packages/c1/8b/5fe2cc11fee489817272089c4203e679c63b570a5aaeb18d852ae3cbba6a/et_xmlfile-2.0.0-py3-none-any.whl",
     "7a91720bc756843502c3b7504c77b8fe44217c85c537d85037f0f536151b2caa"),
)
MANIFEST = "manifest.json"


def log(text: str) -> None:
    print(text, flush=True)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def download(url: str, dest: Path) -> None:
    request = urllib.request.Request(url, headers={"User-Agent": "corphia-fetch-pyodide", "Accept-Encoding": "identity"})
    tmp = dest.with_suffix(dest.suffix + ".part")
    with urllib.request.urlopen(request, timeout=120) as response, tmp.open("wb") as f:
        for block in iter(lambda: response.read(1 << 20), b""):
            f.write(block)
    tmp.replace(dest)


def closure(lock: dict, names: tuple[str, ...]) -> list[dict]:
    """這些套件加上它們需要的所有套件（照官方清單的相依關係）"""
    packages = lock["packages"]
    norm = lambda n: n.lower().replace("_", "-")
    by_name = {norm(k): v for k, v in packages.items()}
    seen: dict[str, dict] = {}

    def walk(name: str) -> None:
        key = norm(name)
        if key in seen:
            return
        if key not in by_name:
            raise SystemExit(f"官方清單裡沒有套件 {name}")
        seen[key] = by_name[key]
        for dep in by_name[key].get("depends", []):
            walk(dep)

    for name in names:
        walk(name)
    return list(seen.values())


def ensure(dest: Path, url: str, expected: str | None, check_only: bool) -> tuple[str, str]:
    """確保這個檔案在、而且雜湊正確。回（狀態, 雜湊）"""
    if dest.is_file() and (expected is None or sha256(dest) == expected):
        return "ok", sha256(dest)
    if check_only:
        return ("missing" if not dest.is_file() else "bad"), ""
    download(url, dest)
    actual = sha256(dest)
    if expected is not None and actual != expected:
        dest.unlink(missing_ok=True)
        raise SystemExit(f"{dest.name} 的雜湊不對（應該是 {expected[:16]}…，拿到 {actual[:16]}…），已刪除")
    return "downloaded", actual


def main() -> int:
    parser = argparse.ArgumentParser(description="下載瀏覽器版 Python（Pyodide）")
    parser.add_argument("--check", action="store_true", help="只檢查，不下載")
    args = parser.parse_args()
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    OUT.mkdir(parents=True, exist_ok=True)
    manifest_path = OUT / MANIFEST
    recorded = json.loads(manifest_path.read_text(encoding="utf-8")).get("files", {}) if manifest_path.is_file() else {}

    files: dict[str, str] = {}
    problems: list[str] = []

    def take(name: str, url: str, expected: str | None) -> None:
        # 官方清單沒有記雜湊的檔案（本體）：用上次下載時記下來的
        state, digest = ensure(OUT / name, url, expected or (recorded.get(name) if args.check else None), args.check)
        if state in ("missing", "bad"):
            problems.append(f"{name}（{'不見了' if state == 'missing' else '內容被改過'}）")
        else:
            files[name] = digest
            if state == "downloaded":
                log(f"  已下載 {name}（{(OUT / name).stat().st_size / 1e6:.2f} MB）")

    for name in CORE:
        take(name, BASE_URL + name, None)
    if problems:
        log("缺少本體檔案：" + "、".join(problems))
        return 1
    lock = json.loads((OUT / "pyodide-lock.json").read_text(encoding="utf-8"))
    for package in closure(lock, PACKAGES):
        take(package["file_name"], BASE_URL + package["file_name"], package["sha256"])
    for name, url, digest in PYPI_WHEELS:
        take(name, url, digest)

    if problems:
        log("有問題的檔案：" + "、".join(problems))
        return 1
    if not args.check:
        manifest_path.write_text(json.dumps({
            "pyodide": VERSION,
            "extra_wheels": [name for name, _url, _digest in PYPI_WHEELS],
            "files": files,
        }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    total = sum((OUT / name).stat().st_size for name in files)
    log(f"{'檢查通過' if args.check else '完成'}：{len(files)} 個檔案，共 {total / 1e6:.1f} MB，在 {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
