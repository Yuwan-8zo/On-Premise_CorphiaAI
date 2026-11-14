"""
Corphia AI 主機：第一次設定 (first_run_setup.py)

安裝包複製到主機後跑一次（按兩下「第一次設定.bat」）。目標電腦什麼都不用先裝、也不用連網。

做的事：
  1. 檢查：安裝包完整嗎、AI 模型檔放了沒、這台電腦有沒有視窗元件（WebView2）
  2. 產生這台主機自己的金鑰和資料庫密碼（隨機產生，寫進 backend/.env；不使用任何預設密碼）
  3. 建立資料庫（只聽這台電腦）、建立資料表
  4. 建立管理員帳號（信箱和密碼由安裝的人自己設）
  5. 問：要不要開機自動啟動？（在「啟動」資料夾放一個捷徑；不需要系統管理員權限）
  6. 問：要不要開放內部網路連線？（加一條 Windows 防火牆規則：只允許同一個區域網路連加密埠；
     這會改系統安全設定，所以一定先問，同意後 Windows 會再跳一次管理員確認）
  7. 提醒：公司的路由器不可以把這台主機的埠轉到外面

可以重跑：已經做過的步驟會跳過（金鑰、資料庫、已存在的帳號都不會被蓋掉）。

自動模式（測試、大量部署用）：--unattended，管理員密碼從環境變數 CORPHIA_SETUP_ADMIN_PASSWORD 讀，
開機啟動與防火牆預設都不動（要的話加 --autostart／--firewall）。
"""

from __future__ import annotations

import argparse
import getpass
import os
import re
import secrets
import subprocess
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE_DIR / "scripts"))
import setup_postgres as pg  # noqa: E402

BACKEND_DIR = BASE_DIR / "backend"
ENV_PATH = BACKEND_DIR / ".env"
ENV_EXAMPLE = BACKEND_DIR / ".env.example"
MODEL_DIR = BASE_DIR / "ai_model"
PYTHON = BACKEND_DIR / ".venv" / "Scripts" / "python.exe"

# 加密埠（backend/app/core/config.py 的 lan_https_port）：其他電腦和手機連這個
LAN_PORT = 8443
FIREWALL_RULE = "Corphia AI (LAN)"
STARTUP_SHORTCUT = "Corphia AI 主機.lnk"
PASSWORD_MIN_LENGTH = 10
EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
# WebView2 執行元件登記的位置（有任何一個就是裝了）
WEBVIEW2_KEYS = (
    r"SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
    r"SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
)


def say(text: str = "") -> None:
    print(text, flush=True)


def step(number: int, title: str) -> None:
    say()
    say(f"［{number}］{title}")


# ── 1. 檢查 ──────────────────────────────────────────────────────────────────

def missing_parts() -> list[str]:
    """安裝包少了什麼（少了就不能繼續）"""
    needed = {
        "Python 執行環境（backend/.venv）": PYTHON,
        "後端程式（backend/app）": BACKEND_DIR / "app" / "main.py",
        "介面（frontend/dist）": BASE_DIR / "frontend" / "dist" / "index.html",
        "資料庫程式（db/postgresql）": pg.PG_INSTALL_DIR,
        "AI 推論引擎（engine/llama-vulkan）": BASE_DIR / "engine" / "llama-vulkan" / "llama-server.exe",
        "設定範本（backend/.env.example）": ENV_EXAMPLE,
    }
    return [name for name, path in needed.items() if not path.exists()]


def default_model_name() -> str:
    """設定範本裡寫的預設模型檔名（LLAMA_MODEL_PATH 的最後一段）；讀不到就回空字串"""
    try:
        for line in ENV_EXAMPLE.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith("LLAMA_MODEL_PATH="):
                return line.split("=", 1)[1].strip().replace("\\", "/").split("/")[-1]
    except OSError:
        pass
    return ""


