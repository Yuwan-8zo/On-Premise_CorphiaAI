"""
備份腳本（backend/scripts/backup.py）與桌面版小幫手（desktop/）裡的判斷邏輯

只測不需要資料庫容器、不需要 Office 的部分：筆數核對、備份完整性檢查、壓縮、
回答文字轉成 Word／Excel 內容的規則、網址來源的比對。
"""

import json
import sys
import zipfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend" / "scripts"))
sys.path.insert(0, str(ROOT / "desktop"))

import backup  # noqa: E402
import office_bridge  # noqa: E402


# ═════════════════════════════════════════════════════════════════════════
# 備份：還原後的筆數核對
# ═════════════════════════════════════════════════════════════════════════
class TestCompare:
    def test_exact_match(self):
        manifest = {"tables": {"users": 9, "messages": 120}, "tables_after": {"users": 9, "messages": 120}}
        assert backup.compare(manifest, {"users": 9, "messages": 120}) == []

    def test_rows_written_during_the_backup_are_tolerated(self):
        """備份當下系統還在用：還原後的筆數落在「備份前～備份後」之間都算對"""
        manifest = {"tables": {"audit_logs": 100}, "tables_after": {"audit_logs": 104}}
        for restored in (100, 102, 104):
            assert backup.compare(manifest, {"audit_logs": restored}) == []
        assert backup.compare(manifest, {"audit_logs": 99}) != []
        assert backup.compare(manifest, {"audit_logs": 105}) != []

    def test_missing_or_extra_table_is_reported(self):
        manifest = {"tables": {"users": 9, "folders": 3}, "tables_after": {"users": 9, "folders": 3}}
        assert any("folders" in line for line in backup.compare(manifest, {"users": 9}))
        assert any("extra" in line for line in backup.compare(manifest, {"users": 9, "folders": 3, "extra": 1}))

    def test_old_manifest_without_after_counts(self):
        manifest = {"tables": {"users": 9}}
        assert backup.compare(manifest, {"users": 9}) == []
        assert backup.compare(manifest, {"users": 8}) != []


