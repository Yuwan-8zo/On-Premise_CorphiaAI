"""
啟動後端 (run_server.py)：決定「誰連得到、走不走加密」

  開發模式（一鍵啟動）          只聽這台電腦（127.0.0.1），介面由前端開發伺服器提供，跟以前一樣。
  主機模式（start.py --built）  這台電腦自己：照舊走 http://localhost:埠（不出這台電腦，不需要加密）。
                                公司其他電腦、手機：走加密連線 https://主機IP:加密埠，憑證由主機自己簽（app/core/lan_tls.py）。
                                沒加密的那個埠只聽這台電腦，區網上的裝置連不到，登入資料和對話不會用明碼在網路上跑。
  主機模式但關掉加密、或憑證做不出來
                                退回原本的做法：一個沒加密的埠聽所有網路介面（誰能進來仍由區網門檢決定）。

用法：python run_server.py [--port 8168]
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys

import uvicorn

from app.core import web_ui
from app.core.config import settings

logger = logging.getLogger("corphia.server")

LOOPBACK = "127.0.0.1"
EVERY_INTERFACE = "0.0.0.0"


def plan(port: int, built: bool, lan_https: bool, https_port: int, certificate: tuple[str, str] | None) -> list[dict]:
    """
    要開哪些埠（uvicorn 的設定參數）。第一個是主要的（負責啟動時載入模型等一次性的工作），
    其餘的共用同一個程式、不重複做啟動工作。
    """
    if not built:
        return [dict(host=LOOPBACK, port=port)]
    if lan_https and certificate:
        return [
            dict(host=LOOPBACK, port=port),
            dict(host=EVERY_INTERFACE, port=https_port, ssl_certfile=certificate[0], ssl_keyfile=certificate[1], lifespan="off"),
        ]
    return [dict(host=EVERY_INTERFACE, port=port)]


def prepare_certificate() -> tuple[str, str] | None:
    """準備區網加密的憑證；做不出來回 None（改用沒加密的方式，不讓整個系統起不來）"""
    try:
        from app.api.system_monitor import _detect_lan_ips
        from app.core.lan_tls import ensure_certificates

        cert, key = ensure_certificates(_detect_lan_ips())
        return str(cert), str(key)
    except Exception as e:
        logger.error("區網加密的憑證準備失敗，改用沒加密的連線：%s", e)
        return None


async def serve_all(servers: list[uvicorn.Server]) -> None:
    """一起跑；任何一個結束（收到關閉訊號、或出錯）就全部收掉"""
    tasks = [asyncio.create_task(s.serve()) for s in servers]
    try:
        await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
    finally:
        for s in servers:
            s.should_exit = True
        await asyncio.gather(*tasks, return_exceptions=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="啟動 Corphia AI 後端")
    parser.add_argument("--port", type=int, default=8168)
    parser.add_argument("--log-level", default="info")
    args = parser.parse_args()

    built = web_ui.enabled()
    want_https = built and settings.lan_https
    listeners = plan(args.port, built, want_https, settings.lan_https_port, prepare_certificate() if want_https else None)
    encrypted = len(listeners) > 1
    # 區網裝置要連的位址（管理後台的 QR 碼用）；開發模式由前端開發伺服器決定，這裡不設
    if built:
        web_ui.LAN_ENDPOINT = {"scheme": "https" if encrypted else "http", "port": settings.lan_https_port if encrypted else args.port}

    from app.main import app  # 放在這裡才匯入：上面的設定要先就位

    servers = [uvicorn.Server(uvicorn.Config(app, log_level=args.log_level, **opts)) for opts in listeners]
    asyncio.run(serve_all(servers))
    return 0


if __name__ == "__main__":
    sys.exit(main())
