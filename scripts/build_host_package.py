"""
打包「主機安裝包」(build_host_package.py)

產生一個免安裝的資料夾：複製到主機（可以壓成 zip、放隨身碟）→ 按兩下「第一次設定.bat」→ 完成。
目標電腦什麼都不用先裝（Python、Node.js、Visual Studio、Docker 都不用），設定過程也不用連網。

    python scripts/build_host_package.py                 輸出到 dist/CorphiaAI-Host-<版本>/
    python scripts/build_host_package.py --out D:\\某處   指定輸出位置
    python scripts/build_host_package.py --with-models   連 AI 模型檔一起放進去（很大，預設不放）

打包前這台開發用的電腦要先準備好（缺什麼會直接告訴你）：
  - backend/.venv 裝好所有套件（一鍵啟動跑過一次就有）
  - frontend/dist 是最新的（npm run build）
  - db/postgresql 裝好而且編譯過向量外掛（scripts/setup_postgres.py、setup_pgvector.py）
  - engine/llama-vulkan、desktop/dist/Corphia AI.exe
  - 文件檢索模型已經下載過（在使用者家目錄的 huggingface 快取裡）

安裝包裡「不會」有的東西：.env、資料庫的資料、上傳的檔案、備份、對話——只有程式和執行環境。
"""

from __future__ import annotations

import argparse
import shutil
import sys
import time
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE_DIR / "scripts"))
import setup_postgres as pg  # noqa: E402

BACKEND_VENV = BASE_DIR / "backend" / ".venv"
HF_CACHE = Path.home() / ".cache" / "huggingface" / "hub"
# 一起帶走的模型快取：文件檢索（一定要有）、語音輸入（有才帶）
HF_MODELS = ("models--sentence-transformers--paraphrase-multilingual-MiniLM-L12-v2", "models--openai--whisper-base")
HF_REQUIRED = HF_MODELS[0]

# Python 執行環境要從「原本安裝的 Python」帶的執行檔（放進 .venv/Scripts，和套件放在一起就能獨立執行）
PYTHON_BINARIES = ("python.exe", "pythonw.exe", "python3.dll", "vcruntime140.dll", "vcruntime140_1.dll")
# 包裡的 Python 找程式的地方（相對於 .venv/Scripts）：標準程式庫、內建模組、套件、backend 資料夾
# 刻意不寫 import site：寫了 Python 還是會把使用者自己的套件資料夾加進來。最後一行寫成 ../../. 才會指到 backend
# （寫 ../.. 實測會少一層）。
PTH_LINES = (
    "../Lib", "../DLLs", "../Lib/site-packages",
    "../Lib/site-packages/win32", "../Lib/site-packages/win32/lib", "../Lib/site-packages/pythonwin",
    "../../.",
)
# 標準程式庫裡用不到的大塊頭
STDLIB_SKIP = {"site-packages", "test", "idlelib", "tkinter", "turtledemo", "ensurepip", "__pycache__"}
# 資料庫程式裡用不到的（管理工具、說明文件、開發用的標頭檔）
POSTGRES_SKIP = {"pgAdmin 4", "doc", "include", "StackBuilder", "symbols"}
CODE_SKIP = shutil.ignore_patterns("__pycache__", "*.pyc", ".pytest_cache", "tests", "out", ".env", ".env.*", "uploads", "*.log")

BAT_HEADER = "@echo off\r\nchcp 65001 >nul\r\ncd /d \"%~dp0\"\r\n"
PYTHON_IN_PACKAGE = "backend\\.venv\\Scripts\\python.exe"
BATS = {
    "第一次設定.bat": f"title Corphia AI Setup\r\n\"{PYTHON_IN_PACKAGE}\" scripts\\first_run_setup.py\r\necho.\r\npause\r\n",
    "一鍵啟動.bat": f"title Corphia AI Launcher\r\n\"{PYTHON_IN_PACKAGE}\" start.py --built\r\npause\r\n",
    "一鍵關閉.bat": f"title Corphia Stop\r\n\"{PYTHON_IN_PACKAGE}\" stop.py\r\necho.\r\ntimeout /t 8\r\n",
}

