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
    def test_overwrites_file_and_replaces_directory(self, tmp_path, monkeypatch):
        project = tmp_path / "project"
        project.mkdir()
        (project / "VERSION").write_text("1.0.0")
        app_dir = project / "backend" / "app"
        app_dir.mkdir(parents=True)
        (app_dir / "old_module.py").write_text("old")
        monkeypatch.setattr(update, "BASE_DIR", project)

        staging = tmp_path / "staging"
        (staging / "backend" / "app").mkdir(parents=True)
        (staging / "VERSION").write_text("2.0.0")
        (staging / "backend" / "app" / "new_module.py").write_text("new")

        applied = update.apply_package(staging)

        assert sorted(applied) == ["VERSION", "backend"]
        assert (project / "VERSION").read_text() == "2.0.0"
        # 整個資料夾換掉：舊檔案不見了，只剩更新包帶來的新檔案
        assert not (project / "backend" / "app" / "old_module.py").exists()
        assert (project / "backend" / "app" / "new_module.py").read_text() == "new"

    def test_untouched_paths_survive(self, tmp_path, monkeypatch):
        """更新包沒帶到的東西（.env、uploads…）完全不在 staging 裡，自然不會被動到"""
        project = tmp_path / "project"
        project.mkdir()
        (project / ".env").write_text("SECRET_KEY=keep-me")
        monkeypatch.setattr(update, "BASE_DIR", project)

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

        def raise_404():
            raise urllib.error.HTTPError(update.GITHUB_API, 404, "Not Found", {}, None)

        monkeypatch.setattr(update, "fetch_latest_release", raise_404)
        monkeypatch.setattr(sys, "argv", ["update.py"])

        assert update.main() == 0
        assert "已經是最新" in capsys.readouterr().out


def test_app_version_matches_version_file():
    from app.core.version import APP_VERSION

    assert APP_VERSION == (ROOT / "VERSION").read_text(encoding="utf-8").strip()
