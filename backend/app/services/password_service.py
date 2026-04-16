"""
密碼安全服務模組

提供密碼強度驗證、登入失敗鎖定機制等安全功能。
"""

import logging
import re
from datetime import datetime, timezone, timedelta
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.user import User

logger = logging.getLogger(__name__)


# ==================== 密碼強度驗證 ====================

class PasswordPolicy:
    """密碼策略配置"""
    MIN_LENGTH = 8
    MAX_LENGTH = 128
    REQUIRE_UPPERCASE = True
    REQUIRE_LOWERCASE = True
    REQUIRE_DIGIT = True
    REQUIRE_SPECIAL = True
    SPECIAL_CHARACTERS = r"!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?"


class PasswordValidationError:
    """密碼驗證錯誤訊息"""
    TOO_SHORT = "密碼長度至少需要 {min_length} 個字元"
    TOO_LONG = "密碼長度不得超過 {max_length} 個字元"
    NO_UPPERCASE = "密碼需包含至少一個大寫字母"
    NO_LOWERCASE = "密碼需包含至少一個小寫字母"
    NO_DIGIT = "密碼需包含至少一個數字"
    NO_SPECIAL = "密碼需包含至少一個特殊字元 (!@#$%^&* 等)"


def validate_password_strength(password: str) -> list[str]:
    """
    驗證密碼強度，回傳所有不符合的規則訊息

    Args:
        password: 待驗證的密碼

    Returns:
        list[str]: 不符合的規則訊息列表，空列表表示密碼符合所有要求
    """
    errors: list[str] = []

    if len(password) < PasswordPolicy.MIN_LENGTH:
        errors.append(
            PasswordValidationError.TOO_SHORT.format(
                min_length=PasswordPolicy.MIN_LENGTH
            )
        )

    if len(password) > PasswordPolicy.MAX_LENGTH:
        errors.append(
            PasswordValidationError.TOO_LONG.format(
                max_length=PasswordPolicy.MAX_LENGTH
            )
        )

    if PasswordPolicy.REQUIRE_UPPERCASE and not re.search(r"[A-Z]", password):
        errors.append(PasswordValidationError.NO_UPPERCASE)

    if PasswordPolicy.REQUIRE_LOWERCASE and not re.search(r"[a-z]", password):
        errors.append(PasswordValidationError.NO_LOWERCASE)

    if PasswordPolicy.REQUIRE_DIGIT and not re.search(r"\d", password):
        errors.append(PasswordValidationError.NO_DIGIT)

    if PasswordPolicy.REQUIRE_SPECIAL and not re.search(
        r"[!@#$%^&*()\-_=+\[\]{};:'\",.<>?/\\|`~]", password
    ):
        errors.append(PasswordValidationError.NO_SPECIAL)

    return errors


def get_password_strength_score(password: str) -> dict:
    """
    計算密碼強度分數

    Args:
        password: 密碼

    Returns:
        dict: 包含 score (0-100), level (weak/medium/strong/very_strong), errors
    """
    errors = validate_password_strength(password)
    score = 0

    # 基礎分數：長度
    length = len(password)
    if length >= 8:
        score += 20
    if length >= 12:
        score += 10
    if length >= 16:
        score += 10

    # 字元多樣性
    if re.search(r"[a-z]", password):
        score += 15
    if re.search(r"[A-Z]", password):
        score += 15
    if re.search(r"\d", password):
        score += 15
    if re.search(r"[!@#$%^&*()\-_=+\[\]{};:'\",.<>?/\\|`~]", password):
        score += 15

    # 不重複字元加分
    unique_ratio = len(set(password)) / max(len(password), 1)
    if unique_ratio > 0.7:
        score = min(score, 100)

    # 判定等級
    if score >= 80:
        level = "very_strong"
    elif score >= 60:
        level = "strong"
    elif score >= 40:
        level = "medium"
    else:
        level = "weak"

    return {
        "score": min(score, 100),
        "level": level,
        "errors": errors,
        "is_valid": len(errors) == 0,
    }


# ==================== 登入失敗鎖定機制 ====================

# 鎖定策略配置
LOGIN_MAX_ATTEMPTS = 5          # 最大嘗試次數
LOGIN_LOCKOUT_MINUTES = 15      # 鎖定時間（分鐘）

import time
from threading import Lock

_mock_lock = Lock()
_mock_failures: dict[str, dict] = {}

