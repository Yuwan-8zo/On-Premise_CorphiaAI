"""
備份與還原：資料庫＋使用者上傳的文件＋AI 產出的檔案

什麼時候用：
  - 更新系統之前（更新會自動升級資料庫，先留一份可以退回去的）
  - 平常定期備份

用法（在專案根目錄）：
    backend\\.venv\\Scripts\\python.exe backend\\scripts\\backup.py create            做一份備份（放在 backups\\corphia-日期-時間\\）
    backend\\.venv\\Scripts\\python.exe backend\\scripts\\backup.py list              列出現有的備份
    backend\\.venv\\Scripts\\python.exe backend\\scripts\\backup.py check  備份資料夾   還原演練：還原到一個暫時的資料庫，核對每張表的筆數後刪掉；不動正式資料
    backend\\.venv\\Scripts\\python.exe backend\\scripts\\backup.py restore 備份資料夾 --yes
                                                                                    真的還原（會蓋掉現在的資料；系統要先關閉）

一份備份裡有：
    database.dump   資料庫（PostgreSQL 的壓縮格式，含向量資料）
    uploads.zip     使用者上傳的文件
    generated.zip   AI 產出的檔案
    manifest.json   備份時間、程式版本、每張表的筆數、各檔案的大小與 SHA-256（還原前用來核對備份沒有壞掉）

安全：
  - 備份裡有公司的全部資料，資料夾請放在只有管理員讀得到的地方；backups\\ 不進版本庫
  - restore 之前會先確認系統已經關閉，並把現在的資料庫另存一份「還原前」的備份，還原失敗可以再退回去
  - 資料庫密碼不會出現在指令列或畫面上（在資料庫容器裡面用本機連線，不需要密碼）

目前只支援資料庫在 Docker 裡（容器名稱 corphia-postgres，可用環境變數 POSTGRES_CONTAINER 改）。
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import socket
import subprocess
import sys
import time
import zipfile
from pathlib import Path
from urllib.parse import urlsplit

BACKEND = Path(__file__).resolve().parents[1]
ROOT = BACKEND.parent
sys.path.insert(0, str(BACKEND))
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from app.core.config import settings  # noqa: E402

CONTAINER = os.environ.get("POSTGRES_CONTAINER", "corphia-postgres")
BACKUP_ROOT = ROOT / "backups"
PREFIX = "corphia-"
KEEP_DEFAULT = 10
CHECK_DATABASE = "corphia_restore_check"
BACKEND_PORT = 8168
HASH_BLOCK = 1 << 20
NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)


class BackupError(Exception):
    """給管理員看的錯誤"""


# ── 設定 ──────────────────────────────────────────────────────────────────
def db_identity() -> tuple[str, str]:
    """（資料庫使用者, 資料庫名稱）——從系統設定的連線字串取，不取密碼"""
    parts = urlsplit(settings.database_url.replace("+asyncpg", ""))
    return parts.username or "corphia", (parts.path or "/corphia_ai").lstrip("/")


def data_dirs() -> dict[str, Path]:
    """要一起備份的檔案資料夾：名稱 → 位置"""
    def resolve(value: str) -> Path:
        p = Path(value)
        return p if p.is_absolute() else (BACKEND / p).resolve()

    return {"uploads": resolve(settings.upload_directory), "generated": resolve(settings.generated_files_dir)}


# ── 小工具 ────────────────────────────────────────────────────────────────
def docker(*args: str, stdin=None, stdout=subprocess.PIPE) -> subprocess.CompletedProcess:
    try:
        return subprocess.run(["docker", "exec", *(["-i"] if stdin is not None else []), CONTAINER, *args],
                              stdin=stdin, stdout=stdout, stderr=subprocess.PIPE, creationflags=NO_WINDOW)
    except FileNotFoundError:
        raise BackupError("找不到 Docker。目前的備份功能需要資料庫跑在 Docker 裡") from None


def psql(database: str, sql: str) -> str:
    user, _ = db_identity()
    r = docker("psql", "-U", user, "-d", database, "-At", "-v", "ON_ERROR_STOP=1", "-c", sql)
    if r.returncode != 0:
        raise BackupError(f"資料庫指令失敗：{r.stderr.decode('utf-8', 'replace').strip()[:300]}")
    return r.stdout.decode("utf-8", "replace").strip()


def ensure_database_up() -> None:
    r = docker("pg_isready", "-q")
    if r.returncode != 0:
        raise BackupError(f"資料庫沒有在執行（容器 {CONTAINER}）。請先啟動資料庫再試一次")


def table_counts(database: str) -> dict[str, int]:
    """每張表的確實筆數（還原後用來核對）"""
    tables = [t for t in psql(database, "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1").splitlines() if t]
    if not tables:
        return {}
    union = " UNION ALL ".join(f"SELECT '{t}', count(*) FROM \"{t}\"" for t in tables)
    return {name: int(n) for name, n in (line.split("|") for line in psql(database, union).splitlines())}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(HASH_BLOCK), b""):
            h.update(block)
    return h.hexdigest()


def git_commit() -> str:
    try:
        r = subprocess.run(["git", "-C", str(ROOT), "rev-parse", "--short", "HEAD"], capture_output=True, text=True, creationflags=NO_WINDOW)
        return r.stdout.strip() if r.returncode == 0 else ""
    except OSError:
        return ""


def backend_running() -> bool:
    with socket.socket() as s:
        s.settimeout(0.5)
        return s.connect_ex(("127.0.0.1", BACKEND_PORT)) == 0


def human(size: int) -> str:
    return f"{size / 1024 / 1024:.1f} MB" if size >= 1024 * 1024 else f"{size / 1024:.0f} KB"


def zip_dir(src: Path, dest: Path) -> int:
    """把資料夾壓成 zip（資料夾不存在就做一個空的）；回傳檔案數"""
    count = 0
    with zipfile.ZipFile(dest, "w", zipfile.ZIP_DEFLATED) as z:
        if src.is_dir():
            for path in sorted(src.rglob("*")):
                if path.is_file():
                    z.write(path, path.relative_to(src).as_posix())
                    count += 1
    return count


def all_backups() -> list[Path]:
    if not BACKUP_ROOT.is_dir():
        return []
    return sorted(p for p in BACKUP_ROOT.iterdir() if p.is_dir() and p.name.startswith(PREFIX) and (p / "manifest.json").is_file())


def load_manifest(folder: Path) -> dict:
    try:
        return json.loads((folder / "manifest.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        raise BackupError(f"這個資料夾不是完整的備份（讀不到 manifest.json）：{folder}") from None


def verify_files(folder: Path, manifest: dict) -> None:
    """備份裡的檔案和當初記下來的一樣（沒有缺、沒有壞）"""
    for name, info in manifest["files"].items():
        path = folder / name
        if not path.is_file():
            raise BackupError(f"備份不完整，少了 {name}")
        if path.stat().st_size != info["size"] or sha256(path) != info["sha256"]:
            raise BackupError(f"備份裡的 {name} 和備份當時不一樣（檔案可能損壞）")


# ── 做一份備份 ────────────────────────────────────────────────────────────
def create(label: str = "", keep: int = KEEP_DEFAULT) -> Path:
    ensure_database_up()
    user, database = db_identity()
    name = PREFIX + time.strftime("%Y%m%d-%H%M%S") + (f"-{label}" if label else "")
    folder = BACKUP_ROOT / name
    working = BACKUP_ROOT / (name + ".partial")  # 做完才改成正式名稱：中途失敗不會留下看起來完整的備份
    working.mkdir(parents=True, exist_ok=False)
    try:
        # 系統可能還在使用中：備份前、後各數一次筆數，還原後的筆數落在兩者之間就算對
        counts_before = table_counts(database)
        dump = working / "database.dump"
        with dump.open("wb") as f:
            r = docker("pg_dump", "-U", user, "-d", database, "-Fc", stdout=f)
        if r.returncode != 0 or dump.stat().st_size == 0:
            raise BackupError(f"資料庫備份失敗：{r.stderr.decode('utf-8', 'replace').strip()[:300]}")
        counts = table_counts(database)
        file_counts = {key: zip_dir(src, working / f"{key}.zip") for key, src in data_dirs().items()}
        files = {p.name: {"size": p.stat().st_size, "sha256": sha256(p)} for p in sorted(working.iterdir())}
        manifest = {
            "created_at": time.strftime("%Y-%m-%d %H:%M:%S"), "commit": git_commit(), "database": database,
            "tables": counts_before, "tables_after": counts, "rows": sum(counts_before.values()),
            "file_counts": file_counts, "files": files,
        }
        (working / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        working.rename(folder)
    except BaseException:
        shutil.rmtree(working, ignore_errors=True)
        raise
    # 只留最近幾份（「還原前」自動做的那種也算在內）
    for old in all_backups()[:-keep] if keep > 0 else []:
        shutil.rmtree(old, ignore_errors=True)
    return folder


# ── 還原 ──────────────────────────────────────────────────────────────────
def restore_database(folder: Path, target: str) -> dict[str, int]:
    """把備份的資料庫還原到 target（先刪掉重建）；回傳還原後每張表的筆數"""
    user, _ = db_identity()
    psql("postgres", f'DROP DATABASE IF EXISTS "{target}" WITH (FORCE)')
    psql("postgres", f'CREATE DATABASE "{target}"')
    with (folder / "database.dump").open("rb") as f:
        r = docker("pg_restore", "-U", user, "-d", target, "--no-owner", "--exit-on-error", stdin=f)
    if r.returncode != 0:
        raise BackupError(f"資料庫還原失敗：{r.stderr.decode('utf-8', 'replace').strip()[:300]}")
    return table_counts(target)


def compare(manifest: dict, actual: dict[str, int]) -> list[str]:
    """筆數對不上的表（對得上回空的）；備份當下有人在用時，筆數落在「備份前～備份後」之間都算對"""
    before, after = manifest["tables"], manifest.get("tables_after") or manifest["tables"]
    problems = []
    for t in sorted(set(before) | set(after) | set(actual)):
        if t not in actual or t not in before or t not in after:
            problems.append(f"{t}：備份時{'有' if t in before else '沒有'}這張表、還原後{'有' if t in actual else '沒有'}")
        elif not min(before[t], after[t]) <= actual[t] <= max(before[t], after[t]):
            problems.append(f"{t}：備份時 {before[t]}～{after[t]} 筆、還原後 {actual[t]} 筆")
    return problems


def check(folder: Path) -> dict:
    """還原演練：還原到暫時的資料庫、核對筆數、檢查檔案壓縮檔讀得出來，然後刪掉暫時的資料庫"""
    ensure_database_up()
    manifest = load_manifest(folder)
    verify_files(folder, manifest)
    try:
        actual = restore_database(folder, CHECK_DATABASE)
    finally:
        psql("postgres", f'DROP DATABASE IF EXISTS "{CHECK_DATABASE}" WITH (FORCE)')
    diff = compare(manifest, actual)
    if diff:
        raise BackupError("還原後的筆數和備份時不一樣：" + "；".join(diff[:5]))
    for key, expected in manifest["file_counts"].items():
        with zipfile.ZipFile(folder / f"{key}.zip") as z:
            bad = z.testzip()
            if bad or len(z.namelist()) != expected:
                raise BackupError(f"{key}.zip 讀不完整")
    return {"tables": len(actual), "rows": sum(actual.values()), "files": sum(manifest["file_counts"].values())}


def restore(folder: Path, database: str | None = None, files_to: Path | None = None) -> dict:
    """
    真的還原。database／files_to 不給＝還原到正式的位置（系統要先關閉，並先自動做一份「還原前」的備份）；
    有給＝還原到指定的資料庫與資料夾（測試用，不碰正式資料）。
    """
    ensure_database_up()
    manifest = load_manifest(folder)
    verify_files(folder, manifest)
    live = database is None and files_to is None
    if live:
        if backend_running():
            raise BackupError("系統還在執行。請先關閉系統（一鍵關閉）再還原")
        before = create(label="before-restore", keep=0)
        print(f"已先把現在的資料另存一份：{before.name}")
    target = database or db_identity()[1]
    actual = restore_database(folder, target)
    diff = compare(manifest, actual)
    if diff:
        raise BackupError("還原後的筆數和備份時不一樣：" + "；".join(diff[:5]))
    restored_files = 0
    for key, dest in data_dirs().items():
        dest = (files_to / key) if files_to else dest
        aside = dest.with_name(dest.name + ".before-restore")
        if dest.exists():  # 現在的檔案先移到旁邊，全部還原成功才刪
            shutil.rmtree(aside, ignore_errors=True)
            dest.rename(aside)
        dest.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(folder / f"{key}.zip") as z:
            for member in z.namelist():
                out = (dest / member).resolve()
                if dest.resolve() not in out.parents:  # 壓縮檔裡的路徑不可以跑出目的資料夾
                    raise BackupError(f"{key}.zip 裡有不正常的路徑：{member}")
            z.extractall(dest)
            restored_files += len(z.namelist())
        shutil.rmtree(aside, ignore_errors=True)
    return {"database": target, "tables": len(actual), "rows": sum(actual.values()), "files": restored_files}


# ── 指令 ──────────────────────────────────────────────────────────────────
def main() -> int:
    parser = argparse.ArgumentParser(description="Corphia AI 備份與還原")
    sub = parser.add_subparsers(dest="command", required=True)
    c = sub.add_parser("create", help="做一份備份")
    c.add_argument("--label", default="", help="加在資料夾名稱後面的說明（英數字）")
    c.add_argument("--keep", type=int, default=KEEP_DEFAULT, help=f"只留最近幾份（預設 {KEEP_DEFAULT}；0＝不刪舊的）")
    sub.add_parser("list", help="列出備份")
    k = sub.add_parser("check", help="還原演練（不動正式資料）")
    k.add_argument("folder", type=Path)
    r = sub.add_parser("restore", help="真的還原（會蓋掉現在的資料）")
    r.add_argument("folder", type=Path)
    r.add_argument("--yes", action="store_true", help="確認要蓋掉現在的資料")
    r.add_argument("--database", help="還原到指定的資料庫（測試用）")
    r.add_argument("--files-to", type=Path, help="檔案還原到指定的資料夾（測試用）")
    args = parser.parse_args()
    try:
        if args.command == "create":
            if args.label and not args.label.replace("-", "").replace("_", "").isalnum():
                raise BackupError("--label 只能用英數字、- 和 _")
            started = time.time()
            folder = create(args.label, args.keep)
            m = load_manifest(folder)
            size = sum(f["size"] for f in m["files"].values())
            print(f"備份完成：{folder}")
            print(f"  資料庫 {len(m['tables'])} 張表、{m['rows']} 筆；檔案 {sum(m['file_counts'].values())} 個；共 {human(size)}；花了 {time.time() - started:.1f} 秒")
        elif args.command == "list":
            rows = all_backups()
            if not rows:
                print("還沒有備份")
            for folder in rows:
                m = load_manifest(folder)
                size = sum(f["size"] for f in m["files"].values())
                print(f"{folder.name}  {m['created_at']}  {m['rows']} 筆  {human(size)}  版本 {m.get('commit') or '—'}")
        elif args.command == "check":
            result = check(args.folder)
            print(f"還原演練通過：{result['tables']} 張表、{result['rows']} 筆都對得上；檔案 {result['files']} 個讀得出來。正式資料沒有變動")
        else:
            if (args.database is None) != (args.files_to is None):
                raise BackupError("--database 和 --files-to 要一起給（測試用），或都不給（還原到正式的位置）")
            if args.database is None and not args.yes:
                raise BackupError("還原會蓋掉現在的資料。確定要做請加上 --yes")
            if args.database and args.database == db_identity()[1]:
                raise BackupError("--database 不能是正式的資料庫")
            result = restore(args.folder, args.database, args.files_to)
            print(f"還原完成：資料庫 {result['database']}（{result['tables']} 張表、{result['rows']} 筆）、檔案 {result['files']} 個")
    except BackupError as e:
        print(f"沒有完成：{e}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
