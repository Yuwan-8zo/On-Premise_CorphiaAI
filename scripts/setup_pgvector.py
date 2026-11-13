"""
編譯並安裝 pgvector（給 scripts/setup_postgres.py 裝好的原生 PostgreSQL 用）。

pgvector 官方沒有提供 Windows 預編譯檔，所以這裡不下載任何人編譯好的 .dll——
改成從 pgvector 官方 GitHub repo 抓原始碼，用這台機器自己裝的 Visual Studio 編譯，
編完直接 install 到原生 PostgreSQL 的 lib／share/extension 底下。這是 pgvector
官方文件說明的 Windows 編譯方式（nmake /F Makefile.win），不是走任何第三方捷徑。

需要先裝好（這個腳本只負責編譯，不會幫你裝這兩個）：
  - Visual Studio（隨便一個版本的 Build Tools 或完整版都可以，只要有「使用 C++ 的桌面開發」工作負載）
  - Git for Windows（git 指令要能在命令列用）

用法：
    python scripts/setup_pgvector.py                 # 編譯最新的 pgvector release
    python scripts/setup_pgvector.py --tag v0.8.0     # 指定版本
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).resolve().parent))
from net_utils import fail, fetch_latest_release, info, ok, warn  # noqa: E402
from setup_postgres import pg_bin_dir  # noqa: E402

PGVECTOR_REPO = "pgvector/pgvector"


def find_vcvarsall() -> Path | None:
    """找 Visual Studio 的 vcvarsall.bat；先問 vswhere（VS 安裝程式自己裝的），找不到再試常見路徑"""
    vswhere = Path(r"C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe")
    if vswhere.is_file():
        result = subprocess.run(
            [str(vswhere), "-latest", "-products", "*", "-requires",
             "Microsoft.VisualStudio.Component.VC.Tools.x86.x64", "-property", "installationPath"],
            capture_output=True, text=True, encoding="utf-8", errors="replace",
        )
        install_path = result.stdout.strip().splitlines()[0] if result.stdout.strip() else ""
        if install_path:
            candidate = Path(install_path) / "VC" / "Auxiliary" / "Build" / "vcvarsall.bat"
            if candidate.is_file():
                return candidate

    for root in (r"C:\Program Files\Microsoft Visual Studio", r"C:\Program Files (x86)\Microsoft Visual Studio"):
        for candidate in Path(root).glob("*/*/VC/Auxiliary/Build/vcvarsall.bat"):
            return candidate
    return None


def find_pg_include_and_pgroot() -> Path | None:
    """pgvector 的 Makefile.win 要 PGROOT 指向「原生 PostgreSQL 安裝」的根目錄（bin/ 的上一層）"""
    bin_dir = pg_bin_dir()
    return bin_dir.parent if bin_dir else None


def clone_pgvector(tag: str, dest: Path) -> None:
    git = shutil.which("git")
    if not git:
        fail("找不到 git，請先安裝 Git for Windows（https://git-scm.com/download/win）。")
        raise SystemExit(1)
    info(f"下載 pgvector 原始碼（{tag}）…")
    result = subprocess.run(
        [git, "clone", "--depth", "1", "--branch", tag,
         "https://github.com/pgvector/pgvector.git", str(dest)],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    if result.returncode != 0:
        fail(f"下載原始碼失敗：\n{result.stdout}\n{result.stderr}")
        raise SystemExit(1)


def build_and_install(src_dir: Path, vcvarsall: Path, pgroot: Path) -> bool:
    """在「開好 VS 編譯環境」的 cmd 裡跑 nmake，一次把編譯和安裝都做完"""
    # vcvarsall.bat 的路徑幾乎一定帶空白（Program Files、版本資料夾），一定要加雙引號；
    # 但把整段指令字串塞進 subprocess.run(["cmd", "/c", script]) 的一個 argv 元素時，Python
    # 在 Windows 上會用 list2cmdline 規則再轉義一次整個字串，把字串裡本來就有的雙引號
    # 弄壞（印出來像 '\"...\"'），cmd 收到的其實是壞掉的路徑。改成寫成一個暫存 .bat 檔
    # 直接執行，完全不會經過那層二次轉義。
    script = (
        f'call "{vcvarsall}" x64\r\n'
        f'set "PGROOT={pgroot}"\r\n'
        f'cd /d "{src_dir}"\r\n'
        f'nmake /F Makefile.win\r\n'
        f'if errorlevel 1 exit /b 1\r\n'
        f'nmake /F Makefile.win install\r\n'
    )
    bat_path = src_dir.parent / "corphia_build_pgvector.bat"
    bat_path.write_text(script, encoding="mbcs" if sys.platform == "win32" else "utf-8")
    result = subprocess.run([str(bat_path)], capture_output=True, text=True, encoding="utf-8", errors="replace")
    info(result.stdout)
    if result.returncode != 0:
        fail(f"編譯或安裝失敗：\n{result.stderr}")
        return False
    return True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--tag", default=None, help="pgvector 版本，例如 v0.8.0；不指定就用最新 release")
    args = parser.parse_args()

    info("=" * 56)
    info(" Corphia AI pgvector 編譯安裝（不靠 Docker）")
    info("=" * 56)

    pgroot = find_pg_include_and_pgroot()
    if not pgroot:
        fail("找不到原生 PostgreSQL 安裝，請先執行 python scripts/setup_postgres.py。")
        return 1

    vcvarsall = find_vcvarsall()
    if not vcvarsall:
        fail(
            "找不到 Visual Studio 的 C++ 編譯工具。請先安裝 Visual Studio Build Tools"
            "（https://visualstudio.microsoft.com/visual-cpp-build-tools/），"
            "安裝時勾選「使用 C++ 的桌面開發」。"
        )
        return 1
    ok(f"找到編譯環境：{vcvarsall}")
    ok(f"PostgreSQL 安裝位置：{pgroot}")

    tag = args.tag
    if not tag:
        try:
            release = fetch_latest_release(PGVECTOR_REPO)
            tag = release["tag_name"]
        except Exception as e:
            fail(f"查詢 pgvector 最新版本失敗：{e}；可以用 --tag v0.8.0 之類的指定版本重試。")
            return 1
    info(f"要編譯的版本：{tag}")

    with tempfile.TemporaryDirectory(prefix="corphia-pgvector-") as tmp:
        src_dir = Path(tmp) / "pgvector"
        clone_pgvector(tag, src_dir)
        if not build_and_install(src_dir, vcvarsall, pgroot):
            return 1

    ok(f"pgvector {tag} 已編譯並安裝完成。")
    warn("要讓資料庫真的用上它：重新啟動 PostgreSQL（或直接重啟整個系統），"
         "下次 backend 啟動時會自動執行 CREATE EXTENSION vector。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