def model_files() -> list[Path]:
    """
    模型資料夾裡的模型檔，預設模型排第一個（[0] 會被寫進設定當作預設）。
    以前只照檔名排序，大寫開頭的檔名會排到前面，選到的不是系統預設的那一個。
    """
    if not MODEL_DIR.is_dir():
        return []
    preferred = default_model_name().lower()
    return sorted(MODEL_DIR.glob("*.gguf"), key=lambda p: (p.name.lower() != preferred, p.name.lower()))


def webview2_installed() -> bool:
    if sys.platform != "win32":
        return False
    import winreg

    for root in (winreg.HKEY_LOCAL_MACHINE, winreg.HKEY_CURRENT_USER):
        for key in WEBVIEW2_KEYS:
            try:
                with winreg.OpenKey(root, key) as handle:
                    version, _ = winreg.QueryValueEx(handle, "pv")
                    if version and version != "0.0.0.0":
                        return True
            except OSError:
                continue
    return False


# ── 2. 金鑰與設定檔 ──────────────────────────────────────────────────────────

def read_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.is_file():
        return values
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            values[key.strip()] = value.strip().strip('"')
    return values


def database_url(password: str) -> str:
    return f"postgresql+asyncpg://{pg.PG_USER}:{password}@127.0.0.1:{pg.PG_PORT}/{pg.PG_DB}"


def build_env(template: str, overrides: dict[str, str]) -> str:
    """照範本寫設定檔：範本裡有的項目換成新值（保留說明文字），範本沒有的加在最後"""
    remaining = dict(overrides)
    out = []
    for line in template.splitlines():
        key = line.split("=", 1)[0].strip() if "=" in line and not line.lstrip().startswith("#") else None
        if key in remaining:
            out.append(f"{key}={remaining.pop(key)}")
        else:
            out.append(line)
    if remaining:
        out.append("")
        out.append("# ---------- 第一次設定產生 ----------")
        out.extend(f"{key}={value}" for key, value in remaining.items())
    return "\n".join(out) + "\n"


def ensure_env() -> tuple[str, bool]:
    """
    準備 backend/.env，回傳（資料庫密碼, 是不是這次新建的）。
    已經有設定檔就沿用裡面的密碼（重跑設定不會把金鑰換掉——換掉的話所有人要重新登入、資料庫也連不上）。
    """
    existing = read_env(ENV_PATH)
    match = re.search(r"://[^:]+:([^@]+)@", existing.get("DATABASE_URL", ""))
    if existing.get("SECRET_KEY") and match:
        return match.group(1), False
    password = secrets.token_urlsafe(24)
    models = model_files()
    overrides = {
        "APP_ENV": "production",
        "DEBUG": "false",
        "DATABASE_URL": database_url(password),
        "SECRET_KEY": secrets.token_urlsafe(48),
        # 連外網搜尋要另外裝搜尋服務，安裝包預設不連外網
        "ENABLE_WEB_SEARCH": "false",
    }
    if models:
        overrides["LLAMA_MODEL_PATH"] = f"../ai_model/{models[0].name}"
    ENV_PATH.write_text(build_env(ENV_EXAMPLE.read_text(encoding="utf-8"), overrides), encoding="utf-8")
    return password, True


# ── 3、4. 資料庫與管理員 ─────────────────────────────────────────────────────

def backend_env() -> dict[str, str]:
    env = dict(os.environ)
    env["PYTHONIOENCODING"] = "utf-8"
    return env


def run_backend_script(name: str, *args: str, extra_env: dict[str, str] | None = None) -> subprocess.CompletedProcess:
    return subprocess.run(
        [str(PYTHON), str(BACKEND_DIR / "scripts" / name), *args],
        cwd=str(BACKEND_DIR), env={**backend_env(), **(extra_env or {})},
        capture_output=True, text=True, encoding="utf-8", errors="replace",
    )


def database_running() -> bool:
    import socket

    try:
        with socket.create_connection(("127.0.0.1", pg.PG_PORT), timeout=2):
            return True
    except OSError:
        return False


