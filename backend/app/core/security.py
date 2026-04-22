"""
安全性模組

JWT Token 與密碼處理
"""

import uuid
from datetime import timedelta
from typing import Optional, Any

from jose import jwt, JWTError
import bcrypt

from app.core.config import settings
from app.core.time_utils import utc_now


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    驗證密碼
    
    Args:
        plain_password: 明文密碼
        hashed_password: 雜湊密碼
        
    Returns:
        bool: 密碼是否正確
    """
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8")
        )
    except Exception:
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

