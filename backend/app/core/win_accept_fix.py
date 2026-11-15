"""
Windows：連線在「接受」的瞬間被對方中斷時，後端不要從此停止接受新連線

Python 3.12 的 Windows 事件迴圈（ProactorEventLoop）在 accept 遇到
WinError 64（指定的網路名稱無法使用）或 1236（連線被本機中止）時，會把監聽的 socket 關掉，
之後所有新連線都進不來，整個後端等於停擺（服務還在跑、但連不上）。
常見觸發：瀏覽器或手機在後端忙碌時等太久先放棄連線。

這裡把 accept 迴圈換成同樣的寫法，只多一件事：遇到上面兩種錯誤就記一筆警告、繼續接受下一個連線。
其他錯誤照原本的處理。只在 Windows 生效；app/main.py 一載入就安裝（要在 uvicorn 開 socket 之前）。
"""

from __future__ import annotations

import logging
import sys

logger = logging.getLogger(__name__)

# 對方先斷線造成的 accept 錯誤：可以忽略、繼續接受
_RETRYABLE_WINERRORS = {64, 1236}


def install() -> None:
    if sys.platform != "win32":
        return
    from asyncio import exceptions, proactor_events, trsock

    base = proactor_events.BaseProactorEventLoop
    if getattr(base._start_serving, "_corphia_patched", False):
        return

    def _start_serving(self, protocol_factory, sock, sslcontext=None, server=None, backlog=100,
                       ssl_handshake_timeout=None, ssl_shutdown_timeout=None):
        def loop(f=None):
            try:
                if f is not None:
                    conn, addr = f.result()
                    protocol = protocol_factory()
                    if sslcontext is not None:
                        self._make_ssl_transport(
                            conn, protocol, sslcontext, server_side=True, extra={"peername": addr}, server=server,
                            ssl_handshake_timeout=ssl_handshake_timeout, ssl_shutdown_timeout=ssl_shutdown_timeout)
                    else:
                        self._make_socket_transport(conn, protocol, extra={"peername": addr}, server=server)
                if self.is_closed():
                    return
                f = self._proactor.accept(sock)
            except OSError as exc:
                if getattr(exc, "winerror", None) in _RETRYABLE_WINERRORS and sock.fileno() != -1 and not self.is_closed():
                    logger.warning(f"連線在接受時被對方中斷（WinError {exc.winerror}），繼續接受新連線")
                    self.call_soon(loop)
                    return
                if sock.fileno() != -1:
                    self.call_exception_handler({"message": "Accept failed on a socket", "exception": exc, "socket": trsock.TransportSocket(sock)})
                    sock.close()
            except exceptions.CancelledError:
                sock.close()
            else:
                self._accept_futures[sock.fileno()] = f
                f.add_done_callback(loop)

        self.call_soon(loop)

    _start_serving._corphia_patched = True  # type: ignore[attr-defined]
    base._start_serving = _start_serving
