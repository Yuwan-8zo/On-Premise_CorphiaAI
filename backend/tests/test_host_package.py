"""
主機安裝包：設定精靈與打包腳本的判斷邏輯 (test_host_package.py)

整套流程（打包 → 乾淨資料夾跑精靈 → 啟動 → 登入問答）是手動實測的；這裡測不需要真的安裝就能驗的部分：
- 設定檔：照範本產生、不使用預設密碼、重跑不會換掉金鑰
- 防火牆規則只允許同一個區域網路、只開加密埠
- 包裡的 Python 只看安裝包自己的資料夾
"""
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

import build_host_package as build  # noqa: E402
import first_run_setup as setup  # noqa: E402

TEMPLATE = """# 說明文字要留著
APP_ENV=development
DATABASE_URL=postgresql+asyncpg://corphia:corphia123@localhost:5433/corphia_ai
SECRET_KEY=your-super-secret-key
# ENABLE_WEB_SEARCH=true 這一行是註解，不能被當成設定改掉
ENABLE_WEB_SEARCH=true
"""


def test_build_env_replaces_values_keeps_comments_and_appends_new_keys():
    text = setup.build_env(TEMPLATE, {"APP_ENV": "production", "SECRET_KEY": "abc", "NEW_KEY": "1"})
    lines = text.splitlines()
    assert "# 說明文字要留著" in lines and "APP_ENV=production" in lines and "SECRET_KEY=abc" in lines
    assert "# ENABLE_WEB_SEARCH=true 這一行是註解，不能被當成設定改掉" in lines
    assert "ENABLE_WEB_SEARCH=true" in lines, "沒有要改的項目維持原樣"
    assert lines[-1] == "NEW_KEY=1"


@pytest.fixture
def install(tmp_path, monkeypatch):
    (tmp_path / "backend").mkdir()
    (tmp_path / "backend" / ".env.example").write_text(TEMPLATE, encoding="utf-8")
    (tmp_path / "ai_model").mkdir()
    monkeypatch.setattr(setup, "ENV_PATH", tmp_path / "backend" / ".env")
    monkeypatch.setattr(setup, "ENV_EXAMPLE", tmp_path / "backend" / ".env.example")
    monkeypatch.setattr(setup, "MODEL_DIR", tmp_path / "ai_model")
    return tmp_path


def test_first_run_generates_its_own_secrets(install):
    password, created = setup.ensure_env()
    env = setup.read_env(install / "backend" / ".env")
    assert created and len(password) >= 24 and password != "corphia123"
    assert env["APP_ENV"] == "production" and env["ENABLE_WEB_SEARCH"] == "false"
    assert len(env["SECRET_KEY"]) >= 48 and env["SECRET_KEY"] != "your-super-secret-key"
    assert env["DATABASE_URL"] == setup.database_url(password) and "corphia123" not in env["DATABASE_URL"]
    assert "@127.0.0.1:" in env["DATABASE_URL"], "資料庫只連這台電腦"


def test_two_installs_never_share_secrets(install):
    first, _ = setup.ensure_env()
    first_key = setup.read_env(setup.ENV_PATH)["SECRET_KEY"]
    setup.ENV_PATH.unlink()
    second, _ = setup.ensure_env()
    assert first != second and setup.read_env(setup.ENV_PATH)["SECRET_KEY"] != first_key


def test_rerun_keeps_existing_secrets(install):
    password, _ = setup.ensure_env()
    before = setup.ENV_PATH.read_text(encoding="utf-8")
    again, created = setup.ensure_env()
    assert (again, created) == (password, False)
    assert setup.ENV_PATH.read_text(encoding="utf-8") == before, "重跑設定不能換金鑰：所有人會被登出、資料庫也連不上"


def test_model_in_the_folder_becomes_the_default(install):
    (install / "ai_model" / "gpt-oss-20b-MXFP4.gguf").write_bytes(b"x")
    setup.ensure_env()
    assert setup.read_env(setup.ENV_PATH)["LLAMA_MODEL_PATH"] == "../ai_model/gpt-oss-20b-MXFP4.gguf"


def test_firewall_rule_is_lan_only_and_only_the_encrypted_port():
    rule = setup.firewall_command()
    assert f"localport={setup.LAN_PORT}" in rule and "8168" not in rule, "沒加密的埠不對外開"
    assert "remoteip=localsubnet" in rule, "只允許同一個區域網路"
    assert "profile=private,domain" in rule and "public" not in rule, "連到公共網路（咖啡廳）時不生效"
    assert "dir=in action=allow protocol=TCP" in rule


def test_unattended_setup_needs_a_real_admin(monkeypatch):
    monkeypatch.setenv("CORPHIA_SETUP_ADMIN_PASSWORD", "short")
    with pytest.raises(SystemExit):
        setup.ask_admin(True, "admin@example.test")
    monkeypatch.setenv("CORPHIA_SETUP_ADMIN_PASSWORD", "x" * setup.PASSWORD_MIN_LENGTH)
    with pytest.raises(SystemExit):
        setup.ask_admin(True, "不是信箱")
    assert setup.ask_admin(True, "admin@example.test") == ("admin@example.test", "x" * setup.PASSWORD_MIN_LENGTH)


def test_unattended_never_changes_system_settings_unless_asked():
    assert setup.ask_yes("要設定開機自動啟動嗎？", unattended=True, default=False) is False


def test_missing_parts_are_named(monkeypatch, tmp_path):
    monkeypatch.setattr(setup, "PYTHON", tmp_path / "nope.exe")
    assert any("Python" in name for name in setup.missing_parts())


def test_bundled_python_only_looks_inside_the_package():
    lines = build.PTH_LINES
    assert "import site" not in lines, "寫了這一行，Python 會把使用者自己的套件資料夾也加進來"
    assert all(line.startswith("../") for line in lines), "全部是相對於安裝包的路徑，搬到哪裡都能用"
    assert "../Lib/site-packages" in lines and lines[-1] == "../../.", "最後一行要指到 backend（app、run_server.py）"


def test_package_never_includes_secrets_or_user_data():
    ignored = build.CODE_SKIP("x", [".env", ".env.local", "uploads", "app.log", "tests", "main.py", ".env.example"])
    assert {".env", ".env.local", "uploads", "app.log", "tests"} <= set(ignored)
    assert "main.py" not in ignored


def test_batch_files_use_the_bundled_python_and_stay_ascii():
    for name, body in build.BATS.items():
        text = build.BAT_HEADER + body
        assert build.PYTHON_IN_PACKAGE in text, f"{name} 要用包裡的 Python（目標電腦沒有裝 Python）"
        text.encode("ascii")  # 內容只有英數：任何語系的 Windows 都能正確執行
        assert "\r\n" in text and "\n" not in text.replace("\r\n", "")
