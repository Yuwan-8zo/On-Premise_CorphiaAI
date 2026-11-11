"""
請求相關的小工具（全後端共用）：取得用戶端 IP、User-Agent

用戶端 IP 的安全規則：
  X-Forwarded-For / X-Real-IP 是用戶端自己可以亂填的標頭。
  只有「直接連進來的是本機」（例如前端開發伺服器、本機反向代理轉送）時才採用；
  其他情況一律用實際連線的 IP，避免攻擊者每次填不同的假 IP 繞過登入次數限制、或把假資料寫進稽核紀錄。
"""
import ipaddress

from starlette.requests import HTTPConnection


def _valid_ip(value: str) -> str | None:
    value = (value or "").strip()
    try:
        ipaddress.ip_address(value)
        return value
    except ValueError:
        return None


def _is_loopback(host: str | None) -> bool:
    try:
        return bool(host) and ipaddress.ip_address(host).is_loopback
    except ValueError:
        return host == "localhost"


def get_client_ip(request: HTTPConnection) -> str:
    """回傳用戶端 IP（合法 IP 或 "unknown"）"""
    peer = request.client.host if request.client else None

    # 只信任本機轉送來的標頭；最左邊的是原始用戶端
    if _is_loopback(peer):
        for candidate in (request.headers.get("x-forwarded-for") or "").split(","):
            ip = _valid_ip(candidate)
            if ip:
                return ip
        ip = _valid_ip(request.headers.get("x-real-ip") or "")
        if ip:
            return ip

    return peer or "unknown"


def get_user_agent(request: HTTPConnection) -> str:
    return request.headers.get("user-agent", "unknown")
