"""
員工安裝包（services/desktop_package.py、GET /api/v1/desktop/package）＋桌面版自動連線（desktop/host_config.py）

主機產生的設定檔，桌面版要讀得懂；桌面版只連「用附的發證憑證驗得過」的主機，冒充的不連。
"""

import io
import json
import ssl
import sys
import zipfile
from pathlib import Path

import pytest

from app.core import lan_tls, web_ui
from app.services import desktop_package

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "desktop"))

import host_config  # noqa: E402
import host_trust  # noqa: E402


@pytest.fixture
def tls(tmp_path, monkeypatch):
    """臨時的主機憑證資料夾（不碰真正的 .runtime/tls）"""
    folder = tmp_path / "tls"
    lan_tls.ensure_certificates(["192.168.1.10"], hostname="corphia-host", folder=folder)
    monkeypatch.setattr(lan_tls, "ca_path", lambda folder_=folder: folder_ / "ca.pem")
    monkeypatch.setattr(lan_tls, "ca_fingerprint", lambda folder_=folder: _fp(folder_))
    return folder


def _fp(folder: Path) -> str:
    der = ssl.PEM_cert_to_DER_cert((folder / "ca.pem").read_text(encoding="ascii"))
    return host_trust.fingerprint(der)


class TestHostConfig:
    def test_hostname_first_then_ips_without_duplicates(self):
        assert desktop_package.host_servers("https", 8443, ["192.168.1.10", "192.168.1.10"], "Corphia-Host") == [
            "https://corphia-host:8443", "https://192.168.1.10:8443"]

    def test_dev_mode_has_no_config(self):
        assert desktop_package.current_config(None, ["192.168.1.10"], "h") is None

    def test_encrypted_host_includes_ca_and_matching_fingerprint(self, tls):
        cfg = desktop_package.current_config({"scheme": "https", "port": 8443}, ["192.168.1.10"], "corphia-host")
        assert cfg["servers"][0] == "https://corphia-host:8443"
        assert "BEGIN CERTIFICATE" in cfg["ca_pem"]
        assert cfg["fingerprint"] == _fp(tls)
        assert "PRIVATE KEY" not in json.dumps(cfg)  # 私鑰絕不能進安裝包

    def test_desktop_reads_what_the_host_writes(self, tls):
        cfg = desktop_package.current_config({"scheme": "https", "port": 8443}, ["192.168.1.10"], "corphia-host")
        parsed = host_config.parse(json.dumps(cfg))
        assert parsed["servers"] == cfg["servers"] and parsed["ca_pem"] == cfg["ca_pem"]

    def test_zip_contains_exe_config_and_guide(self, tmp_path):
        exe = tmp_path / "Corphia AI.exe"
        exe.write_bytes(b"MZ fake exe")
        data = desktop_package.build_zip(exe, {"servers": ["http://h:8168"]}, "pkg")
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            names = set(z.namelist())
            assert names == {"pkg/Corphia AI.exe", "pkg/corphia-host.json", "pkg/使用說明.txt"}
            assert z.read("pkg/Corphia AI.exe") == b"MZ fake exe"


class TestPackageEndpoint:
    """直接呼叫端點函式（不經過資料庫：這個端點本來就不用登入）"""

    async def test_needs_host_mode(self, monkeypatch, tmp_path):
        from fastapi import HTTPException
        from app.api import desktop as api_desktop
        exe = tmp_path / "Corphia AI.exe"
        exe.write_bytes(b"MZ")
        monkeypatch.setattr(api_desktop, "_exe_path", lambda: exe)
        monkeypatch.setattr(web_ui, "LAN_ENDPOINT", None)
        with pytest.raises(HTTPException) as e:
            await api_desktop.download_package()
        assert e.value.status_code == 409

    async def test_returns_zip_in_host_mode(self, monkeypatch, tmp_path, tls):
        from app.api import desktop as api_desktop, system_monitor
        exe = tmp_path / "Corphia AI.exe"
        exe.write_bytes(b"MZ")
        monkeypatch.setattr(api_desktop, "_exe_path", lambda: exe)
        monkeypatch.setattr(web_ui, "LAN_ENDPOINT", {"scheme": "https", "port": 8443})
        monkeypatch.setattr(system_monitor, "_detect_lan_ips", lambda: ["192.168.1.10"])
        r = await api_desktop.download_package()
        assert r.media_type == "application/zip" and "attachment" in r.headers["content-disposition"]
        with zipfile.ZipFile(io.BytesIO(r.body)) as z:
            cfg = json.loads(next(z.read(n) for n in z.namelist() if n.endswith("corphia-host.json")))
        assert "https://192.168.1.10:8443" in cfg["servers"] and cfg["fingerprint"] == _fp(tls)


