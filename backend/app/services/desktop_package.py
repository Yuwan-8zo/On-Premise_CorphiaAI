"""
員工安裝包 (desktop_package.py)

公司其他電腦要裝桌面版時，管理者從主機下載一個壓縮檔發給同仁（隨身碟、公司共用資料夾）：
  Corphia AI.exe       桌面版程式
  corphia-host.json    這台主機的連線位址（電腦名稱優先，再來是各個區網 IP）＋主機的發證憑證
  使用說明.txt

同仁打開程式就自動連上主機（desktop/host_config.py）：不用輸入位址、也不用核對指紋。
桌面版會用附的發證憑證實際驗過對方才連，同網段有人冒充主機也連不過去。
發證憑證只有公開的那一半（和 /lan-ca.crt 給的是同一張），私鑰從不離開主機。
"""

from __future__ import annotations

import datetime as dt
import io
import json
import zipfile
from pathlib import Path
from typing import Iterable, Optional

CONFIG_NAME = "corphia-host.json"
GUIDE_NAME = "使用說明.txt"
EXE_NAME = "Corphia AI.exe"

GUIDE = """Corphia AI 桌面版（公司內部使用，請勿外流）

1. 把這個資料夾裡的「Corphia AI.exe」和「corphia-host.json」放在同一個資料夾
   （例如「文件」資料夾），兩個檔案要放在一起。
2. 點兩下「Corphia AI.exe」。程式會自動找到公司主機並確認是真的主機，不用輸入任何位址。
   若出現「Windows 已保護您的電腦」：這是因為程式沒有向微軟申請數位簽章。
   確認檔案是管理者提供的之後，按「其他資訊」→「仍要執行」。
3. 用管理者發給你的帳號密碼登入。之後再開不用重新登入。

連不上時：請確認電腦連在公司網路、主機有開著。離開公司網路一律連不到，這是刻意的設計。
有新版時程式會提示，按「更新」即可（只從公司主機下載）。
"""


def host_servers(scheme: str, port: int, ips: Iterable[str], hostname: str = "") -> list[str]:
    """員工電腦要試的位址：電腦名稱排第一（主機換 IP 也找得到），再來是各個區網 IP；重複的去掉"""
    out: list[str] = []
    for host in [(hostname or "").strip().lower(), *ips]:
        if not host:
            continue
        url = f"{scheme}://{host}:{port}"
        if url not in out:
            out.append(url)
    return out


def host_config(servers: list[str], ca_pem: str = "", fingerprint: str = "", host_name: str = "") -> dict:
    return {
        "app": "Corphia AI",
        "format": 1,
        "host_name": host_name,
        "servers": servers,
        "ca_pem": ca_pem,
        "fingerprint": fingerprint,
        "created_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
    }


def build_zip(exe: Path, config: dict, folder_name: str) -> bytes:
    """打包成一個壓縮檔：解開來是一個資料夾，裡面三個檔案"""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.write(exe, f"{folder_name}/{EXE_NAME}")
        z.writestr(f"{folder_name}/{CONFIG_NAME}", json.dumps(config, ensure_ascii=False, indent=2) + "\n")
        z.writestr(f"{folder_name}/{GUIDE_NAME}", GUIDE.replace("\n", "\r\n").encode("utf-8-sig"))
    return buf.getvalue()


def current_config(endpoint: Optional[dict], ips: list[str], hostname: str) -> Optional[dict]:
    """
    這台主機現在的設定；開發模式（不知道區網要連哪個協定和埠）回 None。
    有加密就附上發證憑證；發證憑證還沒產生（不該發生：主機模式啟動時就會產生）也回 None。
    """
    if not endpoint:
        return None
    scheme, port = endpoint["scheme"], int(endpoint["port"])
    ca_pem = fingerprint = ""
    if scheme == "https":
        from app.core.lan_tls import ca_fingerprint, ca_path

        try:
            ca_pem = ca_path().read_text(encoding="ascii")
        except OSError:
            return None
        fingerprint = ca_fingerprint()
    return host_config(host_servers(scheme, port, ips, hostname), ca_pem, fingerprint, hostname)


__all__ = ["CONFIG_NAME", "GUIDE_NAME", "EXE_NAME", "host_servers", "host_config", "build_zip", "current_config"]
