"""
桌面版信任主機的憑證 (host_trust.py)

主機的區網加密憑證是它自己簽的（backend/app/core/lan_tls.py），Windows 不認得。
桌面版不去改 Windows 的系統設定，而是自己記住「這台主機的發證憑證」：

  第一次連線   下載主機的發證憑證 → 用它真的驗一次這條連線（證明對方手上有對應的私鑰）→
               把指紋顯示給使用者核對（主機的管理後台「區域網路」看得到同一串）→ 使用者確認後存起來。
  之後每次     只接受「用這張發證憑證驗得過」的伺服器憑證；別台機器冒充、或中間有人攔截都會被擋下。
               主機換 IP 重發伺服器憑證不用重新確認（發證憑證沒變）。

存在 %APPDATA%\\CorphiaAI\\host-ca.pem（只有公開的那一半，不是秘密）。
這個檔案只用 Python 內建的功能，不依賴桌面視窗，方便單獨測試。
"""

from __future__ import annotations

import hashlib
import logging
import os
import socket
import ssl
import urllib.request
from pathlib import Path
from typing import Optional
from urllib.parse import urlsplit

logger = logging.getLogger("corphia.desktop")

# 主機提供發證憑證的路徑（backend/app/core/web_ui.py）
CA_URL_PATH = "/lan-ca.crt"
PROBE_TIMEOUT = 5
# 發證憑證檔案的大小上限：正常不到 1 KB，超過就不是憑證
CA_MAX_BYTES = 16 * 1024


def ca_file() -> Path:
    return Path(os.environ.get("APPDATA") or Path.home()) / "CorphiaAI" / "host-ca.pem"


def fingerprint(der: bytes) -> str:
    """憑證指紋（SHA-256，兩個字一組用冒號隔開），和主機管理後台顯示的格式一樣"""
    digest = hashlib.sha256(der).hexdigest().upper()
    return ":".join(digest[i:i + 2] for i in range(0, len(digest), 2))


def context_for(ca_pem: str) -> ssl.SSLContext:
    """只信任這一張發證憑證的連線設定（系統內建的憑證機構都不算），而且要核對主機位址"""
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.load_verify_locations(cadata=ca_pem)
    return ctx


def verified_leaf(host: str, port: int, ca_pem: str, timeout: float = PROBE_TIMEOUT) -> Optional[bytes]:
    """
    用這張發證憑證真的連一次、驗一次：驗得過（簽章對、位址對、沒過期）回對方的伺服器憑證，驗不過或連不上回 None。
    """
    try:
        with socket.create_connection((host, port), timeout=timeout) as raw:
            with context_for(ca_pem).wrap_socket(raw, server_hostname=host) as conn:
                return conn.getpeercert(binary_form=True)
    except (OSError, ssl.SSLError, ValueError):
        return None


def fetch_ca(url: str, timeout: float = PROBE_TIMEOUT) -> Optional[bytes]:
    """
    跟主機要它的發證憑證。這一步還沒有東西可以驗（第一次見面），所以拿回來的只是「對方自稱的」，
    一定要再經過 probe() 的實際驗證和使用者核對指紋才會被信任。
    """
    unverified = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    unverified.check_hostname = False
    unverified.verify_mode = ssl.CERT_NONE
    try:
        with urllib.request.urlopen(url.rstrip("/") + CA_URL_PATH, timeout=timeout, context=unverified) as r:
            data = r.read(CA_MAX_BYTES + 1)
    except Exception:
        return None
    return data if 0 < len(data) <= CA_MAX_BYTES else None


def probe(url: str) -> Optional[dict]:
    """
    第一次連一台加密的主機：回 {"pem", "fingerprint"} 給使用者核對；不是 https、拿不到憑證、
    或這張憑證驗不過這條連線（對方沒有對應的私鑰）都回 None。
    """
    parts = urlsplit(url)
    if parts.scheme != "https" or not parts.hostname:
        return None
    der = fetch_ca(url)
    if not der:
        return None
    try:
        pem = ssl.DER_cert_to_PEM_cert(der)
        port = parts.port or 443
    except ValueError:
        return None
    if verified_leaf(parts.hostname, port, pem) is None:
        return None
    return {"pem": pem, "fingerprint": fingerprint(der)}


class HostTrust:
    """已經信任的主機發證憑證；沒有就什麼都不放行"""

    def __init__(self, path: Optional[Path] = None):
        self._path = path or ca_file()
        self._pem = ""
        self._allowed: set[tuple[str, int, bytes]] = set()
        self.reload()

    def reload(self) -> None:
        try:
            self._pem = self._path.read_text(encoding="ascii")
            ssl.PEM_cert_to_DER_cert(self._pem)  # 格式不對就當沒有
        except (OSError, ValueError, UnicodeDecodeError):
            self._pem = ""
        self._allowed.clear()

    def save(self, pem: str) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(pem, encoding="ascii")
        self.reload()

    @property
    def fingerprint(self) -> str:
        return fingerprint(ssl.PEM_cert_to_DER_cert(self._pem)) if self._pem else ""

    def context(self) -> Optional[ssl.SSLContext]:
        return context_for(self._pem) if self._pem else None

    def allows(self, host: str, port: int, leaf_der: bytes) -> bool:
        """
        視窗裡的瀏覽器遇到「不認得的憑證」時問這裡：這張伺服器憑證是不是我們信任的主機簽的？
        做法：用記住的發證憑證自己連同一個位址驗一次，驗得過、而且對方出示的就是同一張憑證才放行。
        """
        if not self._pem or not host or not leaf_der:
            return False
        key = (host.lower(), port, leaf_der)
        if key in self._allowed:
            return True
        ok = verified_leaf(host, port, self._pem) == leaf_der
        if ok:
            self._allowed.add(key)
        else:
            logger.warning("擋下不是信任的主機簽的憑證：%s:%s", host, port)
        return ok

    def install_opener(self) -> None:
        """桌面版自己發的請求（確認主機在不在、查更新、下載更新）也只信任這張發證憑證"""
        ctx = self.context()
        handlers = [urllib.request.HTTPSHandler(context=ctx)] if ctx else []
        urllib.request.install_opener(urllib.request.build_opener(*handlers))
