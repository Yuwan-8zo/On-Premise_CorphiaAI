"""
區網加密的憑證 (test_lan_tls.py)

- 第一次產生發證憑證＋伺服器憑證；之後沿用，不會每次啟動都換（裝置才不用重新信任）
- 主機 IP 變了只重發伺服器憑證，發證憑證不變
- 真的用這組憑證開一個加密連線：信任發證憑證的用戶端連得上、不信任的連不上
"""
import datetime as dt
import socket
import ssl
import threading

import pytest
from cryptography import x509

import app.core.lan_tls as lan_tls


def _server_cert(path) -> x509.Certificate:
    return x509.load_pem_x509_certificates(path.read_bytes())[0]


def _san(cert: x509.Certificate) -> tuple[set[str], set[str]]:
    san = cert.extensions.get_extension_for_class(x509.SubjectAlternativeName).value
    return set(san.get_values_for_type(x509.DNSName)), {str(a) for a in san.get_values_for_type(x509.IPAddress)}


def test_first_run_creates_ca_and_server_certificate(tmp_path):
    cert_path, key_path = lan_tls.ensure_certificates(["192.168.1.10"], hostname="Host-PC", folder=tmp_path)
    ca = x509.load_pem_x509_certificate((tmp_path / "ca.pem").read_bytes())
    cert = _server_cert(cert_path)
    cert.verify_directly_issued_by(ca)  # 不是這張發證憑證簽的會丟例外
    names, addrs = _san(cert)
    assert names == {"localhost", "host-pc"}
    assert addrs == {"127.0.0.1", "::1", "192.168.1.10"}
    assert ca.extensions.get_extension_for_class(x509.BasicConstraints).value.ca is True
    assert cert.extensions.get_extension_for_class(x509.BasicConstraints).value.ca is False
    assert (cert.not_valid_after_utc - cert.not_valid_before_utc).days <= 398, "Apple 的裝置不接受更長的伺服器憑證"
    assert key_path.read_bytes().startswith(b"-----BEGIN PRIVATE KEY-----")
    assert len(x509.load_pem_x509_certificates(cert_path.read_bytes())) == 2, "伺服器憑證後面要接著發證憑證"


def test_same_address_reuses_everything(tmp_path):
    first, _ = lan_tls.ensure_certificates(["192.168.1.10"], hostname="pc", folder=tmp_path)
    before = (first.read_bytes(), (tmp_path / "ca.pem").read_bytes(), lan_tls.ca_fingerprint(tmp_path))
    lan_tls.ensure_certificates(["192.168.1.10"], hostname="pc", folder=tmp_path)
    assert (first.read_bytes(), (tmp_path / "ca.pem").read_bytes(), lan_tls.ca_fingerprint(tmp_path)) == before


def test_new_address_reissues_server_certificate_but_keeps_the_ca(tmp_path):
    cert_path, _ = lan_tls.ensure_certificates(["192.168.1.10"], hostname="pc", folder=tmp_path)
    old_serial, fingerprint = _server_cert(cert_path).serial_number, lan_tls.ca_fingerprint(tmp_path)
    lan_tls.ensure_certificates(["10.0.0.7"], hostname="pc", folder=tmp_path)
    cert = _server_cert(cert_path)
    assert cert.serial_number != old_serial
    assert "10.0.0.7" in _san(cert)[1]
    assert lan_tls.ca_fingerprint(tmp_path) == fingerprint, "發證憑證不能換：裝置已經信任它了"


def test_certificate_close_to_expiry_is_renewed(tmp_path, monkeypatch):
    cert_path, _ = lan_tls.ensure_certificates(["192.168.1.10"], hostname="pc", folder=tmp_path)
    old_serial = _server_cert(cert_path).serial_number
    later = dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=lan_tls.SERVER_VALID_DAYS - lan_tls.RENEW_BEFORE_DAYS + 1)
    monkeypatch.setattr(lan_tls, "_now", lambda: later)
    lan_tls.ensure_certificates(["192.168.1.10"], hostname="pc", folder=tmp_path)
    assert _server_cert(cert_path).serial_number != old_serial


def test_broken_files_are_replaced(tmp_path):
    cert_path, key_path = lan_tls.ensure_certificates(["192.168.1.10"], hostname="pc", folder=tmp_path)
    key_path.write_text("壞掉了", encoding="utf-8")
    lan_tls.ensure_certificates(["192.168.1.10"], hostname="pc", folder=tmp_path)
    ssl.create_default_context(ssl.Purpose.CLIENT_AUTH).load_cert_chain(cert_path, key_path)  # 憑證和私鑰配得起來


