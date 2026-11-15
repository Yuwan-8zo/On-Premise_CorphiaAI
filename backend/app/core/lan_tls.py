"""
區網加密用的憑證 (lan_tls.py)

公司其他電腦、手機連到主機時走加密連線（HTTPS），同一個網路上的人看不到對話內容和登入資料。
主機沒有對外的網域名稱，沒辦法跟公開的憑證機構申請憑證，所以由主機自己簽：

  發證憑證（ca.pem／ca.key）   第一次啟動時產生，長期有效。桌面版記住它的指紋、手機可以安裝它一次，
                              之後主機換 IP 重發伺服器憑證都不用再設定。
  伺服器憑證（server.pem／key）用發證憑證簽，寫著主機現在的區網 IP 和電腦名稱。
                              IP 變了（換網路、DHCP 重配）、或快到期，啟動時自動重發。

檔案放在 .runtime/tls/（不進版本控制）。私鑰只有這台主機有，不會經過網路。
"""

from __future__ import annotations

import datetime as dt
import hashlib
import ipaddress
import logging
import socket
from pathlib import Path
from typing import Iterable, Optional

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parents[3]
TLS_DIR = PROJECT_ROOT / ".runtime" / "tls"

CA_NAME = "Corphia AI 區網憑證"
CA_VALID_DAYS = 3650
# 伺服器憑證的效期：Apple 的裝置不接受超過 398 天的伺服器憑證
SERVER_VALID_DAYS = 397
# 剩不到這麼多天就重發
RENEW_BEFORE_DAYS = 30
# 一定寫進伺服器憑證的名字（主機自己連自己）
ALWAYS_NAMES = ("localhost",)
ALWAYS_IPS = ("127.0.0.1", "::1")


def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def _write_private(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    try:
        path.chmod(0o600)  # Windows 上只是盡量做；資料夾本身在使用者自己的安裝目錄裡
    except OSError:
        pass


def _key_pem(key: ec.EllipticCurvePrivateKey) -> bytes:
    return key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())


def _load_cert(path: Path) -> Optional[x509.Certificate]:
    try:
        return x509.load_pem_x509_certificate(path.read_bytes())
    except (OSError, ValueError):
        return None


def _load_key(path: Path) -> Optional[ec.EllipticCurvePrivateKey]:
    try:
        key = serialization.load_pem_private_key(path.read_bytes(), password=None)
    except (OSError, ValueError, TypeError):
        return None
    return key if isinstance(key, ec.EllipticCurvePrivateKey) else None


def _ensure_ca(folder: Path) -> tuple[x509.Certificate, ec.EllipticCurvePrivateKey]:
    """發證憑證：有就沿用（裝置已經信任它了，不能亂換），沒有、壞了或過期才重做"""
    cert, key = _load_cert(folder / "ca.pem"), _load_key(folder / "ca.key")
    if cert and key and cert.not_valid_after_utc > _now():
        return cert, key
    key = ec.generate_private_key(ec.SECP256R1())
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, f"{CA_NAME}（{socket.gethostname()}）")])
    cert = (
        x509.CertificateBuilder()
        .subject_name(name).issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(_now() - dt.timedelta(days=1))
        .not_valid_after(_now() + dt.timedelta(days=CA_VALID_DAYS))
        # 只能拿來簽伺服器憑證、不能再往下發別的發證憑證
        .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
        .add_extension(x509.KeyUsage(
            digital_signature=True, key_cert_sign=True, crl_sign=True, content_commitment=False, key_encipherment=False,
            data_encipherment=False, key_agreement=False, encipher_only=False, decipher_only=False), critical=True)
        .add_extension(x509.SubjectKeyIdentifier.from_public_key(key.public_key()), critical=False)
        .sign(key, hashes.SHA256())
    )
    _write_private(folder / "ca.key", _key_pem(key))
    (folder / "ca.pem").write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    logger.info("已產生區網發證憑證：%s", folder / "ca.pem")
    return cert, key


def wanted_names(ips: Iterable[str], hostname: str = "") -> tuple[set[str], set[str]]:
    """伺服器憑證該寫的（名字, IP）：主機現在的區網 IP、電腦名稱，加上一定要有的本機位址"""
    names = {n for n in (*ALWAYS_NAMES, (hostname or "").strip().lower()) if n}
    addrs: set[str] = set()
    for raw in (*ALWAYS_IPS, *ips):
        try:
            addrs.add(str(ipaddress.ip_address(raw)))
        except ValueError:
            continue
    return names, addrs