class _Trust:
    """假的 HostTrust：記下存了哪張憑證"""
    def __init__(self):
        self.pem = ""
        self.fingerprint = ""
        self.saved = []

    def save(self, pem):
        self.pem = pem
        self.saved.append(pem)

    def install_opener(self):
        pass


class TestDesktopAutoConnect:

    def _cfg(self, tls, servers):
        return {"servers": servers, "ca_pem": (tls / "ca.pem").read_text(encoding="ascii")}

    def test_connects_to_first_verified_server(self, tls):
        trust = _Trust()
        cfg = self._cfg(tls, ["https://corphia-host:8443", "https://192.168.1.10:8443"])
        def verify(host, port, pem):
            return b"leaf" if host == "192.168.1.10" else None  # 電腦名稱解析不到
        url = host_config.connect(cfg, trust, reachable=lambda u: True, verify=verify)
        assert url == "https://192.168.1.10:8443"
        assert trust.saved == [cfg["ca_pem"]]

    def test_impostor_is_never_trusted(self, tls):
        """同網段有人冒充主機：拿不出主機發證憑證簽的伺服器憑證 → 驗不過，不連、也不記住任何憑證"""
        trust = _Trust()
        cfg = self._cfg(tls, ["https://192.168.1.10:8443"])
        url = host_config.connect(cfg, trust, reachable=lambda u: True, verify=lambda h, p, pem: None)
        assert url == "" and trust.saved == []

    def test_real_tls_check_accepts_host_and_rejects_impostor(self, tls, tmp_path):
        """真的開一個加密連線來驗：主機自己的發證憑證驗得過；換成別台（另一張發證憑證）就驗不過"""
        import socket
        import threading

        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(tls / "server.pem", tls / "server.key")
        srv = socket.socket()
        srv.bind(("127.0.0.1", 0))
        srv.listen(4)
        port = srv.getsockname()[1]

        def serve():
            for _ in range(2):
                try:
                    conn, _addr = srv.accept()
                    with ctx.wrap_socket(conn, server_side=True):
                        pass
                except (OSError, ssl.SSLError):
                    pass

        t = threading.Thread(target=serve, daemon=True)
        t.start()
        try:
            other = tmp_path / "other"
            lan_tls.ensure_certificates([], hostname="x", folder=other)
            assert host_trust.verified_leaf("127.0.0.1", port, (tls / "ca.pem").read_text()) is not None
            assert host_trust.verified_leaf("127.0.0.1", port, (other / "ca.pem").read_text()) is None
        finally:
            srv.close()
            t.join(timeout=5)

    def test_tampered_fingerprint_is_rejected(self, tls):
        text = json.dumps({"servers": ["https://h:8443"], "ca_pem": (tls / "ca.pem").read_text(), "fingerprint": "AA:BB"})
        assert host_config.parse(text) is None

    def test_https_without_ca_is_rejected(self):
        assert host_config.parse(json.dumps({"servers": ["https://h:8443"]})) is None

    def test_only_plain_host_urls_are_accepted(self, tls):
        cfg = host_config.parse(json.dumps({"servers": ["https://h:8443/evil?x=1", "javascript:alert(1)", "http://h:8168"],
                                            "ca_pem": (tls / "ca.pem").read_text()}))
        assert cfg["servers"] == ["http://h:8168"]

    def test_load_reads_file_next_to_exe(self, tls, tmp_path):
        (tmp_path / host_config.FILE_NAME).write_text(json.dumps({"servers": ["http://h:8168"]}), encoding="utf-8")
        assert host_config.load(tmp_path)["servers"] == ["http://h:8168"]
        assert host_config.load(tmp_path / "missing") is None