def setup_database(password: str) -> None:
    bin_dir = pg.pg_bin_dir()
    if bin_dir is None:
        raise SystemExit("找不到資料庫程式（db/postgresql）。安裝包可能不完整。")
    pg.run_initdb(bin_dir, password)
    # 重跑設定時資料庫可能已經開著：開著就直接用，不要再啟動一次（會被當成啟動失敗）
    if not database_running() and not pg.start_and_wait(bin_dir):
        raise SystemExit(f"資料庫啟動不了，記錄在 {pg.DB_DIR / 'postgres.log'}")
    pg.create_database(bin_dir, password)
    result = run_backend_script("init_db.py")
    if result.returncode != 0:
        raise SystemExit("建立資料表失敗：\n" + (result.stdout + result.stderr)[-800:])
    say("  資料庫和資料表已經準備好。")


def ask_admin(unattended: bool, email_arg: str | None) -> tuple[str, str]:
    if unattended:
        email, password = email_arg or "", os.environ.get("CORPHIA_SETUP_ADMIN_PASSWORD", "")
        if not EMAIL.match(email) or len(password) < PASSWORD_MIN_LENGTH:
            raise SystemExit(f"自動模式需要 --admin-email 和環境變數 CORPHIA_SETUP_ADMIN_PASSWORD（至少 {PASSWORD_MIN_LENGTH} 個字）")
        return email, password
    say("  這個帳號可以進管理後台、新增其他使用者。")
    while True:
        email = input("  管理員信箱：").strip()
        if EMAIL.match(email):
            break
        say("  這不像是信箱，請再輸入一次。")
    while True:
        password = getpass.getpass(f"  管理員密碼（至少 {PASSWORD_MIN_LENGTH} 個字，輸入時不會顯示）：")
        if len(password) < PASSWORD_MIN_LENGTH:
            say("  太短了。")
            continue
        if password == getpass.getpass("  再輸入一次："):
            return email, password
        say("  兩次不一樣，請重新輸入。")


def create_admin(email: str, password: str) -> None:
    # 密碼用環境變數交給建立帳號的程式，不放在指令裡（指令會留在系統的紀錄裡）
    result = run_backend_script("set_password.py", email, "--role", "admin", extra_env={"CORPHIA_NEW_PASSWORD": password})
    if result.returncode != 0:
        raise SystemExit("建立管理員失敗：\n" + (result.stdout + result.stderr)[-800:])
    say(f"  管理員帳號已經建立：{email}")


# ── 5、6. 開機啟動與防火牆（都會改這台電腦的設定：一定先問） ─────────────────

def ask_yes(question: str, unattended: bool, default: bool) -> bool:
    if unattended:
        return default
    answer = input(f"  {question}（y＝要／n＝不要）：").strip().lower()
    return answer in ("y", "yes", "是", "要")


def powershell(command: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
    )


def startup_folder() -> Path:
    return Path(os.environ.get("APPDATA", "")) / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Startup"


def enable_autostart() -> bool:
    """登入 Windows 時自動在背景啟動服務：在這個使用者的「啟動」資料夾放一個捷徑（不需要系統管理員權限）"""
    pythonw = PYTHON.with_name("pythonw.exe")
    target = pythonw if pythonw.is_file() else PYTHON
    shortcut = startup_folder() / STARTUP_SHORTCUT
    script = (
        "$s = (New-Object -ComObject WScript.Shell).CreateShortcut('%s'); "
        "$s.TargetPath = '%s'; $s.Arguments = '\"%s\" --built --skip-browser'; "
        "$s.WorkingDirectory = '%s'; $s.WindowStyle = 7; $s.Save()"
    ) % (shortcut, target, BASE_DIR / "start.py", BASE_DIR)
    return powershell(script).returncode == 0 and shortcut.is_file()


def firewall_command() -> str:
    """要加的防火牆規則（給人看、也給程式執行）：只允許同一個區域網路連加密埠，而且只在私人／網域網路生效"""
    return (
        f'netsh advfirewall firewall add rule name="{FIREWALL_RULE}" dir=in action=allow protocol=TCP '
        f"localport={LAN_PORT} remoteip=localsubnet profile=private,domain"
    )


def add_firewall_rule() -> bool:
    """用系統管理員身分加規則：Windows 會跳出確認視窗，按「是」才會執行"""
    arguments = firewall_command().removeprefix("netsh ").replace("'", "''")
    script = f"Start-Process netsh -ArgumentList '{arguments}' -Verb RunAs -Wait"
    return powershell(script).returncode == 0


