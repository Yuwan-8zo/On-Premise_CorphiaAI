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

    # FIX: Unicode normalize（NFKC）讓全形/半形等價
    # 例如「最高機密」vs「最ⓗ機密」（圈字）、ＡＢＣ vs ABC、Ⅴ vs V
    # 沒 normalize 攻擊者用全形字就能繞過 DLP 黑名單
    import unicodedata

    from app.services.text_normalize import variants

    # 再加上拿掉零寬字元、把拆開的字接回去的版本：「最​高機密」「機 密」這類寫法一樣比對得到
    candidates = {unicodedata.normalize("NFKC", text).lower()}
    for variant, _ in variants(text):
        candidates.add(unicodedata.normalize("NFKC", variant).lower())
    matched = [
        term for term in terms
        if term and any(unicodedata.normalize("NFKC", term).lower() in candidate for candidate in candidates)
    ]
    # 整句被拆過字：接回去之後單字間的空格也不見了，列管字詞也拿掉空格再比（top secret → topsecret）
    from app.services.text_normalize import reassembled

    joined = reassembled(text)
    if joined is not None:
        compact = "".join(unicodedata.normalize("NFKC", joined).lower().split())
        matched += [
            term for term in terms
            if term and term not in matched and "".join(unicodedata.normalize("NFKC", term).lower().split()) in compact
        ]

    if matched:
        logger.warning(f"[DLP] 偵測到黑名單字詞，請求已攔阻: {matched}")
        return DLPCheckResult(
            blocked=True,
            matched_terms=matched,
            reason=f"訊息包含列管字詞 ({len(matched)} 項)，已依 DLP 策略攔阻。",
        )

    return DLPCheckResult(blocked=False, matched_terms=[], reason="")


__all__ = ["DLPCheckResult", "check_dlp"]
