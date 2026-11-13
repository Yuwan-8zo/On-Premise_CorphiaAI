"""
裝一份「不靠 Docker」的原生 PostgreSQL（給伺服器安裝包用，只要做一次）。

做了什麼：
  1. 下載官方 PostgreSQL Windows x64 binaries（來源：postgresql.org 官方指向的 EnterpriseDB 發布點，
     不是任何第三方編譯版）解壓到 db/postgresql/
  2. initdb 建一份全新的資料目錄 db/pgdata/，使用者／密碼跟 .env.example、docker-compose.yml
     的預設一致（corphia / corphia123），這樣既有的 DATABASE_URL 設定完全不用改
  3. 把連接埠改成 5433（跟 Docker 版本一樣），只聽 127.0.0.1（不對外開放）
  4. 啟動，建立 corphia_ai 資料庫

做完之後：
  - start.py／stop.py 偵測到 db/postgresql 存在，之後都會用 pg_ctl 管理這份原生資料庫，
    不會再去找 Docker（但如果這份原生安裝不存在，仍然會照舊用 Docker，不影響目前的使用方式）
  - pgvector 這個擴充套件官方沒有 Windows 預編譯檔，**不是**這個腳本裝的；裝好這個之後
    還要跑一次 scripts/setup_pgvector.py（用 Visual Studio 把它編譯出來），兩個都做完
    資料庫才完整可用（沒裝 pgvector 之前，後端會在「CREATE EXTENSION vector」那一步失敗）

用法：
    python scripts/setup_postgres.py                    # 用預設版本（見 DEFAULT_PG_VERSION）
    python scripts/setup_postgres.py --pg-version 16.9-1 # 官方頁面上找到的其他版本號
"""

from __future__ import annotations

import argparse
import subprocess
import sys
import tempfile
import time
from pathlib import Path

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).resolve().parent))
from net_utils import download, fail, info, ok, warn  # noqa: E402

BASE_DIR = Path(__file__).resolve().parents[1]
DB_DIR = BASE_DIR / "db"
PG_INSTALL_DIR = DB_DIR / "postgresql"
PGDATA_DIR = DB_DIR / "pgdata"

# 跟 docker-compose.yml／backend/.env.example 的預設值一致，這樣 DATABASE_URL 完全不用改
PG_USER = "corphia"
# 開發用的預設密碼（和 docker-compose.yml 一樣）。安裝包不用這個：「第一次設定」會產生一組隨機密碼
PG_PASSWORD = "corphia123"
PG_DB = "corphia_ai"
PG_PORT = 5433

# 在 https://www.postgresql.org/download/windows/ 的「zip archive」連結裡能找到目前的版本號；
# 這一版是寫這個腳本時確認可下載的版本，之後 EDB 可能下架舊版，執行失敗時請到上面那頁查新的版本號，
# 用 --pg-version 帶進來即可，不用改這個檔案。
DEFAULT_PG_VERSION = "16.6-1"
EDB_URL_TEMPLATE = "https://get.enterprisedb.com/postgresql/postgresql-{version}-windows-x64-binaries.zip"


def pg_bin_dir() -> Path | None:
    """原生安裝的 bin/ 目錄；EDB 的 zip 解開後多一層 pgsql/，這裡自動處理掉那層，找不到就回 None"""
    for candidate in (PG_INSTALL_DIR / "bin", PG_INSTALL_DIR / "pgsql" / "bin"):
        if (candidate / "pg_ctl.exe").is_file():
            return candidate
    return None


def native_postgres_ready() -> bool:
    """原生安裝已經裝好「且」已經 initdb 過，start.py／stop.py 用這個判斷走原生還是 Docker"""
    return pg_bin_dir() is not None and (PGDATA_DIR / "PG_VERSION").is_file()


def _run(cmd: list[str], **kwargs) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", **kwargs)


def extract_postgres(version: str) -> Path:
    if pg_bin_dir():
        ok(f"已經有原生 PostgreSQL 安裝在 {PG_INSTALL_DIR}，跳過下載。")
        return pg_bin_dir()

    DB_DIR.mkdir(exist_ok=True)
    url = EDB_URL_TEMPLATE.format(version=version)
    with tempfile.TemporaryDirectory(prefix="corphia-pg-") as tmp:
        zip_path = Path(tmp) / "postgresql-binaries.zip"
        try:
            download(url, zip_path)
        except Exception as e:
            fail(
                f"下載失敗：{e}\n"
                f"請到 https://www.postgresql.org/download/windows/ 確認目前的版本號，"
                f"用 --pg-version 帶正確的版本重新執行（這版用的是 {version}）。"
            )
            raise SystemExit(1)

        info("解壓縮中…")
        import zipfile
        with zipfile.ZipFile(zip_path) as zf:
            # 官方安裝包裡捆了整套 pgAdmin 4（GUI 管理工具，這個腳本完全不需要），
            # 裡面又帶一份完整的 Python + Azure SDK，巢狀路徑常常超過 Windows 260
            # 字元路徑長度上限（多數機器預設沒開長路徑支援），解到一半就會整個失敗。
            # 跳過這個子資料夾：不影響伺服器端功能，也順便省下大量空間與時間。
            members = [m for m in zf.infolist() if "pgAdmin 4" not in m.filename]
            zf.extractall(PG_INSTALL_DIR, members=members)

    bin_dir = pg_bin_dir()
    if not bin_dir:
        fail(f"解壓完成，但在 {PG_INSTALL_DIR} 找不到 bin/pg_ctl.exe，下載的檔案可能不是預期的格式。")
        raise SystemExit(1)
    ok(f"PostgreSQL {version} 已安裝到 {PG_INSTALL_DIR}")
    return bin_dir