README = """Corphia AI 主機安裝包
====================

這台電腦什麼都不用先裝，也不用連網。

第一次使用
  1. 把整個資料夾複製到主機（路徑不要太深，例如 C:\\CorphiaAI）。
  2. 把 AI 模型檔（.gguf）複製到 ai_model 資料夾。
  3. 按兩下「第一次設定.bat」，照畫面回答（設定管理員帳號、要不要開機自動啟動、要不要開放內部網路）。
  4. 按兩下「Corphia AI.exe」開始使用。

之後
  - 開啟：按兩下「Corphia AI.exe」。關掉視窗不會關掉服務（其他電腦和手機還連著）。
  - 關閉整個系統：按兩下「一鍵關閉.bat」。
  - 其他電腦：把「Corphia AI.exe」複製過去執行，輸入這台主機的 IP。
  - 手機、平板：在主機的管理後台開「區域網路」，掃畫面上的 QR 碼。

注意
  - 這套系統只在公司內部網路使用。請不要在路由器上把這台主機的埠（8168、8443）轉到外面。
  - 連外網搜尋預設關閉。需要的話另外安裝搜尋服務，再到 backend\\.env 把 ENABLE_WEB_SEARCH 改成 true。
  - 你的資料在 db\\pgdata（資料庫）和 backend\\uploads（上傳的檔案）；備份整個資料夾就能搬家。
"""


def log(text: str) -> None:
    print(text, flush=True)


def missing_prerequisites() -> list[str]:
    needed = {
        "backend/.venv（先跑一次一鍵啟動）": BACKEND_VENV / "Scripts" / "python.exe",
        "frontend/dist（cd frontend && npm run build）": BASE_DIR / "frontend" / "dist" / "index.html",
        "db/postgresql（python scripts/setup_postgres.py）": pg.pg_bin_dir(),
        "向量外掛（python scripts/setup_pgvector.py）": (pg.pg_bin_dir() or Path("x")).parent / "lib" / "vector.dll",
        "engine/llama-vulkan": BASE_DIR / "engine" / "llama-vulkan" / "llama-server.exe",
        "desktop/dist/Corphia AI.exe（desktop/build.bat）": BASE_DIR / "desktop" / "dist" / "Corphia AI.exe",
        "文件檢索模型（系統正常啟動過一次就會下載）": HF_CACHE / HF_REQUIRED,
    }
    return [name for name, path in needed.items() if path is None or not Path(path).exists()]


def base_python() -> Path:
    """backend/.venv 是用哪一份 Python 建的（pyvenv.cfg 的 home）"""
    for line in (BACKEND_VENV / "pyvenv.cfg").read_text(encoding="utf-8").splitlines():
        if line.lower().startswith("home"):
            return Path(line.split("=", 1)[1].strip())
    raise SystemExit("backend/.venv/pyvenv.cfg 裡找不到 home")


def copy_tree(src: Path, dst: Path, skip: set[str] | None = None, ignore=None) -> None:
    def _ignore(folder, names):
        dropped = set(ignore(folder, names)) if ignore else set()
        if skip and Path(folder) == src:
            dropped |= {n for n in names if n in skip}
        dropped |= {n for n in names if n == "__pycache__"}
        return dropped

    shutil.copytree(src, dst, ignore=_ignore, dirs_exist_ok=True)


def build_python(out: Path) -> None:
    """
    可以搬著走的 Python：把「原本安裝的 Python」的執行檔和標準程式庫，跟 .venv 裡的套件放成同一個資料夾。
    位置刻意用 backend/.venv/Scripts/python.exe——啟動程式、桌面版、關閉程式本來就找這裡，都不用改。
    （一般的 .venv 只是一個指向原本 Python 的捷徑，搬到沒裝 Python 的電腦就不能用；這裡是完整的一份。）
    """
    home = base_python()
    version_dll = next(home.glob("python3??.dll"), None)  # 例如 python312.dll（不是 python3.dll）
    target = out / "backend" / ".venv"
    (target / "Scripts").mkdir(parents=True, exist_ok=True)
    for name in PYTHON_BINARIES + tuple(p.name for p in home.glob("python3??.dll")):
        if (home / name).is_file():
            shutil.copy2(home / name, target / "Scripts" / name)
    if version_dll is None:
        raise SystemExit(f"{home} 裡找不到 python3xx.dll")
    copy_tree(home / "DLLs", target / "DLLs")
    copy_tree(home / "Lib", target / "Lib", skip=STDLIB_SKIP)
    copy_tree(BACKEND_VENV / "Lib" / "site-packages", target / "Lib" / "site-packages")
    # 只用包裡的東西：有這個檔案，Python 就不看環境變數、登錄檔、也不看「使用者自己的套件資料夾」
    # （%APPDATA%\Python\...）。沒有它的話，目標電腦上剛好有別的 Python 套件時會被優先拿去用，版本不同就出錯；
    # 開發用的電腦上則會誤以為包是完整的。最後一行讓 backend 資料夾裡的程式（app、run_server.py）找得到。
    write_text(target / "Scripts" / f"{version_dll.stem}._pth", "\n".join(PTH_LINES) + "\n")


