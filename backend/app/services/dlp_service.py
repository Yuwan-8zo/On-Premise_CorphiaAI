"""
資料外洩防護 (Data Loss Prevention, DLP) 服務

差異化功能 A3：阻擋使用者把列管機密字詞送進 LLM（或讓 LLM 把這些字詞帶回）。
與 PII Masking 的差別：
- PII Masking：針對「格式固定」的個資（身分證、信用卡、email）遮罩。
- DLP：針對「組織自訂」的敏感詞（專案代號、機密等級名稱）攔阻。

設計原則：
- 關鍵字從設定檔 `DLP_BLOCKLIST` 載入，企業可自行擴充。
- 不分大小寫（避免繞過）。
- 匹配到就回報 BlockResult，由上層決定攔阻 or 僅警告。
- 純字串比對，效能好、無外部依賴。
"""

from __future__ import annotations

import logging
from typing import TypedDict, List

from app.core.config import settings

logger = logging.getLogger(__name__)


class DLPCheckResult(TypedDict):
    """DLP 檢查結果"""
    blocked: bool
    matched_terms: List[str]
    reason: str


def check_dlp(text: str) -> DLPCheckResult:
    """
    比對文字內容是否包含設定檔中的 DLP 黑名單字詞。

    Args:
        text: 使用者輸入文字

    Returns:
        DLPCheckResult: 是否被攔阻、命中的字詞列表、理由訊息。
    """
    if not settings.enable_dlp:
        return DLPCheckResult(blocked=False, matched_terms=[], reason="")

    terms = settings.dlp_blocklist_terms
    if not terms:
        return DLPCheckResult(blocked=False, matched_terms=[], reason="")

    lower = text.lower()
    matched = [term for term in terms if term and term in lower]

    if matched:
        logger.warning(f"[DLP] 偵測到黑名單字詞，請求已攔阻: {matched}")
        return DLPCheckResult(
            blocked=True,
            matched_terms=matched,
            reason=f"訊息包含列管字詞 ({len(matched)} 項)，已依 DLP 策略攔阻。",
        )

    return DLPCheckResult(blocked=False, matched_terms=[], reason="")


__all__ = ["DLPCheckResult", "check_dlp"]