def run_initdb(bin_dir: Path, password: str = PG_PASSWORD) -> None:
    if (PGDATA_DIR / "PG_VERSION").is_file():
        ok(f"{PGDATA_DIR} 已經初始化過，跳過 initdb。")
        return

    DB_DIR.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="corphia-pg-init-") as tmp:
        pwfile = Path(tmp) / "pwfile"
        pwfile.write_text(password, encoding="utf-8")
        info("初始化資料目錄（initdb）…")
        result = _run([
            str(bin_dir / "initdb.exe"),
            "-D", str(PGDATA_DIR),
            "-U", PG_USER,
            "--pwfile", str(pwfile),
            "--auth=scram-sha-256",
            "--encoding=UTF8",
            "--locale=C",
        ])
    if result.returncode != 0:
        fail(f"initdb 失敗：\n{result.stdout}\n{result.stderr}")
        raise SystemExit(1)
    ok(f"資料目錄初始化完成：{PGDATA_DIR}")

    # 只聽本機、固定連接埠（跟 Docker 版本一樣是 5433），不對外開放
    conf = PGDATA_DIR / "postgresql.conf"
    text = conf.read_text(encoding="utf-8")
    # 時區固定 UTC（和 Docker 版一樣）：程式存的是「不帶時區」的時間，資料庫若跟著 Windows 用本地時區，
    # SQL 的 now() 會比程式自己算的 UTC 時間多 8 小時，稽核紀錄的順序、時間比較都會錯
    text += f"\nlisten_addresses = '127.0.0.1'\nport = {PG_PORT}\ntimezone = 'UTC'\n"
    conf.write_text(text, encoding="utf-8")
    ok(f"已設定只聽 127.0.0.1:{PG_PORT}、時區 UTC")


def start_and_wait(bin_dir: Path, timeout_sec: int = 60) -> bool:
    log_path = DB_DIR / "postgres.log"
    # 不能用 _run()（capture_output=True）：Windows 上 pg_ctl start 這個背景服務的子程序
    # 會繼承到 pg_ctl 的 stdout/stderr 管線控制碼，就算 pg_ctl 自己已經結束，Python 這端的
    # subprocess.run() 仍會一直等管線的另一端關閉而永久卡死（伺服器其實已經正常啟動了，
    # 只是 Python 看起來像凍住）。pg_ctl 自己的輸出本來就不重要——真正的伺服器 log 已經靠
    # -l 寫到 log_path 了——所以這裡直接丟掉 stdout/stderr，不開管線。
    result = subprocess.run(
        [str(bin_dir / "pg_ctl.exe"), "-D", str(PGDATA_DIR), "-l", str(log_path), "-w", "start"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    if result.returncode != 0:
        fail(f"啟動失敗，詳見 log：{log_path}")
        return False
    import socket
    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        try:
            with socket.create_connection(("127.0.0.1", PG_PORT), timeout=2):
                return True
        except OSError:
            time.sleep(1)
    return False


def create_database(bin_dir: Path, password: str = PG_PASSWORD) -> None:
    env = {"PGPASSWORD": password}
    import os
    full_env = {**os.environ, **env}
    check = subprocess.run(
        [str(bin_dir / "psql.exe"), "-U", PG_USER, "-h", "127.0.0.1", "-p", str(PG_PORT),
         "-tAc", f"SELECT 1 FROM pg_database WHERE datname='{PG_DB}'"],
        capture_output=True, text=True, encoding="utf-8", errors="replace", env=full_env,
    )
    if check.stdout.strip() == "1":
        ok(f"資料庫 {PG_DB} 已經存在，跳過建立。")
        return
    result = subprocess.run(
        [str(bin_dir / "createdb.exe"), "-U", PG_USER, "-h", "127.0.0.1", "-p", str(PG_PORT), PG_DB],
        capture_output=True, text=True, encoding="utf-8", errors="replace", env=full_env,
    )
    if result.returncode != 0:
        # 上面那個「有沒有這個資料庫」的檢查偶爾問不出來（psql 在某些環境不輸出）：
        # 資料庫自己說「已經存在」就是已經建好了，不算失敗（重跑設定時會遇到）
        if "already exists" in (result.stderr or ""):
            ok(f"資料庫 {PG_DB} 已經存在，跳過建立。")
            return
        fail(f"建立資料庫失敗：\n{result.stdout}\n{result.stderr}")
        raise SystemExit(1)
    ok(f"已建立資料庫 {PG_DB}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pg-version", default=DEFAULT_PG_VERSION)
    args = parser.parse_args()

    info("=" * 56)
    info(" Corphia AI 原生 PostgreSQL 安裝（不靠 Docker）")
    info("=" * 56)

    bin_dir = extract_postgres(args.pg_version)
    run_initdb(bin_dir)

    info("啟動資料庫…")
    if not start_and_wait(bin_dir):
        fail("資料庫啟動後逾時仍連不上，請檢查 db/postgres.log")
        return 1
    ok(f"資料庫已啟動（127.0.0.1:{PG_PORT}）")

    create_database(bin_dir)

    info("")
    ok("原生 PostgreSQL 安裝完成！之後 start.py／stop.py 會自動改用這份資料庫，不再需要 Docker。")
    warn(
        "pgvector 這個擴充套件還沒裝：官方沒有 Windows 預編譯檔，"
        "請接著跑 python scripts/setup_pgvector.py（需要先裝好 Visual Studio Build Tools 和 Git）。"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
