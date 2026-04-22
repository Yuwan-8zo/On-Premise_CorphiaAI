"""
統一的時間工具模組

目的：集中處理所有 datetime 的產生與轉換，
      避免散落在程式碼各處的 `datetime.now(timezone.utc).replace(tzinfo=None)`。

設計原則：
1. 資料庫儲存「naive UTC」(tzinfo=None)，與 SQLAlchemy 的 DateTime 欄位對齊。
2. 對外回應 API 或寫日誌時，使用「aware UTC」(帶 tzinfo) 以方便 ISO 格式化。
3. 所有新的時間戳記一律從此處取得，確保時區語意一致。
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Optional


# ──────────────────────────────────────────────────────────────
# 基礎時間函式
# ──────────────────────────────────────────────────────────────
def utc_now() -> datetime:
    """取得 aware UTC 時間 (帶 tzinfo=UTC)。

    適用於：JWT iat/exp、對外 API 回應、日誌訊息。
    """
    return datetime.now(timezone.utc)


def utc_now_naive() -> datetime:
    """取得 naive UTC 時間 (tzinfo=None)。

    適用於：寫入資料庫 (SQLAlchemy DateTime 預設為 naive)。
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


def utc_now_iso() -> str:
    """取得 ISO 8601 格式的 UTC 時間字串，含 Z 後綴。

    範例：`2026-04-21T12:34:56.789012Z`
    適用於：日誌、API 回應、crash log。
    """
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


# ──────────────────────────────────────────────────────────────
# 時間加減
# ──────────────────────────────────────────────────────────────
def utc_now_naive_plus(
    *,
    seconds: int = 0,
    minutes: int = 0,
    hours: int = 0,
    days: int = 0,
) -> datetime:
    """取得未來 naive UTC 時間，適用於 token expires_at、locked_until 等欄位。"""
    return utc_now_naive() + timedelta(
        seconds=seconds,
        minutes=minutes,
        hours=hours,
        days=days,
    )


def utc_now_plus(
    *,
    seconds: int = 0,
    minutes: int = 0,
    hours: int = 0,
    days: int = 0,
) -> datetime:
    """取得未來 aware UTC 時間。"""
    return utc_now() + timedelta(
        seconds=seconds,
        minutes=minutes,
        hours=hours,
        days=days,
    )


# ──────────────────────────────────────────────────────────────
# 轉換輔助
# ──────────────────────────────────────────────────────────────
def to_naive_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """將任意 datetime 轉為 naive UTC。

    - 若為 aware datetime，先轉到 UTC 再去除 tzinfo。
    - 若本身已是 naive，假設其為 UTC 語意，直接返回。
    - 若為 None，原樣返回。
    """
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def to_aware_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """將任意 datetime 轉為 aware UTC。

    - 若為 naive，視為 UTC 並附上 tzinfo。
    - 若已是 aware，轉換到 UTC 時區。
    - 若為 None，原樣返回。
    """
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def to_iso_z(dt: Optional[datetime]) -> Optional[str]:
    """將 datetime 轉為 ISO 8601 字串（Z 後綴）。"""
    if dt is None:
        return None
    aware = to_aware_utc(dt)
    assert aware is not None
    return aware.isoformat().replace("+00:00", "Z")


__all__ = [
    "utc_now",
    "utc_now_naive",
    "utc_now_iso",
    "utc_now_naive_plus",
    "utc_now_plus",
    "to_naive_utc",
    "to_aware_utc",
    "to_iso_z",
]
