"""
員工安裝包附的主機設定 (host_config.py)

主機的管理者從主機下載「員工安裝包」（backend/app/services/desktop_package.py 產生）：
裡面除了桌面版程式，還有一個 corphia-host.json，寫著
  servers   這台主機的連線位址（電腦名稱優先，再來是各個區網 IP）
  ca_pem    主機的發證憑證（公開的那一半，不是秘密；和主機 /lan-ca.crt 給的是同一張）

員工第一次打開桌面版時，不用打位址、也不用核對指紋：
  逐一試 servers → 用 ca_pem 實際連一次、驗一次（對方要拿得出這張發證憑證簽的伺服器憑證，
  也就是手上要有主機的私鑰）→ 驗得過才記住這張發證憑證和位址。
  同一個網路上有人冒充主機：他沒有主機的私鑰，驗不過，桌面版不會連過去。

設定檔是管理者從主機拿出來、親手發給員工的（隨身碟、公司共用資料夾），
不在網路上自動搜尋主機，因為「找到就相信」會讓同網段的人有機會冒充。

這個檔案只用 Python 內建的功能，不依賴桌面視窗，方便單獨測試。
"""

from __future__ import annotations

import json
import logging
import ssl
from pathlib import Path
from typing import Callable, Optional
from urllib.parse import urlsplit

import host_trust

logger = logging.getLogger("corphia.desktop")

FILE_NAME = "corphia-host.json"
# 設定檔的大小上限：正常不到 4 KB
MAX_BYTES = 64 * 1024
# 最多試幾個位址（電腦名稱＋幾張網卡；太多代表檔案不對）
MAX_SERVERS = 12
DEFAULT_PORTS = {"http": 80, "https": 443}


def _valid_url(url: object) -> str:
    """只收 http(s)://主機[:埠] 這種位址（不能帶路徑、帳密），其他回空字串"""
    if not isinstance(url, str):
        return ""
    url = url.strip().rstrip("/")
    parts = urlsplit(url)
    try:
        parts.port
    except ValueError:
        return ""
    if parts.scheme not in DEFAULT_PORTS or not parts.hostname or parts.username or parts.path or parts.query:
        return ""
    return url


def parse(text: str) -> Optional[dict]:
    """
    讀設定檔內容，回 {"servers": [...], "ca_pem": "..."}；格式不對回 None。
    有寫 fingerprint 的話要和 ca_pem 算出來的一樣（檔案被改過、或抄錯就不用）。
    """
    try:
        data = json.loads(text)
    except ValueError:
        return None
    if not isinstance(data, dict):
        return None
    servers = []
    for raw in data.get("servers") or []:
        url = _valid_url(raw)
        if url and url not in servers:
            servers.append(url)
    servers = servers[:MAX_SERVERS]
    if not servers:
        return None
    ca_pem = data.get("ca_pem") or ""
    if ca_pem:
        try:
            der = ssl.PEM_cert_to_DER_cert(str(ca_pem))
        except ValueError:
            return None
        claimed = str(data.get("fingerprint") or "").strip().upper()
        if claimed and claimed != host_trust.fingerprint(der):
            logger.warning("主機設定檔的指紋和憑證對不上，不使用")
            return None
    elif any(urlsplit(u).scheme == "https" for u in servers):
        return None  # 加密的主機一定要附發證憑證，不然驗不了
    return {"servers": servers, "ca_pem": str(ca_pem)}


def load(folder: Path) -> Optional[dict]:
    """找桌面版程式旁邊的 corphia-host.json；沒有或格式不對回 None"""
    path = folder / FILE_NAME
    try:
        if not path.is_file() or path.stat().st_size > MAX_BYTES:
            return None
        return parse(path.read_text(encoding="utf-8-sig"))
    except OSError:
        return None


def connect(
    config: dict,
    trust: "host_trust.HostTrust",
    reachable: Callable[[str], bool],
    verify: Callable[[str, int, str], Optional[bytes]] = host_trust.verified_leaf,
) -> str:
    """
    依序試設定檔裡的位址，回第一個「驗得過、連得上」的；都不行回空字串。
    加密的位址要先用設定檔附的發證憑證驗過對方，驗過才記住這張憑證（之後視窗裡的瀏覽器也只認它）。
    """
    ca_pem = config.get("ca_pem") or ""
    for url in config.get("servers") or []:
        parts = urlsplit(url)
        if parts.scheme == "https":
            if not ca_pem:
                continue
            port = parts.port or DEFAULT_PORTS["https"]
            if verify(parts.hostname or "", port, ca_pem) is None:
                logger.info("自動連線：%s 驗不過或連不上，換下一個", url)
                continue
            if trust.pem != ca_pem:
                trust.save(ca_pem)
                logger.info("已依主機設定檔信任主機憑證（%s…）", trust.fingerprint[:23])
            trust.install_opener()
        if reachable(url):
            logger.info("自動連線成功：%s", url)
            return url
        logger.info("自動連線：%s 連不上，換下一個", url)
    return ""


__all__ = ["FILE_NAME", "parse", "load", "connect"]
