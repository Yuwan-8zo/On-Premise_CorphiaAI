"""
桌面版信任主機的憑證 (test_host_trust.py)

用真的加密連線測：開一台用主機憑證的小伺服器，再開一台「冒充的」（自己另外簽憑證、但把真主機的發證憑證拿來給人下載）。
- 第一次連線：拿得到指紋，而且和主機自己算的一樣
- 冒充的主機：拿不到指紋（它沒有對應的私鑰，實際驗證過不了）
- 記住之後：只放行信任的主機出示的那張憑證
"""
import http.server
import ssl
import sys
import threading
from pathlib import Path

import pytest

import app.core.lan_tls as lan_tls

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "desktop"))
import host_trust  # noqa: E402


class _Handler(http.server.BaseHTTPRequestHandler):
    ca_der = b""

    def do_GET(self):
        body = self.ca_der if self.path == host_trust.CA_URL_PATH else b"hello"
        self.send_response(200)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_args):
        pass


def _serve(cert_folder: Path, ca_der: bytes):
    """用 cert_folder 裡的伺服器憑證開一台加密的小伺服器；/lan-ca.crt 回 ca_der"""
    handler = type("Handler", (_Handler,), {"ca_der": ca_der})
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(cert_folder / "server.pem", cert_folder / "server.key")
    server.socket = ctx.wrap_socket(server.socket, server_side=True)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


@pytest.fixture
def hosts(tmp_path):
    real_dir, fake_dir = tmp_path / "real", tmp_path / "fake"
    lan_tls.ensure_certificates([], hostname="host", folder=real_dir)
    lan_tls.ensure_certificates([], hostname="host", folder=fake_dir)
    real = _serve(real_dir, lan_tls.ca_der(real_dir))
    fake = _serve(fake_dir, lan_tls.ca_der(real_dir))  # 冒充：拿真主機的發證憑證給人下載
    yield {
        "real": f"https://127.0.0.1:{real.server_address[1]}", "real_port": real.server_address[1], "real_dir": real_dir,
        "fake": f"https://127.0.0.1:{fake.server_address[1]}", "fake_port": fake.server_address[1],
    }
    real.shutdown()
    fake.shutdown()


def test_first_contact_returns_the_hosts_own_fingerprint(hosts):
    found = host_trust.probe(hosts["real"])
    assert found and found["fingerprint"] == lan_tls.ca_fingerprint(hosts["real_dir"])
    assert found["pem"].startswith("-----BEGIN CERTIFICATE-----")


def test_impostor_serving_someone_elses_ca_is_not_offered_for_trust(hosts):
    assert host_trust.probe(hosts["fake"]) is None


def test_plain_http_and_unreachable_hosts_have_nothing_to_trust():
    assert host_trust.probe("http://127.0.0.1:8168") is None
    assert host_trust.probe("https://127.0.0.1:1") is None


def test_remembered_host_is_allowed_and_everything_else_is_not(hosts, tmp_path):
    trust = host_trust.HostTrust(tmp_path / "saved" / "host-ca.pem")
    real_leaf = ssl.PEM_cert_to_DER_cert(ssl.get_server_certificate(("127.0.0.1", hosts["real_port"])))
    fake_leaf = ssl.PEM_cert_to_DER_cert(ssl.get_server_certificate(("127.0.0.1", hosts["fake_port"])))
    assert not trust.allows("127.0.0.1", hosts["real_port"], real_leaf), "還沒信任任何主機：什麼都不放行"
    assert trust.fingerprint == "" and trust.context() is None

    trust.save(host_trust.probe(hosts["real"])["pem"])
    assert trust.fingerprint == lan_tls.ca_fingerprint(hosts["real_dir"])
    assert trust.allows("127.0.0.1", hosts["real_port"], real_leaf)
    assert not trust.allows("127.0.0.1", hosts["fake_port"], fake_leaf), "別台機器自己簽的憑證"
    assert not trust.allows("127.0.0.1", hosts["real_port"], fake_leaf), "出示的不是主機那一張"
    assert not trust.allows("127.0.0.1", hosts["real_port"], b"")

    again = host_trust.HostTrust(tmp_path / "saved" / "host-ca.pem")  # 重新開啟程式後還記得
    assert again.allows("127.0.0.1", hosts["real_port"], real_leaf)


def test_requests_made_by_the_app_only_trust_the_remembered_host(hosts, tmp_path):
    import urllib.error
    import urllib.request

    trust = host_trust.HostTrust(tmp_path / "host-ca.pem")
    trust.save(host_trust.probe(hosts["real"])["pem"])
    try:
        trust.install_opener()
        assert urllib.request.urlopen(hosts["real"] + "/", timeout=5).read() == b"hello"
        with pytest.raises(urllib.error.URLError):
            urllib.request.urlopen(hosts["fake"] + "/", timeout=5)
    finally:
        urllib.request.install_opener(urllib.request.build_opener())


def test_broken_saved_file_means_no_trust(tmp_path):
    path = tmp_path / "host-ca.pem"
    path.write_text("不是憑證", encoding="utf-8")
    assert host_trust.HostTrust(path).context() is None