def _handle_mock_check(email: str) -> dict:
    with _mock_lock:
        now = time.time()
        record = _mock_failures.get(email)
        if not record:
            return {
                "is_locked": False,
                "remaining_attempts": LOGIN_MAX_ATTEMPTS,
                "lockout_until": None,
                "minutes_remaining": 0,
            }
        
        if record["locked_until"] > now:
            remaining = int((record["locked_until"] - now) / 60) + 1
            return {
                "is_locked": True,
                "remaining_attempts": 0,
                "lockout_until": datetime.fromtimestamp(record["locked_until"], tz=timezone.utc),
                "minutes_remaining": remaining,
            }
        else:
            if record["locked_until"] != 0:
                record["attempts"] = 0
                record["locked_until"] = 0
            
        remaining_attempts = max(LOGIN_MAX_ATTEMPTS - record["attempts"], 0)
        return {
            "is_locked": False,
            "remaining_attempts": remaining_attempts,
            "lockout_until": None,
            "minutes_remaining": 0,
        }

def _handle_mock_failure(email: str) -> dict:
    with _mock_lock:
        now = time.time()
        if email not in _mock_failures:
            _mock_failures[email] = {"attempts": 0, "locked_until": 0}
        record = _mock_failures[email]
        
        record["attempts"] += 1
        if record["attempts"] >= LOGIN_MAX_ATTEMPTS:
            record["locked_until"] = now + LOGIN_LOCKOUT_MINUTES * 60
            return {
                "is_locked": True,
                "remaining_attempts": 0,
                "lockout_minutes": LOGIN_LOCKOUT_MINUTES,
            }
            
        remaining = max(LOGIN_MAX_ATTEMPTS - record["attempts"], 0)
        return {
            "is_locked": False,
            "remaining_attempts": remaining,
            "lockout_minutes": 0,
        }

async def check_login_lockout(
    db: AsyncSession,
    email: str,
) -> dict:
    """
    檢查帳號是否被鎖定（基於 User 模型的欄位）

    Args:
        db: 資料庫 Session
        email: 使用者 email

    Returns:
        dict: {
            "is_locked": bool,
            "remaining_attempts": int,
            "lockout_until": datetime | None,
            "minutes_remaining": int
        }
    """
    result = await db.execute(
        select(User).where(User.email == email)
    )
    user = result.scalar_one_or_none()

    if user is None:
        # 使用者不存在，套用模擬鎖定機制防範列舉攻擊
        return _handle_mock_check(email)

    # 檢查是否已被鎖定
    if user.locked_until:
        now = datetime.now(timezone.utc)
        locked_until = user.locked_until
        if locked_until.tzinfo is None:
            locked_until = locked_until.replace(tzinfo=timezone.utc)

        if now < locked_until:
            remaining = (locked_until - now).total_seconds() / 60
            return {
                "is_locked": True,
                "remaining_attempts": 0,
                "lockout_until": locked_until,
                "minutes_remaining": int(remaining) + 1,
            }
        else:
            # 鎖定已過期，重置
            user.failed_login_attempts = 0
            user.locked_until = None
            await db.commit()

    attempts = user.failed_login_attempts or 0
    remaining = max(LOGIN_MAX_ATTEMPTS - attempts, 0)

    return {
        "is_locked": False,
        "remaining_attempts": remaining,
        "lockout_until": None,
        "minutes_remaining": 0,
    }


async def record_login_failure(
    db: AsyncSession,
    email: str,
) -> dict:
    """
    記錄登入失敗，自動累加計數，達到上限時鎖定帳號

    Args:
        db: 資料庫 Session
        email: 使用者 email

    Returns:
        dict: {
            "is_locked": bool,
            "remaining_attempts": int,
            "lockout_minutes": int
        }
    """
    result = await db.execute(
        select(User).where(User.email == email)
    )
    user = result.scalar_one_or_none()

    if user is None:
        # 使用者不存在，套用模擬失敗機制防範列舉攻擊
        return _handle_mock_failure(email)

    user.failed_login_attempts = (user.failed_login_attempts or 0) + 1

    if user.failed_login_attempts >= LOGIN_MAX_ATTEMPTS:
        user.locked_until = (datetime.now(timezone.utc) + timedelta(
            minutes=LOGIN_LOCKOUT_MINUTES
        )).replace(tzinfo=None)
        await db.commit()
        logger.warning(
            f"帳號已鎖定: {email}, "
            f"失敗次數: {user.failed_login_attempts}, "
            f"鎖定至: {user.locked_until}"
        )
        return {
            "is_locked": True,
            "remaining_attempts": 0,
            "lockout_minutes": LOGIN_LOCKOUT_MINUTES,
        }

    await db.commit()
    remaining = max(LOGIN_MAX_ATTEMPTS - user.failed_login_attempts, 0)
    return {
        "is_locked": False,
        "remaining_attempts": remaining,
        "lockout_minutes": 0,
    }


async def reset_login_attempts(
    db: AsyncSession,
    user: "User",
) -> None:
    """
    登入成功時重置失敗計數

    Args:
        db: 資料庫 Session
        user: 使用者物件
    """
    if user.failed_login_attempts and user.failed_login_attempts > 0:
        user.failed_login_attempts = 0
        user.locked_until = None
        await db.commit()
