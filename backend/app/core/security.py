"""
安全性模組

JWT Token 與密碼處理
"""

import logging
import uuid
from datetime import timedelta
from typing import Optional, Any

from jose import jwt, JWTError
import bcrypt

from app.core.config import settings
from app.core.time_utils import utc_now


logger = logging.getLogger(__name__)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    驗證密碼

    SECURITY:
    - 不能直接 except Exception 吞掉所有錯誤，否則：
      a) bcrypt 內部真正的 timing-safe 邏輯 bug 會被掩蓋
      b) DB 裡 hash 欄位異常（None / 截斷 / 非 bcrypt 格式）會被當「密碼錯」，
         應該記錄但不洩漏給外部使用者
    - bcrypt.checkpw 本身是 constant-time，不需要再包 timing-safe 比對

    Args:
        plain_password: 明文密碼
        hashed_password: 雜湊密碼

    Returns:
        bool: 密碼是否正確
    """
    # 防呆：空輸入直接 False，不 call bcrypt（避免 ValueError 噪訊）
    if not plain_password or not hashed_password:
        return False
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8")
        )
    except ValueError as e:
        # bcrypt 對非 bcrypt 格式 hash 會 raise ValueError
        # 這通常是 DB 異常或舊 hash 格式 → 記 log 給管理員追，但對外仍回 False
        logger.warning(
            "verify_password: hash 格式異常（可能 DB 紀錄損毀或舊格式 hash）: %s",
            e,
        )
        return False
    except Exception as e:
        # 其他例外（編碼錯誤等）也 log 後回 False
        logger.error("verify_password: 未預期錯誤: %s", e, exc_info=True)
        return False


def get_password_hash(password: str) -> str:
    """
    取得密碼雜湊值
    
    Args:
        password: 明文密碼
        
    Returns:
        str: 雜湊後的密碼
    """
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def create_access_token(
    data: dict[str, Any],
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    建立 Access Token

    每個 Token 都會被賦予唯一的 jti (JWT ID)，
    用於 Token 黑名單機制追蹤個別 Token 的撤銷狀態。
    
    Args:
        data: Token 資料
        expires_delta: 過期時間差
        
    Returns:
        str: JWT Token
    """
    to_encode = data.copy()
    now = utc_now()

    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.jwt_expire_minutes)

    to_encode.update({
        "exp": expire,
        "iat": now,
        "type": "access",
        "jti": str(uuid.uuid4()),
    })
    
    return jwt.encode(
        to_encode,
        settings.secret_key,
        algorithm=settings.jwt_algorithm
    )


def create_refresh_token(
    data: dict[str, Any],
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    建立 Refresh Token

    同樣包含唯一 jti，支援黑名單撤銷。
    
    Args:
        data: Token 資料
        expires_delta: 過期時間差
        
    Returns:
        str: JWT Refresh Token
    """
    to_encode = data.copy()
    now = utc_now()

    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(days=settings.jwt_refresh_expire_days)

    to_encode.update({
        "exp": expire,
        "iat": now,
        "type": "refresh",
        "jti": str(uuid.uuid4()),
    })
    
    return jwt.encode(
        to_encode,
        settings.secret_key,
        algorithm=settings.jwt_algorithm
    )


def decode_token(token: str) -> Optional[dict[str, Any]]:
    """
    解碼 Token
    
    Args:
        token: JWT Token
        
    Returns:
        Optional[dict]: Token 資料，解碼失敗回傳 None
    """
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.jwt_algorithm]
        )
        return payload
    except JWTError:
        return None