def test_invalid_addresses_are_ignored():
    names, addrs = lan_tls.wanted_names(["192.168.1.10", "不是位址", ""], hostname="")
    assert names == {"localhost"} and addrs == {"127.0.0.1", "::1", "192.168.1.10"}


def test_fingerprint_format_and_missing_ca(tmp_path):
    assert lan_tls.ca_fingerprint(tmp_path) == "" and lan_tls.ca_der(tmp_path) is None
    lan_tls.ensure_certificates([], hostname="pc", folder=tmp_path)
    parts = lan_tls.ca_fingerprint(tmp_path).split(":")
    assert len(parts) == 32 and all(len(p) == 2 for p in parts)


def test_real_encrypted_connection_only_for_clients_that_trust_the_ca(tmp_path):
    cert_path, key_path = lan_tls.ensure_certificates([], hostname="pc", folder=tmp_path)
    server_ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    server_ctx.load_cert_chain(cert_path, key_path)
    listener = socket.create_server(("127.0.0.1", 0))
    port = listener.getsockname()[1]

    def serve():
        for _ in range(2):
            try:
                raw, _addr = listener.accept()
                with server_ctx.wrap_socket(raw, server_side=True) as conn:
                    conn.sendall(b"ok")
            except (ssl.SSLError, OSError):
                pass  # 不信任的那一次會在這裡失敗

    thread = threading.Thread(target=serve, daemon=True)
    thread.start()
    try:
        trusting = ssl.create_default_context(cafile=str(lan_tls.ca_path(tmp_path)))
        with socket.create_connection(("127.0.0.1", port), timeout=5) as raw:
            with trusting.wrap_socket(raw, server_hostname="127.0.0.1") as conn:
                assert conn.recv(2) == b"ok"
                assert conn.version() in ("TLSv1.2", "TLSv1.3")
        with socket.create_connection(("127.0.0.1", port), timeout=5) as raw:
            with pytest.raises(ssl.SSLCertVerificationError):
                ssl.create_default_context().wrap_socket(raw, server_hostname="127.0.0.1")
    finally:
        thread.join(timeout=5)
        listener.close()


# ── 開哪些埠 (run_server.plan) ───────────────────────────────────────────────

def test_dev_mode_listens_on_this_computer_only():
    import run_server
    assert run_server.plan(8168, built=False, lan_https=True, https_port=8443, certificate=("c", "k")) == [dict(host="127.0.0.1", port=8168)]


def test_host_mode_keeps_plain_port_local_and_encrypts_the_lan():
    import run_server
    plain, secure = run_server.plan(8168, built=True, lan_https=True, https_port=8443, certificate=("c.pem", "k.pem"))
    assert plain == dict(host="127.0.0.1", port=8168), "沒加密的埠只聽這台電腦，區網連不到"
    assert secure["host"] == "0.0.0.0" and secure["port"] == 8443
    assert (secure["ssl_certfile"], secure["ssl_keyfile"]) == ("c.pem", "k.pem")
    assert secure["lifespan"] == "off", "載入模型這些啟動工作只做一次"


@pytest.mark.parametrize("lan_https, certificate", [(False, ("c", "k")), (True, None)])
def test_host_mode_falls_back_to_one_plain_port(lan_https, certificate):
    """關掉加密、或憑證做不出來：退回原本的做法（系統還是要起得來）"""
    import run_server
    assert run_server.plan(8168, built=True, lan_https=lan_https, https_port=8443, certificate=certificate) == [dict(host="0.0.0.0", port=8168)]


# ── 管理後台顯示的區網位址 ───────────────────────────────────────────────────

def test_lan_addresses_follow_the_way_the_host_is_served(monkeypatch):
    import app.api.system_monitor as monitor
    from app.core import web_ui

    monkeypatch.setattr(monitor, "_detect_lan_ips", lambda: ["192.168.1.10"])
    monkeypatch.setattr(lan_tls, "ca_fingerprint", lambda *_a: "AA:BB")

    monkeypatch.setattr(web_ui, "LAN_ENDPOINT", None)  # 開發模式：前端自己組網址
    assert monitor._lan_addresses() == {"lan_ips": ["192.168.1.10"], "lan_urls": [], "encrypted": False, "ca_fingerprint": ""}

    monkeypatch.setattr(web_ui, "LAN_ENDPOINT", {"scheme": "https", "port": 8443})
    assert monitor._lan_addresses() == {
        "lan_ips": ["192.168.1.10"], "lan_urls": ["https://192.168.1.10:8443/"], "encrypted": True, "ca_fingerprint": "AA:BB",
    }

    monkeypatch.setattr(web_ui, "LAN_ENDPOINT", {"scheme": "http", "port": 8168})
    assert monitor._lan_addresses()["lan_urls"] == ["http://192.168.1.10:8168/"]
    assert monitor._lan_addresses()["encrypted"] is False
