"""
不靠 Docker 的原生 PostgreSQL（scripts/setup_postgres.py）

只測純邏輯部分：找 bin/ 目錄（處理 EDB zip 多一層 pgsql/ 的情況）、判斷「裝好了沒」，
以及 start.py／stop.py 怎麼決定走原生還是 Docker。不測真的下載、initdb、pg_ctl 執行
（那些需要真的網路和真的 PostgreSQL 執行檔，屬於人工跑一次 setup_postgres.py 的範疇）。
"""

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))

import setup_postgres  # noqa: E402
import start  # noqa: E402
import stop  # noqa: E402


# ═════════════════════════════════════════════════════════════════════════
# 找 bin/ 目錄：EDB 的 zip 解開後可能多一層 pgsql/
# ═════════════════════════════════════════════════════════════════════════
class TestPgBinDir:
    def test_finds_direct_bin(self, tmp_path, monkeypatch):
        install_dir = tmp_path / "postgresql"
        bin_dir = install_dir / "bin"
        bin_dir.mkdir(parents=True)
        (bin_dir / "pg_ctl.exe").write_bytes(b"")
        monkeypatch.setattr(setup_postgres, "PG_INSTALL_DIR", install_dir)

        assert setup_postgres.pg_bin_dir() == bin_dir

    def test_finds_nested_pgsql_bin(self, tmp_path, monkeypatch):
        install_dir = tmp_path / "postgresql"
        bin_dir = install_dir / "pgsql" / "bin"
        bin_dir.mkdir(parents=True)
        (bin_dir / "pg_ctl.exe").write_bytes(b"")
        monkeypatch.setattr(setup_postgres, "PG_INSTALL_DIR", install_dir)

        assert setup_postgres.pg_bin_dir() == bin_dir

    def test_none_when_not_installed(self, tmp_path, monkeypatch):
        monkeypatch.setattr(setup_postgres, "PG_INSTALL_DIR", tmp_path / "nothing-here")
        assert setup_postgres.pg_bin_dir() is None

    def test_none_when_bin_dir_exists_but_no_exe(self, tmp_path, monkeypatch):
        install_dir = tmp_path / "postgresql"
        (install_dir / "bin").mkdir(parents=True)
        monkeypatch.setattr(setup_postgres, "PG_INSTALL_DIR", install_dir)
        assert setup_postgres.pg_bin_dir() is None


# ═════════════════════════════════════════════════════════════════════════
# 「裝好了沒」：要同時有 bin/ 和已經 initdb 過的資料目錄
# ═════════════════════════════════════════════════════════════════════════
class TestNativePostgresReady:
    def _with_bin(self, tmp_path, monkeypatch):
        install_dir = tmp_path / "postgresql"
        bin_dir = install_dir / "bin"
        bin_dir.mkdir(parents=True)
        (bin_dir / "pg_ctl.exe").write_bytes(b"")
        monkeypatch.setattr(setup_postgres, "PG_INSTALL_DIR", install_dir)

    def test_false_when_only_binaries_installed(self, tmp_path, monkeypatch):
        self._with_bin(tmp_path, monkeypatch)
        monkeypatch.setattr(setup_postgres, "PGDATA_DIR", tmp_path / "pgdata-not-initialized")
        assert setup_postgres.native_postgres_ready() is False

    def test_true_when_both_present(self, tmp_path, monkeypatch):
        self._with_bin(tmp_path, monkeypatch)
        pgdata = tmp_path / "pgdata"
        pgdata.mkdir()
        (pgdata / "PG_VERSION").write_text("16")
        monkeypatch.setattr(setup_postgres, "PGDATA_DIR", pgdata)
        assert setup_postgres.native_postgres_ready() is True

    def test_false_when_binaries_missing(self, tmp_path, monkeypatch):
        monkeypatch.setattr(setup_postgres, "PG_INSTALL_DIR", tmp_path / "no-binaries")
        pgdata = tmp_path / "pgdata"
        pgdata.mkdir()
        (pgdata / "PG_VERSION").write_text("16")
        monkeypatch.setattr(setup_postgres, "PGDATA_DIR", pgdata)
        assert setup_postgres.native_postgres_ready() is False


# ═════════════════════════════════════════════════════════════════════════
# start.py：原生已就緒就不碰 Docker；沒就緒才落到既有的 Docker 流程
# ═════════════════════════════════════════════════════════════════════════
class TestStartUsesNativeFirst:
    def test_start_database_skips_docker_when_native_ready(self, monkeypatch):
        monkeypatch.setattr(start, "native_postgres_ready", lambda: True)
        monkeypatch.setattr(start, "pg_bin_dir", lambda: Path("C:/fake/bin"))
        monkeypatch.setattr(start, "run", lambda *a, **k: type("R", (), {"returncode": 0, "stdout": "", "stderr": ""})())
        monkeypatch.setattr(start, "wait_for_tcp", lambda *a, **k: True)

        docker_called = []
        monkeypatch.setattr(start, "start_docker_desktop", lambda: docker_called.append(True))

        start.start_database()
        assert docker_called == [], "原生就緒時完全不該去碰 Docker Desktop"

    def test_start_database_falls_back_to_docker_when_native_not_ready(self, monkeypatch):
        monkeypatch.setattr(start, "native_postgres_ready", lambda: False)
        docker_called = []
        monkeypatch.setattr(start, "start_docker_desktop", lambda: docker_called.append(True))
        # 讓後面真的找 docker compose 的部分失敗得乾淨（沒有 docker 可執行檔）
        monkeypatch.setattr(start.shutil, "which", lambda name: None)

        with pytest.raises(RuntimeError):
            start.start_database()
        assert docker_called == [True], "原生沒裝好時應該落回既有的 Docker 流程"

    def test_native_database_returns_false_without_raising_when_not_ready(self, monkeypatch):
        monkeypatch.setattr(start, "native_postgres_ready", lambda: False)
        assert start.start_native_database() is False


# ═════════════════════════════════════════════════════════════════════════
# stop.py：原生就緒時用 pg_ctl 關；不管有沒有裝原生，Docker 那段都要能安全地跳過
# ═════════════════════════════════════════════════════════════════════════
class TestStopUsesNativeFirst:
    def test_stop_native_database_calls_pg_ctl_when_ready(self, monkeypatch):
        monkeypatch.setattr(stop, "native_postgres_ready", lambda: True)
        bin_dir = Path("C:/fake/bin")
        monkeypatch.setattr(stop, "pg_bin_dir", lambda: bin_dir)

        calls = []
        monkeypatch.setattr(stop, "run", lambda cmd, **k: calls.append(cmd))

        stop.stop_native_database()
        assert calls, "原生就緒時應該呼叫 pg_ctl 關閉"
        assert "pg_ctl.exe" in calls[0][0]
        assert "stop" in calls[0]

    def test_stop_native_database_noop_when_not_installed(self, monkeypatch):
        monkeypatch.setattr(stop, "native_postgres_ready", lambda: False)
        calls = []
        monkeypatch.setattr(stop, "run", lambda cmd, **k: calls.append(cmd))

        stop.stop_native_database()
        assert calls == [], "沒裝原生時不該嘗試呼叫任何 pg_ctl"
