"""
一鍵更新（update.py，repo 根目錄，不是 backend/ 底下的套件）

只測不需要真的連網、不需要真的跑系統的部分：版本比對、找 release 資產、
SHA-256 核對、備份／套用更新包的檔案操作（在 tmp_path 裡假造一個小型專案樹）。
"""

import hashlib
import sys
import urllib.error
import zipfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import update  # noqa: E402


# ═════════════════════════════════════════════════════════════════════════
# 版本比對
# ═════════════════════════════════════════════════════════════════════════
class TestParseVersion:
    def test_plain(self):
        assert update.parse_version("2.4.0") == (2, 4, 0)

    def test_v_prefix(self):
        assert update.parse_version("v2.4.0") == (2, 4, 0)

    def test_malformed_falls_back_to_zero_not_crash(self):
        assert update.parse_version("not-a-version") == (0,)

    def test_ordering(self):
        assert update.parse_version("2.10.0") > update.parse_version("2.9.0")
        assert update.parse_version("2.3.0") == update.parse_version("2.3.0")


# ═════════════════════════════════════════════════════════════════════════
# 在 release 的 assets 裡找 .zip / .zip.sha256
# ═════════════════════════════════════════════════════════════════════════
class TestFindAsset:
    def test_finds_matching_suffix(self):
        assets = [{"name": "corphia-update-v2.4.0.zip"}, {"name": "corphia-update-v2.4.0.zip.sha256"}]
        assert update.find_asset(assets, ".zip")["name"] == "corphia-update-v2.4.0.zip"
        assert update.find_asset(assets, ".zip.sha256")["name"] == "corphia-update-v2.4.0.zip.sha256"

    def test_none_when_missing(self):
        assert update.find_asset([{"name": "readme.txt"}], ".zip") is None

    def test_empty_list(self):
        assert update.find_asset([], ".zip") is None


# ═════════════════════════════════════════════════════════════════════════
# SHA-256 核對：下載完整才套用，被竄改或沒下載完就擋下來
# ═════════════════════════════════════════════════════════════════════════
class TestVerifyChecksum:
    def test_matching_checksum_passes(self, tmp_path):
        zip_path = tmp_path / "pkg.zip"
        zip_path.write_bytes(b"hello world")
        digest = hashlib.sha256(b"hello world").hexdigest()
        checksum_path = tmp_path / "pkg.zip.sha256"
        checksum_path.write_text(f"{digest}  pkg.zip\n")
        assert update.verify_checksum(zip_path, checksum_path) is True

    def test_mismatched_checksum_fails(self, tmp_path):
        zip_path = tmp_path / "pkg.zip"
        zip_path.write_bytes(b"hello world")
        checksum_path = tmp_path / "pkg.zip.sha256"
        checksum_path.write_text("0" * 64 + "  pkg.zip\n")
        assert update.verify_checksum(zip_path, checksum_path) is False

    def test_corrupted_download_fails(self, tmp_path):
        zip_path = tmp_path / "pkg.zip"
        checksum_path = tmp_path / "pkg.zip.sha256"
        digest = hashlib.sha256(b"original content").hexdigest()
        checksum_path.write_text(f"{digest}  pkg.zip\n")
        zip_path.write_bytes(b"truncated or tampered content")
        assert update.verify_checksum(zip_path, checksum_path) is False


# ═════════════════════════════════════════════════════════════════════════
# 套用更新包：只覆蓋包裡真的有的路徑，資料和沒列進去的東西完全不動
# ═════════════════════════════════════════════════════════════════════════
class TestApplyPackage:
    def test_overwrites_file_and_replaces_nested_directory(self, tmp_path, monkeypatch):
        """只動清單列出的巢狀路徑（backend/app），不是整個 backend/ 資料夾"""
        project = tmp_path / "project"
        project.mkdir()
        (project / "VERSION").write_text("1.0.0")
        app_dir = project / "backend" / "app"
        app_dir.mkdir(parents=True)
        (app_dir / "old_module.py").write_text("old")
        monkeypatch.setattr(update, "BASE_DIR", project)
        monkeypatch.setattr(update, "RELEASE_PATHS", ["VERSION", "backend/app"])

        staging = tmp_path / "staging"
        (staging / "backend" / "app").mkdir(parents=True)
        (staging / "VERSION").write_text("2.0.0")
        (staging / "backend" / "app" / "new_module.py").write_text("new")

        applied = update.apply_package(staging)

        assert sorted(applied) == ["VERSION", "backend/app"]
        assert (project / "VERSION").read_text() == "2.0.0"
        # backend/app 這個路徑整個換掉：舊檔案不見了，只剩更新包帶來的新檔案
        assert not (project / "backend" / "app" / "old_module.py").exists()
        assert (project / "backend" / "app" / "new_module.py").read_text() == "new"

    def test_sibling_path_not_in_manifest_survives_even_though_parent_dir_is_touched(self, tmp_path, monkeypatch):
        """修正的 bug：以前是看解壓後最上層的資料夾名稱（backend/）整個 rmtree 再 copytree，
        backend/app 以外、不在清單上的東西（.env、uploads、.venv…）會被一起砍光。
        現在只能動清單列出的巢狀路徑本身，backend/ 底下的手足路徑完全不受影響。"""
        project = tmp_path / "project"
        project.mkdir()
        (project / "backend" / "app").mkdir(parents=True)
        (project / "backend" / "app" / "old_module.py").write_text("old")
        # 清單上沒列的使用者資料，跟 backend/app 同一層
        (project / "backend" / ".env").write_text("SECRET_KEY=keep-me")
        (project / "backend" / "uploads").mkdir()
        (project / "backend" / "uploads" / "user_file.txt").write_text("precious")
        monkeypatch.setattr(update, "BASE_DIR", project)
        monkeypatch.setattr(update, "RELEASE_PATHS", ["backend/app"])

        staging = tmp_path / "staging"
        (staging / "backend" / "app").mkdir(parents=True)
        (staging / "backend" / "app" / "new_module.py").write_text("new")

        update.apply_package(staging)

        assert not (project / "backend" / "app" / "old_module.py").exists()
        assert (project / "backend" / "app" / "new_module.py").read_text() == "new"
        # 手足路徑完全沒被動到
        assert (project / "backend" / ".env").read_text() == "SECRET_KEY=keep-me"
        assert (project / "backend" / "uploads" / "user_file.txt").read_text() == "precious"

    def test_untouched_paths_survive(self, tmp_path, monkeypatch):
        """更新包沒帶到的東西（.env、uploads…）完全不在 staging 裡，自然不會被動到"""
        project = tmp_path / "project"
        project.mkdir()
        (project / ".env").write_text("SECRET_KEY=keep-me")
        monkeypatch.setattr(update, "BASE_DIR", project)
        monkeypatch.setattr(update, "RELEASE_PATHS", ["VERSION"])

        staging = tmp_path / "staging"
        staging.mkdir()
        (staging / "VERSION").write_text("2.0.0")

        update.apply_package(staging)
        assert (project / ".env").read_text() == "SECRET_KEY=keep-me"