# ── 主流程 ───────────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(description="Corphia AI 主機：第一次設定")
    parser.add_argument("--unattended", action="store_true", help="不問問題（測試、大量部署用）")
    parser.add_argument("--admin-email")
    parser.add_argument("--autostart", action="store_true", help="自動模式：設定開機啟動")
    parser.add_argument("--firewall", action="store_true", help="自動模式：加防火牆規則（仍會跳 Windows 的管理員確認）")
    args = parser.parse_args()
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    say("=" * 60)
    say(" Corphia AI 主機：第一次設定")
    say("=" * 60)

    step(1, "檢查安裝包")
    missing = missing_parts()
    if missing:
        say("  安裝包不完整，少了：")
        for name in missing:
            say(f"    - {name}")
        return 1
    say("  安裝包完整。")
    models = model_files()
    if models:
        say(f"  AI 模型：{models[0].name}")
    else:
        say(f"  還沒有放 AI 模型檔。請把模型檔（.gguf）複製到 {MODEL_DIR}，")
        say("  設定可以先繼續做完；沒有模型時系統開得起來，但不能問答。")
    if not webview2_installed():
        say("  這台電腦沒有視窗元件 WebView2（Windows 11 內建，Windows 10 可能沒有）。")
        say("  桌面版需要它；沒有的話請用瀏覽器開 http://localhost:8168 使用，或請管理人員安裝 WebView2。")

    step(2, "產生這台主機自己的金鑰")
    password, created = ensure_env()
    say("  已產生新的金鑰和資料庫密碼（存在 backend/.env，只有這台主機有）。" if created else "  已經設定過，沿用原本的金鑰。")

    step(3, "建立資料庫")
    setup_database(password)

    step(4, "建立管理員帳號")
    email, admin_password = ask_admin(args.unattended, args.admin_email)
    create_admin(email, admin_password)

    step(5, "開機自動啟動")
    say("  這台電腦是主機：公司其他電腦和手機都連它，建議登入 Windows 後自動在背景啟動。")
    if ask_yes("要設定開機自動啟動嗎？", args.unattended, args.autostart):
        say("  已設定。" if enable_autostart() else "  設定失敗：之後可以手動把「一鍵啟動」放進啟動資料夾。")
    else:
        say("  沒有設定。之後要用的時候請開桌面版，它會自動把服務啟動。")

    step(6, "開放內部網路連線")
    say(f"  其他電腦和手機要連到這台主機，Windows 防火牆要允許加密埠 {LAN_PORT}。")
    say("  要加的規則只允許「同一個區域網路」連進來，外面的網路不行：")
    say(f"    {firewall_command()}")
    if ask_yes("要現在加這條規則嗎？（Windows 會再跳出一次管理員確認）", args.unattended, args.firewall):
        say("  已送出。如果剛才按了「否」，規則不會加上，可以用上面那一行指令自己加。" if add_firewall_rule() else "  沒有加成功，可以用上面那一行指令自己加。")
    else:
        say("  沒有加。只有這台電腦自己可以用；之後要開放，用系統管理員身分執行上面那一行指令。")

    step(7, "重要提醒：不要把主機開放到公司外面")
    say("  這套系統設計成只在公司內部網路使用，資料不出公司。")
    say("  請確認公司的路由器「沒有」把這台主機的埠（8168、8443）轉到外面（埠轉發／虛擬伺服器／DMZ）。")
    say("  主機本身已經只接受內部網路的位址；路由器不轉發是第二道保護，兩道都要有。")
    if not args.unattended:
        input("  確認後按 Enter 完成設定…")

    say()
    say("=" * 60)
    say(" 設定完成")
    say("=" * 60)
    say("  開始使用：按兩下「Corphia AI.exe」，用剛才的管理員帳號登入。")
    say("  其他電腦：安裝桌面版後輸入這台主機的 IP；手機用瀏覽器開主機管理後台顯示的 QR 碼。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