# ═════════════════════════════════════════════════════════════════════════
# 備份：檔案完整性、壓縮、列出備份
# ═════════════════════════════════════════════════════════════════════════
def _make_backup(folder: Path) -> dict:
    folder.mkdir(parents=True)
    (folder / "database.dump").write_bytes(b"PGDMP fake dump")
    with zipfile.ZipFile(folder / "uploads.zip", "w") as z:
        z.writestr("a.txt", "hello")
    files = {p.name: {"size": p.stat().st_size, "sha256": backup.sha256(p)} for p in sorted(folder.iterdir())}
    manifest = {"created_at": "2026-11-13 07:00:00", "commit": "abc1234", "tables": {"users": 1}, "rows": 1, "file_counts": {"uploads": 1}, "files": files}
    (folder / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    return manifest


class TestBackupIntegrity:
    def test_intact_backup_passes(self, tmp_path):
        manifest = _make_backup(tmp_path / "corphia-ok")
        backup.verify_files(tmp_path / "corphia-ok", manifest)  # 不丟錯就是通過

    def test_changed_file_is_detected(self, tmp_path):
        folder = tmp_path / "corphia-changed"
        manifest = _make_backup(folder)
        data = bytearray((folder / "database.dump").read_bytes())
        data[3] ^= 0xFF  # 大小一樣、內容不一樣
        (folder / "database.dump").write_bytes(bytes(data))
        with pytest.raises(backup.BackupError, match="損壞"):
            backup.verify_files(folder, manifest)

    def test_missing_file_is_detected(self, tmp_path):
        folder = tmp_path / "corphia-missing"
        manifest = _make_backup(folder)
        (folder / "uploads.zip").unlink()
        with pytest.raises(backup.BackupError, match="少了"):
            backup.verify_files(folder, manifest)

    def test_folder_without_manifest_is_not_a_backup(self, tmp_path):
        with pytest.raises(backup.BackupError, match="不是完整的備份"):
            backup.load_manifest(tmp_path)

    def test_listing_ignores_unfinished_and_unrelated_folders(self, tmp_path, monkeypatch):
        monkeypatch.setattr(backup, "BACKUP_ROOT", tmp_path)
        _make_backup(tmp_path / "corphia-20261113-070000")
        (tmp_path / "corphia-20261113-080000.partial").mkdir()   # 做到一半
        (tmp_path / "corphia-empty").mkdir()                      # 沒有 manifest
        (tmp_path / "something-else").mkdir()
        assert [p.name for p in backup.all_backups()] == ["corphia-20261113-070000"]

    def test_zip_dir(self, tmp_path):
        src = tmp_path / "uploads"
        (src / "sub").mkdir(parents=True)
        (src / "a.txt").write_text("a", encoding="utf-8")
        (src / "sub" / "中文檔名.txt").write_text("b", encoding="utf-8")
        assert backup.zip_dir(src, tmp_path / "out.zip") == 2
        with zipfile.ZipFile(tmp_path / "out.zip") as z:
            assert sorted(z.namelist()) == ["a.txt", "sub/中文檔名.txt"]
        # 資料夾不存在：做一個空的壓縮檔（備份不會因此失敗）
        assert backup.zip_dir(tmp_path / "nope", tmp_path / "empty.zip") == 0
        with zipfile.ZipFile(tmp_path / "empty.zip") as z:
            assert z.namelist() == []

    def test_database_identity_does_not_include_the_password(self):
        user, database = backup.db_identity()
        assert user and database
        assert ":" not in user and "@" not in database


# ═════════════════════════════════════════════════════════════════════════
# 桌面版小幫手：把回答（Markdown）變成 Word／Excel 的內容
# ═════════════════════════════════════════════════════════════════════════
class TestOfficeBridgeText:
    MD = "## 出差須知\n\n國內出差**住宿費**上限 3,200 元。\n\n- 三日前申請\n1. 超過自付\n\n| 部門 | 預算 |\n|---|---|\n| 業務部 | 1,200,000 |\n| 人資部 | 007 |\n"

    def test_parse_markdown_blocks(self):
        blocks = office_bridge.parse_markdown(self.MD)
        assert [kind for kind, _ in blocks] == ["h1", "p", "li", "li", "table"]
        assert blocks[1][1] == "國內出差住宿費上限 3,200 元。"          # 粗體標記拿掉
        assert blocks[4][1] == [["部門", "預算"], ["業務部", "1,200,000"], ["人資部", "007"]]  # 分隔線那一列不算

    def test_empty_and_code_fences(self):
        assert office_bridge.parse_markdown("") == []
        assert office_bridge.parse_markdown("```python\nprint(1)\n```") == [("p", "print(1)")]

    def test_cell_values(self):
        """數字存成數字；開頭 0 的編號維持文字；公式開頭的字不會被 Excel 執行"""
        assert office_bridge._value("1,200,000") == 1200000
        assert office_bridge._value("350000.5") == 350000.5
        assert office_bridge._value("-12") == -12
        assert office_bridge._value("007") == "'007"
        assert office_bridge._value("=SUM(A1)") == "'=SUM(A1)"
        assert office_bridge._value("+886912345678") == "'+886912345678"
        assert office_bridge._value("@cmd") == "'@cmd"
        assert office_bridge._value("-待確認") == "'-待確認"
        assert office_bridge._value("業務部") == "業務部"

    def test_read_text_is_clipped(self):
        text, truncated = office_bridge._clip("字" * (office_bridge.READ_MAX_CHARS + 50))
        assert truncated is True and len(text) == office_bridge.READ_MAX_CHARS
        assert office_bridge._clip("第一行\r第二行\n\n\n\n第三行") == ("第一行\n第二行\n\n第三行", False)

    def test_open_file_rejects_other_file_types_before_touching_office(self):
        pytest.importorskip("pythoncom", reason="操控 Office 的執行緒需要 pywin32（只有 Windows 有）")
        assert office_bridge.open_file("a.exe", "UEs=")["ok"] is False
        assert office_bridge.open_file("a.docx", "aGVsbG8=")["ok"] is False          # 內容不是 Office 檔
        assert office_bridge.open_file("../../x.txt", "UEs=")["ok"] is False
        assert office_bridge.open_file("a.docx", "不是 base64!!")["ok"] is False

    def test_unknown_app_is_rejected(self):
        pytest.importorskip("pythoncom", reason="操控 Office 的執行緒需要 pywin32（只有 Windows 有）")
        assert office_bridge.read("notepad") == {"ok": False, "error": "不支援的程式"}
        assert office_bridge.write("notepad", "內容") == {"ok": False, "error": "不支援的程式"}


# ═════════════════════════════════════════════════════════════════════════
# 桌面版視窗：網址來源的比對（需要 pywebview；沒有安裝就略過）
# ═════════════════════════════════════════════════════════════════════════
class TestDesktopOrigin:
    @pytest.fixture(scope="class")
    def app(self):
        pytest.importorskip("webview", reason="pywebview 只裝在 desktop/.venv")
        import corphia_desktop
        return corphia_desktop

    def test_origin_matches_browser_rules(self, app):
        assert app.origin("http://Server.local:5173/chat?x=1") == "http://server.local:5173"
        assert app.origin("http://server.local:80/") == "http://server.local"       # 預設埠省略
        assert app.origin("https://server.local:443/a") == "https://server.local"
        assert app.origin("https://server.local:8443") == "https://server.local:8443"
        assert app.origin("") == "" and app.origin("about:blank") == ""

    def test_lookalike_hosts_are_different_origins(self, app):
        server = app.origin("http://192.168.1.10:5173")
        for other in ("http://192.168.1.10:5174", "https://192.168.1.10:5173", "http://192.168.1.100:5173", "http://192.168.1.10.evil.example:5173"):
            assert app.origin(other) != server

    def test_normalize_server_and_versions(self, app):
        assert app.normalize_server(" 192.168.1.10:5173/ ") == "http://192.168.1.10:5173"
        assert app.normalize_server("ftp://x") == "" and app.normalize_server("") == ""
        assert app.parse_version("0.10.2") > app.parse_version("0.9.9")
        assert app.parse_version("abc") == ()


# ═════════════════════════════════════════════════════════════════════════
# 桌面版自己啟動／關閉這台電腦的服務（desktop/local_stack.py）
# ═════════════════════════════════════════════════════════════════════════
class TestLocalStack:
    @staticmethod
    def _install(tmp_path: Path) -> Path:
        root = tmp_path / "Corphia"
        (root / "backend").mkdir(parents=True)
        (root / "start.py").write_text("")
        (root / "stop.py").write_text("")
        (root / "desktop" / "dist").mkdir(parents=True)
        return root

    def test_finds_install_above_the_exe(self, tmp_path):
        import local_stack
        root = self._install(tmp_path)
        assert local_stack.find_install_dir(root / "desktop" / "dist" / "Corphia AI.exe") == root

    def test_exe_alone_is_not_an_install(self, tmp_path):
        """只拿到一個 exe（連公司伺服器用的情況）：不是完整安裝，不會自己啟動任何東西"""
        import local_stack
        lone = tmp_path / "Downloads"
        lone.mkdir()
        assert local_stack.find_install_dir(lone / "Corphia AI.exe") is None

    @pytest.mark.parametrize("url,expected", [
        ("http://localhost:5173", True),
        ("http://127.0.0.1:5173", True),
        ("http://LOCALHOST:5173", True),
        ("http://192.168.1.10:5173", False),
        ("http://localhost.evil.example:5173", False),
        ("", False),
    ])
    def test_only_this_computer_counts_as_local(self, url, expected):
        import local_stack
        assert local_stack.is_local_server(url) is expected

    def test_clean_env_drops_packaged_app_variables(self):
        import local_stack
        env = local_stack.clean_env({"PATH": "x", "_PYI_ARCHIVE_FILE": "a", "_MEIPASS2": "b"})
        assert env == {"PATH": "x", "PYTHONIOENCODING": "utf-8"}

    def test_already_running_services_are_not_owned_or_stopped(self, tmp_path, monkeypatch):
        """使用者原本就用一鍵啟動開著：桌面版不重複啟動，關視窗時也不能把它關掉"""
        import local_stack
        calls = []
        monkeypatch.setattr(local_stack.subprocess, "Popen", lambda *a, **k: calls.append(a))
        stack = local_stack.LocalStack(self._install(tmp_path), lambda: True)
        stack.start()
        stack.stop()
        assert stack.owned is False and calls == []
        assert stack.state() == {"phase": "ready"}

    def test_reports_error_with_log_tail_when_launcher_exits(self, tmp_path, monkeypatch):
        import local_stack
        root = self._install(tmp_path)

        class Dead:
            pid = 1

            def poll(self):
                return 1

        monkeypatch.setattr(local_stack, "find_python", lambda _i: "python")
        monkeypatch.setattr(local_stack.subprocess, "Popen", lambda *a, **k: Dead())
        stack = local_stack.LocalStack(root, lambda: False)
        stack.start()
        stack._log.write("第一行\n[FAIL] 資料庫沒有啟動\n")
        stack._log.flush()
        state = stack.state()
        assert stack.owned is True
        assert state["phase"] == "error" and "資料庫沒有啟動" in state["detail"]
        stack._log.close()
