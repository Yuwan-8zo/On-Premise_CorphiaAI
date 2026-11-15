"""
每個回應都帶的安全性標頭

  X-Content-Type-Options: nosniff     瀏覽器不要自己猜檔案類型（上傳的檔案不會被當成網頁或程式執行）
  X-Frame-Options: SAMEORIGIN         別的網站不能把這個系統嵌在框裡騙使用者點（點擊劫持）
  Referrer-Policy: no-referrer        點連結出去時不帶這個系統的網址

沒有加 HSTS：區網是用 IP 位址連線，瀏覽器不會對 IP 位址套用 HSTS，加了沒有作用。
內容安全政策（CSP）在介面自己的 index.html 裡。
"""

HEADERS = (
    (b"x-content-type-options", b"nosniff"),
    (b"x-frame-options", b"SAMEORIGIN"),
    (b"referrer-policy", b"no-referrer"),
)


class SecurityHeadersMiddleware:
    """純 ASGI 中介層（不包 BaseHTTPMiddleware，串流回應和 WebSocket 不受影響）"""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_with_headers(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers") or [])
                present = {name.lower() for name, _ in headers}
                headers.extend((name, value) for name, value in HEADERS if name not in present)
                message = {**message, "headers": headers}
            await send(message)

        await self.app(scope, receive, send_with_headers)
