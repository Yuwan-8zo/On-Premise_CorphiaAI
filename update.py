"""
Corphia AI 一鍵更新（伺服器端）

讓已經裝好的系統升級到新版本，不用重新安裝：
  1. 問公司發布更新的地方（GitHub Releases）目前最新版本是什麼
  2. 比對本機的 VERSION 檔；一樣就說「已經是最新」，不同才繼續（會先列出版本說明，問一次要不要更新）
  3. 下載這個版本的更新包（.zip）＋ 核對 SHA-256（確保下載完整、沒被竄改、不是被偷換的檔案）
  4. 備份目前的程式碼到 backups/update-<時間戳>-from-v<舊版本>.zip（更新失敗可以復原，不會留下半新半舊的狀態）
  5. 關閉正在跑的服務（呼叫 stop.py，和按「一鍵關閉」一樣）
  6. 用更新包「有的檔案」覆蓋對應路徑——只動程式碼和設定範例，不會動使用者資料：
     更新包裡沒有的東西（.env、uploads/、generated/、ai_model/、.venv、node_modules、.runtime/ 等）完全不會被碰
  7. requirements.txt／package.json 內容有變才重新安裝套件（沒變就跳過，省時間）
  8. 啟動新版本（呼叫 start.py）；啟動時 app/core/migrations.py 會自動把資料庫結構補齊，不用額外步驟
  9. 等健康檢查通過才算成功；逾時或失敗就自動從備份復原回舊版本，說清楚發生了什麼事

只用標準函式庫（urllib、zipfile、hashlib、subprocess），刻意不依賴任何要額外 pip install 的套件——
這是系統「還沒更新前」就要能動的工具，不能依賴更新本身才會裝好的東西。

用法：
    python update.py          # 檢查、確認、更新
    python update.py --check  # 只檢查有沒有新版本，不做任何改動
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
import zipfile
from pathlib import Path
from urllib.request import Request, urlopen

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

BASE_DIR = Path(__file__).resolve().parent
BACKUPS_DIR = BASE_DIR / "backups"
BACKEND_DIR = BASE_DIR / "backend"
FRONTEND_DIR = BASE_DIR / "frontend"
VERSION_FILE = BASE_DIR / "VERSION"
BACKEND_HEALTH_URL = "http://127.0.0.1:8168/api/v1/health"

# 公司發布更新的地方：這個專案自己的 GitHub repo（公開，不用帳密）。
# 之後如果改成公司自己的網域發布，只要改這個常數＋ fetch_latest_release()，其他都不用動。
UPDATE_REPO = "Yuwan-8zo/On-Premise_CorphiaAI"
GITHUB_API = f"https://api.github.com/repos/{UPDATE_REPO}/releases/latest"

# 新版本啟動後，等健康檢查通過的最長時間（秒）；逾時就當成啟動失敗，自動復原
HEALTH_TIMEOUT_SEC = 180


def info(message: str = "") -> None:
    print(message, flush=True)


def ok(message: str) -> None:
    info(f"[OK] {message}")


def warn(message: str) -> None:
    info(f"[警告] {message}")


def fail(message: str) -> None:
    info(f"[錯誤] {message}")


def current_version() -> str:
    try:
        return VERSION_FILE.read_text(encoding="utf-8").strip() or "0.0.0"
    except OSError:
        return "0.0.0"


def parse_version(v: str) -> tuple[int, ...]:
    """"v2.4.0" / "2.4.0" → (2, 4, 0)；格式不對就當成 (0,)，不會讓程式整個爆掉"""
    v = v.strip().lstrip("vV")
    try:
        return tuple(int(part) for part in v.split("."))
    except ValueError:
        return (0,)


def fetch_latest_release() -> dict:
    """問 GitHub 這個 repo 最新的 release 是什麼；回傳 GitHub API 的原始 JSON（tag_name／body／assets…）"""
    req = Request(GITHUB_API, headers={"Accept": "application/vnd.github+json", "User-Agent": "CorphiaAI-Updater"})
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


def backup_current(old_version: str) -> Path:
    """把「更新包可能會覆蓋到」的東西先備份成一個 zip，更新失敗時用 restore_backup() 復原"""
    BACKUPS_DIR.mkdir(exist_ok=True)
    dest = BACKUPS_DIR / f"update-{time.strftime('%Y%m%d-%H%M%S')}-from-v{old_version}.zip"
    # 和 scripts/build_release.py 的 INCLUDE_PATHS 對應：備份「有可能被更新包覆蓋」的路徑就夠，
    # 使用者資料（.env、uploads、ai_model、generated、.venv、node_modules）本來就不在這個清單裡，不用備份
    candidates = [
        "VERSION", "docker-compose.yml", "start.py", "stop.py", "update.py",
        "一鍵啟動.bat", "一鍵關閉.bat", "一鍵更新.bat",
        "backend/app", "backend/requirements.txt",
        "frontend/src", "frontend/package.json", "frontend/package-lock.json",
        "frontend/index.html", "frontend/vite.config.ts", "frontend/vite-plugins",
        "frontend/tsconfig.json", "frontend/tsconfig.node.json",
        "searxng/settings.yml", "searxng/limiter.toml", "searxng/Dockerfile",
    ]
    with zipfile.ZipFile(dest, "w", zipfile.ZIP_DEFLATED) as zf:
        for rel in candidates:
            path = BASE_DIR / rel
            if not path.exists():
                continue
            if path.is_file():
                zf.write(path, rel)
            else:
                for file in path.rglob("*"):
                    if file.is_file() and "__pycache__" not in file.parts:
                        zf.write(file, Path(rel) / file.relative_to(path))
    ok(f"已備份目前版本到 {dest.relative_to(BASE_DIR)}")
    return dest


def restore_backup(backup_zip: Path) -> None:
    warn(f"從備份復原：{backup_zip.name}")
    with zipfile.ZipFile(backup_zip) as zf:
        zf.extractall(BASE_DIR)
    ok("已復原到更新前的版本")


def apply_package(staging_dir: Path) -> list[str]:
    """把更新包解壓後的內容，依它「實際有的」最上層路徑，覆蓋到對應的專案路徑。
    回傳有被覆蓋的相對路徑清單（備份、記錄時都看得到動了什麼）。"""
    applied: list[str] = []
    for entry in sorted(staging_dir.iterdir()):
        dest = BASE_DIR / entry.name
        if entry.is_dir():
            if dest.exists():
                shutil.rmtree(dest)
            shutil.copytree(entry, dest)
        else:
            shutil.copy2(entry, dest)
        applied.append(entry.name)
    return applied


def file_hash_or_none(path: Path) -> str | None:
    return sha256_of(path) if path.is_file() else None


def reinstall_deps_if_changed(old_requirements_hash: str | None, old_package_json_hash: str | None) -> None:
    requirements = BACKEND_DIR / "requirements.txt"
    if file_hash_or_none(requirements) != old_requirements_hash:
        info("requirements.txt 有變更，重新安裝後端套件…")
        pip = BACKEND_DIR / ".venv" / "Scripts" / "pip.exe"
        exe = str(pip) if pip.exists() else f"{sys.executable} -m pip"
        result = subprocess.run([*exe.split(), "install", "-r", str(requirements)], cwd=str(BACKEND_DIR))
        (ok if result.returncode == 0 else warn)("後端套件安裝" + ("完成" if result.returncode == 0 else "失敗，請自行檢查"))

    package_json = FRONTEND_DIR / "package.json"
    if file_hash_or_none(package_json) != old_package_json_hash:
        info("package.json 有變更，重新安裝前端套件…")
        npm = shutil.which("npm") or shutil.which("npm.cmd")
        if npm:
            result = subprocess.run([npm, "install"], cwd=str(FRONTEND_DIR))
            (ok if result.returncode == 0 else warn)("前端套件安裝" + ("完成" if result.returncode == 0 else "失敗，請自行檢查"))
        else:
            warn("找不到 npm，請自行在 frontend/ 執行 npm install")


def stop_if_running() -> None:
    info("關閉目前正在跑的服務（如果有）…")
    subprocess.run([sys.executable, str(BASE_DIR / "stop.py")], cwd=str(BASE_DIR))


def start_and_wait_healthy(timeout_sec: int = HEALTH_TIMEOUT_SEC) -> bool:
    info("啟動新版本…")
    subprocess.Popen([sys.executable, str(BASE_DIR / "start.py")], cwd=str(BASE_DIR))
    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(BACKEND_HEALTH_URL, timeout=3) as resp:
                if resp.status == 200 and json.loads(resp.read()).get("status") == "ok":
                    return True
        except (urllib.error.URLError, OSError, ValueError):
            pass
        time.sleep(3)
    return False


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="只檢查有沒有新版本，不做任何改動")
    args = parser.parse_args()

    info("=" * 56)
    info(" Corphia AI 一鍵更新")
    info("=" * 56)

    old_version = current_version()
    info(f"目前版本：{old_version}")

    try:
        release = fetch_latest_release()
    except urllib.error.HTTPError as e:
        if e.code == 404:
            ok("還沒有發布任何版本，目前已經是最新。")
            return 0
        fail(f"查詢更新伺服器失敗（HTTP {e.code}）：{e}")
        return 1
    except (urllib.error.URLError, OSError, ValueError) as e:
        fail(f"連不到更新伺服器，請確認這台機器能連到網際網路：{e}")
        return 1

    latest_version = release.get("tag_name", "").lstrip("vV")
    info(f"最新版本：{latest_version or '（查不到）'}")

    if not latest_version or parse_version(latest_version) <= parse_version(old_version):
        ok("已經是最新版本，不需要更新。")
        return 0

    if args.check:
        info(f"\n有新版本可更新：{old_version} → {latest_version}")
        if release.get("body"):
            info("\n版本說明：\n" + release["body"])
        return 0

    info(f"\n版本說明：\n{release.get('body', '（無）')}\n")
    answer = input(f"要把系統從 {old_version} 更新到 {latest_version} 嗎？這會先備份目前版本。[y/N]: ").strip().lower()
    if answer != "y":
        info("已取消，沒有做任何改動。")
        return 0

    assets = release.get("assets", [])
    zip_asset = find_asset(assets, ".zip")
    checksum_asset = find_asset(assets, ".zip.sha256")
    if not zip_asset or not checksum_asset:
        fail("這個版本的發布檔不完整（找不到 .zip 或 .zip.sha256），已經不會更新。")
        return 1

    import tempfile
    with tempfile.TemporaryDirectory(prefix="corphia-update-") as tmp:
        tmp_dir = Path(tmp)
        zip_path = tmp_dir / zip_asset["name"]
        checksum_path = tmp_dir / checksum_asset["name"]
        try:
            download(zip_asset["browser_download_url"], zip_path)
            download(checksum_asset["browser_download_url"], checksum_path)
        except (urllib.error.URLError, OSError) as e:
            fail(f"下載失敗：{e}")
            return 1

        if not verify_checksum(zip_path, checksum_path):
            return 1

        old_requirements_hash = file_hash_or_none(BACKEND_DIR / "requirements.txt")
        old_package_json_hash = file_hash_or_none(FRONTEND_DIR / "package.json")

        backup_zip = backup_current(old_version)
        stop_if_running()

        staging_dir = tmp_dir / "staging"
        with zipfile.ZipFile(zip_path) as zf:
            zf.extractall(staging_dir)
        applied = apply_package(staging_dir)
        ok(f"已套用更新包，覆蓋了：{', '.join(applied)}")

        reinstall_deps_if_changed(old_requirements_hash, old_package_json_hash)

    if start_and_wait_healthy():
        ok(f"更新完成！目前版本：{current_version()}，系統已經在跑了。")
        return 0

    fail("新版本啟動後健康檢查沒有通過，自動復原到更新前的版本…")
    stop_if_running()
    restore_backup(backup_zip)
    if start_and_wait_healthy():
        warn(f"已復原並重新啟動舊版本（{current_version()}）。請檢查更新包，稍後再試。")
    else:
        fail("復原後系統仍然沒有正常啟動，請手動檢查（備份在 " + str(backup_zip) + "）。")
    return 1


if __name__ == "__main__":
    sys.exit(main())