def _covers(cert: x509.Certificate, ca: x509.Certificate, names: set[str], addrs: set[str]) -> bool:
    """現有的伺服器憑證還能不能用：同一張發證憑證簽的、還沒快到期、現在的名字和 IP 都寫在上面"""
    if cert.issuer != ca.subject or cert.not_valid_after_utc - _now() < dt.timedelta(days=RENEW_BEFORE_DAYS):
        return False
    try:
        san = cert.extensions.get_extension_for_class(x509.SubjectAlternativeName).value
        aki = cert.extensions.get_extension_for_class(x509.AuthorityKeyIdentifier).value
        ski = ca.extensions.get_extension_for_class(x509.SubjectKeyIdentifier).value
    except x509.ExtensionNotFound:
        return False
    if aki.key_identifier != ski.digest:
        return False  # 發證憑證重做過：舊的伺服器憑證不是它簽的
    have_names = {n.lower() for n in san.get_values_for_type(x509.DNSName)}
    have_addrs = {str(a) for a in san.get_values_for_type(x509.IPAddress)}
    return names <= have_names and addrs <= have_addrs


def ensure_certificates(ips: Iterable[str], hostname: Optional[str] = None, folder: Path = TLS_DIR) -> tuple[Path, Path]:
    """
    準備好區網加密要用的憑證，回傳（伺服器憑證含發證憑證, 伺服器私鑰）的路徑，可以直接交給網頁伺服器。
    伺服器憑證只在需要時重發（沒有、IP 或電腦名稱變了、快到期、發證憑證換了）。
    """
    hostname = socket.gethostname() if hostname is None else hostname
    ca_cert, ca_key = _ensure_ca(folder)
    names, addrs = wanted_names(ips, hostname)
    cert_path, key_path = folder / "server.pem", folder / "server.key"
    current = _load_cert(cert_path)
    if current and _load_key(key_path) and _covers(current, ca_cert, names, addrs):
        return cert_path, key_path

    key = ec.generate_private_key(ec.SECP256R1())
    san = [x509.DNSName(n) for n in sorted(names)] + [x509.IPAddress(ipaddress.ip_address(a)) for a in sorted(addrs)]
    cert = (
        x509.CertificateBuilder()
        .subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, hostname or "corphia-host")]))
        .issuer_name(ca_cert.subject)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(_now() - dt.timedelta(days=1))
        .not_valid_after(_now() + dt.timedelta(days=SERVER_VALID_DAYS))
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .add_extension(x509.SubjectAlternativeName(san), critical=False)
        .add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]), critical=False)
        .add_extension(x509.KeyUsage(
            digital_signature=True, key_cert_sign=False, crl_sign=False, content_commitment=False, key_encipherment=False,
            data_encipherment=False, key_agreement=False, encipher_only=False, decipher_only=False), critical=True)
        .add_extension(x509.AuthorityKeyIdentifier.from_issuer_public_key(ca_key.public_key()), critical=False)
        .sign(ca_key, hashes.SHA256())
    )
    _write_private(key_path, _key_pem(key))
    # 伺服器憑證後面接著發證憑證：連線時一起送給對方，對方只要信任發證憑證就驗得過
    cert_path.write_bytes(cert.public_bytes(serialization.Encoding.PEM) + ca_cert.public_bytes(serialization.Encoding.PEM))
    logger.info("已發出區網伺服器憑證（%s）", "、".join(sorted(names | addrs)))
    return cert_path, key_path


def ca_path(folder: Path = TLS_DIR) -> Path:
    return folder / "ca.pem"


def ca_der(folder: Path = TLS_DIR) -> Optional[bytes]:
    """發證憑證（給裝置安裝用的格式）；還沒產生回 None"""
    cert = _load_cert(ca_path(folder))
    return cert.public_bytes(serialization.Encoding.DER) if cert else None


def ca_fingerprint(folder: Path = TLS_DIR) -> str:
    """發證憑證的指紋（SHA-256，兩個字一組用冒號隔開）：給人核對「裝的是不是這台主機的憑證」；還沒產生回空字串"""
    der = ca_der(folder)
    if not der:
        return ""
    digest = hashlib.sha256(der).hexdigest().upper()
    return ":".join(digest[i:i + 2] for i in range(0, len(digest), 2))


__all__ = ["TLS_DIR", "ensure_certificates", "wanted_names", "ca_path", "ca_der", "ca_fingerprint"]