def write_text(path: Path, text: str, bom: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes((b"\xef\xbb\xbf" if bom else b"") + text.encode("utf-8"))


def build(out: Path, with_models: bool) -> None:
    started = time.time()
    if out.exists():
        raise SystemExit(f"{out} 已經存在。請先刪掉或換一個位置（不會自動覆蓋，免得刪到有資料的安裝）。")
    out.mkdir(parents=True)

    log("1/7 Python 執行環境與套件（最大的一塊，要幾分鐘）…")
    build_python(out)

    log("2/7 後端與啟動程式…")
    copy_tree(BASE_DIR / "backend" / "app", out / "backend" / "app", ignore=CODE_SKIP)
    copy_tree(BASE_DIR / "backend" / "scripts", out / "backend" / "scripts", skip={"model_eval"}, ignore=CODE_SKIP)
    for name in ("run_server.py", "requirements.txt", ".env.example", "auto_engine.py"):
        if (BASE_DIR / "backend" / name).is_file():
            shutil.copy2(BASE_DIR / "backend" / name, out / "backend" / name)
    for name in ("start.py", "stop.py", "update.py", "VERSION"):
        shutil.copy2(BASE_DIR / name, out / name)
    copy_tree(BASE_DIR / "scripts", out / "scripts", ignore=CODE_SKIP)

    log("3/7 介面…")
    copy_tree(BASE_DIR / "frontend" / "dist", out / "frontend" / "dist")
    # 啟動程式把進度寫在這裡（frontend/public/boot-status.json）
    write_text(out / "frontend" / "public" / "boot-status.json", '{"overall": "stopped", "steps": []}')

    log("4/7 資料庫程式（含編譯好的向量外掛）…")
    bin_dir = pg.pg_bin_dir()
    copy_tree(bin_dir.parent, out / "db" / "postgresql" / bin_dir.parent.relative_to(pg.PG_INSTALL_DIR), skip=POSTGRES_SKIP)

    log("5/7 AI 推論引擎…")
    copy_tree(BASE_DIR / "engine" / "llama-vulkan", out / "engine" / "llama-vulkan")

    log("6/7 文件檢索與語音模型…")
    for name in HF_MODELS:
        if (HF_CACHE / name).is_dir():
            copy_tree(HF_CACHE / name, out / "models-cache" / "hub" / name)

    log("7/7 桌面版、說明與批次檔…")
    shutil.copy2(BASE_DIR / "desktop" / "dist" / "Corphia AI.exe", out / "Corphia AI.exe")
    (out / "ai_model").mkdir()
    write_text(out / "ai_model" / "把模型檔放這裡.txt", "把 AI 模型檔（.gguf）複製到這個資料夾，再執行「第一次設定.bat」。\r\n", bom=True)
    if with_models:
        for model in sorted((BASE_DIR / "ai_model").glob("*.gguf")):
            log(f"    模型 {model.name}（{model.stat().st_size / 1e9:.1f} GB）…")
            shutil.copy2(model, out / "ai_model" / model.name)
    write_text(out / "安裝說明.txt", README.replace("\n", "\r\n"), bom=True)
    for name, body in BATS.items():
        write_text(out / name, BAT_HEADER + body)

    size = sum(f.stat().st_size for f in out.rglob("*") if f.is_file())
    log(f"完成：{out}（{size / 1e9:.2f} GB，花了 {time.time() - started:.0f} 秒）")


def main() -> int:
    parser = argparse.ArgumentParser(description="打包 Corphia AI 主機安裝包")
    parser.add_argument("--out", help="輸出資料夾（預設 dist/CorphiaAI-Host-<版本>）")
    parser.add_argument("--with-models", action="store_true", help="連 ai_model 裡的模型檔一起放進去")
    args = parser.parse_args()
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    missing = missing_prerequisites()
    if missing:
        log("還不能打包，這台電腦少了：")
        for name in missing:
            log(f"  - {name}")
        return 1
    version = (BASE_DIR / "VERSION").read_text(encoding="utf-8").strip()
    out = Path(args.out) if args.out else BASE_DIR / "dist" / f"CorphiaAI-Host-{version}"
    build(out.resolve(), args.with_models)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
