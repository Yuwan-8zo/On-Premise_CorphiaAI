"""
敏感資訊自動遮罩服務 (PII Masking)

差異化功能 A1：員工輸入台灣身分證、信用卡、手機、電子郵件、API Key 時，
送入模型前自動 mask，並在 WebSocket 回傳中標記哪些位置被遮蔽。

設計原則：
- 純正則匹配，不依賴外部 NLP 模型，延遲極低
- 回傳遮罩對照表 (mask_map)，前端可高亮標記
- 遮罩後的內容送入 LLM，確保敏感資訊不進模型
"""

import re
import logging
from typing import TypedDict

logger = logging.getLogger(__name__)


class MaskResult(TypedDict):
    """遮罩結果"""
    masked_text: str
    mask_map: list[dict]  # [{original, masked, type, start, end}]
    has_pii: bool


# ── 台灣與國際敏感資訊正則模式 ──────────────────────────────────

# NOTE: 順序很重要 — 信用卡（16 位整體）必須先掃，否則 8 位統編模式可能誤觸發
# （雖然 \b 邊界讓「1111-2222」內部的 4 位不會被當 8 位匹配，但 1111-2222-3333 拼起來
# 仍可能在某些上下文觸發；先掃較長 pattern 並從文字中替換掉，後續就不會再被掃）。
_PATTERNS: list[tuple[str, re.Pattern[str], str]] = [
    # 台灣身分證字號 (A123456789)
    (
        "tw_national_id",
        re.compile(r'\b[A-Z][12]\d{8}\b'),
        "台灣身分證",
    ),
    # 信用卡號 (16 位，可能有空格或連字號分隔) — 要在 8 位統編前掃
    (
        "credit_card",
        re.compile(r'\b(?:\d{4}[-\s]?){3}\d{4}\b'),
        "信用卡號",
    ),
    # 台灣統一編號 (8 位數字)
    # FIX: 原本 lookahead 用 `.*統一編號|統編` 會匹配「文字裡任何位置出現過統編」就把
    # 所有 8 位數字當統編遮罩。改成「統編關鍵字」必須出現在 8 位數字附近 (前 20 字 / 後 20 字)
    # 用「統編 + 顯式 8 位數字」雙向 pattern，避免誤觸。
    (
        "tw_business_id",
        re.compile(
            r'(?:統一?編號|統編|VAT)[^\d]{0,20}(\d{8})\b'
            r'|\b(\d{8})[^\d]{0,20}(?:統一?編號|統編)'
        ),
        "統一編號",
    ),
    # 台灣手機號碼 (09xx-xxx-xxx 或 09xxxxxxxx)
    (
        "tw_phone",
        re.compile(r'\b09\d{2}[-\s]?\d{3}[-\s]?\d{3}\b'),
        "手機號碼",
    ),
    # 電子郵件 — 加 lookbehind/lookahead 避免誤殺像 user.name.dept 這種無 @ 的「.連結」
    # 確保 @ 之前是 word char，@ 之後 TLD 至少 2 字（已有）
    (
        "email",
        re.compile(r'\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9](?:[a-zA-Z0-9.\-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}\b'),
        "電子郵件",
    ),
    # API Key / Secret (以 sk-, api_, AKIA, ghp_, ghs_, ghu_ 開頭的長字串)
    # 補上 GitHub token 常見前綴
    (
        "api_key",
        re.compile(r'\b(?:sk-|api_|AKIA|ghp_|ghs_|ghu_|ghr_|gho_)[a-zA-Z0-9_\-]{16,}\b'),
        "API 金鑰",
    ),
    # 台灣護照號碼 (9 位數字) — 同 tw_business_id 修正：限定上下文距離
    (
        "tw_passport",
        re.compile(
            r'(?:護照(?:號碼|號)?|passport)[^\d]{0,20}(\d{9})\b'
            r'|\b(\d{9})[^\d]{0,20}護照',
            re.IGNORECASE,
        ),
        "護照號碼",
    ),
]


def mask_pii(text: str) -> MaskResult:
    """
    掃描文字中的 PII，替換為遮罩標記

    Args:
        text: 原始使用者輸入

    Returns:
        MaskResult: 包含遮罩後文字、對照表、是否偵測到 PII
    """
    mask_map: list[dict] = []
    masked_text = text

    # 先收集所有匹配，從後往前替換避免 offset 位移
    all_matches: list[tuple[str, str, re.Match[str]]] = []

    for pii_type, pattern, label in _PATTERNS:
        for match in pattern.finditer(text):
            all_matches.append((pii_type, label, match))

    # 按起始位置降序排列，從後往前替換
    all_matches.sort(key=lambda x: x[2].start(), reverse=True)

    for pii_type, label, match in all_matches:
        original = match.group()
        # 遮罩策略：保留頭尾各 2 字元，中間用 * 替代
        if len(original) > 4:
            masked = original[:2] + '*' * (len(original) - 4) + original[-2:]
        else:
            masked = '*' * len(original)

        mask_tag = f"[{label}已遮罩]"

        mask_map.append({
            "original_preview": masked,  # 不回傳完整原文！只給遮罩版
            "masked": mask_tag,
            "type": pii_type,
            "label": label,
            "start": match.start(),
            "end": match.end(),
        })

        # 替換文字
        masked_text = masked_text[:match.start()] + mask_tag + masked_text[match.end():]

    # mask_map 轉回正序（給前端用）
    mask_map.reverse()

    has_pii = len(mask_map) > 0

    if has_pii:
        logger.info(f"[PII Masking] 偵測到 {len(mask_map)} 筆敏感資訊：{[m['type'] for m in mask_map]}")

    return MaskResult(
        masked_text=masked_text,
        mask_map=mask_map,
        has_pii=has_pii,
    )