# ═════════════════════════════════════════════════════════════════════════
# 備份／復原：失敗時要能完整回到更新前
# ═════════════════════════════════════════════════════════════════════════
class TestBackupRestore:
    def _make_project(self, tmp_path: Path) -> Path:
        project = tmp_path / "project"
        project.mkdir()
        (project / "VERSION").write_text("1.0.0")
        (project / "start.py").write_text("# old start.py")
        app_dir = project / "backend" / "app"
        app_dir.mkdir(parents=True)
        (app_dir / "main.py").write_text("# old main")
        cache_dir = app_dir / "__pycache__"
        cache_dir.mkdir()
        (cache_dir / "main.cpython-312.pyc").write_bytes(b"\x00\x01")
        return project

    def test_backup_then_restore_round_trip(self, tmp_path, monkeypatch):
        project = self._make_project(tmp_path)
        monkeypatch.setattr(update, "BASE_DIR", project)
        monkeypatch.setattr(update, "BACKUPS_DIR", project / "backups")

        backup_zip = update.backup_current("1.0.0")
        assert backup_zip.exists()

        # 模擬更新（套用新版本）
        (project / "VERSION").write_text("2.0.0")
        (project / "backend" / "app" / "main.py").write_text("# new main")

        update.restore_backup(backup_zip)

        assert (project / "VERSION").read_text() == "1.0.0"
        assert (project / "backend" / "app" / "main.py").read_text() == "# old main"

    def test_backup_skips_pycache(self, tmp_path, monkeypatch):
        project = self._make_project(tmp_path)
        monkeypatch.setattr(update, "BASE_DIR", project)
        monkeypatch.setattr(update, "BACKUPS_DIR", project / "backups")

        backup_zip = update.backup_current("1.0.0")
        with zipfile.ZipFile(backup_zip) as zf:
            names = zf.namelist()
        assert not any("__pycache__" in n for n in names)

    def test_backup_filename_includes_old_version(self, tmp_path, monkeypatch):
        project = self._make_project(tmp_path)
        monkeypatch.setattr(update, "BASE_DIR", project)
        monkeypatch.setattr(update, "BACKUPS_DIR", project / "backups")

        backup_zip = update.backup_current("1.0.0")
        assert "from-v1.0.0" in backup_zip.name


# ═════════════════════════════════════════════════════════════════════════
# 版本號單一來源：backend/app/core/version.py 讀專案根目錄的 VERSION 檔
# ═════════════════════════════════════════════════════════════════════════
class TestMainNoReleaseYet:
    def test_404_is_reported_as_already_latest_not_a_network_error(self, tmp_path, monkeypatch, capsys):
        """還沒發布過任何版本時 GitHub 回 404：這不是「連不到網路」，是「沒有可更新的版本」"""
        project = tmp_path / "project"
        project.mkdir()
        (project / "VERSION").write_text("1.0.0")
        monkeypatch.setattr(update, "BASE_DIR", project)
        monkeypatch.setattr(update, "VERSION_FILE", project / "VERSION")

        def raise_404(repo):
            raise urllib.error.HTTPError("https://api.github.com/repos/x/x/releases/latest", 404, "Not Found", {}, None)

        monkeypatch.setattr(update, "fetch_latest_release", raise_404)
        monkeypatch.setattr(sys, "argv", ["update.py"])

        assert update.main() == 0
        assert "已經是最新" in capsys.readouterr().out


def test_app_version_matches_version_file():
    from app.core.version import APP_VERSION

    assert APP_VERSION == (ROOT / "VERSION").read_text(encoding="utf-8").strip()


# ═════════════════════════════════════════════════════════════════════════
# 健康檢查：回歸測試——之前漏了 import json，一收到真的健康回應就會 NameError
# ═════════════════════════════════════════════════════════════════════════
class TestStartAndWaitHealthy:
    def test_parses_real_json_response_without_crashing(self, monkeypatch):
        monkeypatch.setattr(update.subprocess, "Popen", lambda *a, **k: None)

        class _FakeResp:
            status = 200

            def read(self):
                return b'{"status": "ok"}'

            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

        monkeypatch.setattr(update.urllib.request, "urlopen", lambda *a, **k: _FakeResp())

        assert update.start_and_wait_healthy(timeout_sec=5) is True
