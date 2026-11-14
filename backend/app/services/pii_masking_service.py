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


from app.services.text_normalize import original_span, variants


class MaskResult(TypedDict):
    """遮罩結果"""
    masked_text: str
    mask_map: list[dict]  # [{original, masked, type, start, end}]
    has_pii: bool


# ── 台灣與國際敏感資訊正則模式 ──────────────────────────────────

# NOTE: 順序很重要 — 信用卡（16 位整體）必須先掃，否則 8 位統編模式可能誤觸發
# （雖然 \b 邊界讓「1111-2222」內部的 4 位不會被當 8 位匹配，但 1111-2222-3333 拼起來
# 仍可能在某些上下文觸發；先掃較長 pattern 並從文字中替換掉，後續就不會再被掃）。
# FIX: `\b` 在中文語境下失效——中文字屬於 \w，「身分證是A123456789」中「是」與「A」之間
# 沒有字詞邊界，號碼緊貼中文時整筆漏判。改用「前後不是英數字」的明確邊界 _L / _R。
_L = r'(?<![A-Za-z0-9])'
_R = r'(?![A-Za-z0-9])'

_PATTERNS: list[tuple[str, re.Pattern[str], str]] = [
    # 台灣身分證字號 (A123456789)
    (
        "tw_national_id",
        re.compile(_L + r'[A-Z][12]\d{8}' + _R),
        "台灣身分證",
    ),
    # 信用卡號 (16 位，可能有空格或連字號分隔) — 要在 8 位統編前掃
    (
        "credit_card",
        re.compile(_L + r'(?:\d{4}[-\s]?){3}\d{4}' + _R),
        "信用卡號",
    ),
    # 台灣統一編號 (8 位數字)
    # FIX: 原本 lookahead 用 `.*統一編號|統編` 會匹配「文字裡任何位置出現過統編」就把
    # 所有 8 位數字當統編遮罩。改成「統編關鍵字」必須出現在 8 位數字附近 (前 20 字 / 後 20 字)
    # 用「統編 + 顯式 8 位數字」雙向 pattern，避免誤觸。
    (
        "tw_business_id",
        re.compile(
            r'(?:統一?編號|統編|VAT)[^\d]{0,20}(\d{8})(?!\d)'
            r'|(?<!\d)(\d{8})[^\d]{0,20}(?:統一?編號|統編)'
        ),
        "統一編號",
    ),
    # 台灣手機號碼 (09xx-xxx-xxx 或 09xxxxxxxx)
    (
        "tw_phone",
        re.compile(_L + r'09\d{2}[-\s]?\d{3}[-\s]?\d{3}' + _R),
        "手機號碼",
    ),
    # 電子郵件 — 加 lookbehind/lookahead 避免誤殺像 user.name.dept 這種無 @ 的「.連結」
    # 確保 @ 之前是 word char，@ 之後 TLD 至少 2 字（已有）
    (
        "email",
        re.compile(r'(?<![A-Za-z0-9._%+\-])[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9](?:[a-zA-Z0-9.\-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}' + _R),
        "電子郵件",
    ),
    # API Key / Secret (以 sk-, api_, AKIA, ghp_, ghs_, ghu_ 開頭的長字串)
    # 補上 GitHub token 常見前綴
    (
        "api_key",
        re.compile(_L + r'(?:sk-|api_|AKIA|ghp_|ghs_|ghu_|ghr_|gho_)[a-zA-Z0-9_\-]{16,}' + _R),
        "API 金鑰",
    ),
    # 台灣護照號碼 (9 位數字) — 同 tw_business_id 修正：限定上下文距離
    (
        "tw_passport",
        re.compile(
            r'(?:護照(?:號碼|號)?|passport)[^\d]{0,20}(\d{9})(?!\d)'
            r'|(?<!\d)(\d{9})[^\d]{0,20}護照',
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

    # 先在原文上收集所有樣式的匹配
    # 除了原文，也在「正規化後的版本」上比對（全形英數字、零寬字元、拆字），再換算回原文的位置：
    # 「Ａ１２３４５６７８９」「A 1 2 3 4 5 6 7 8 9」這類變形寫法一樣遮得到，而且遮的是原文那一段
    all_matches: list[tuple[str, str, int, int]] = []

    for variant, index in variants(text):
        for pii_type, pattern, label in _PATTERNS:
            for match in pattern.finditer(variant):
                start, end = original_span(index, match.start(), match.end())
                all_matches.append((pii_type, label, start, end))

    # 依位置排序，把互相重疊的匹配合併成一段（例如金鑰後面緊接 @網域、身分證出現在電子郵件裡）。
    # 不合併的話，各自照原本的位置替換會互相踩到：吃掉旁邊的字，或留下半截沒遮的原文。
    # 合併後整段遮掉，標示用其中最長那一筆的種類。
    all_matches.sort(key=lambda x: (x[2], -x[3]))
    groups: list[dict] = []
    for pii_type, label, start, end in all_matches:
        length = end - start
        if groups and start < groups[-1]["end"]:
            g = groups[-1]
            g["end"] = max(g["end"], end)
            if length > g["length"]:
                g.update(type=pii_type, label=label, length=length)
        else:
            groups.append({"start": start, "end": end, "type": pii_type, "label": label, "length": length})

    # 由前往後一次組出遮罩後的文字
    pieces: list[str] = []
    pos = 0
    for g in groups:
        original = text[g["start"]:g["end"]]
        # 遮罩策略：保留頭尾各 2 字元，中間用 * 替代
        if len(original) > 4:
            masked = original[:2] + '*' * (len(original) - 4) + original[-2:]
        else:
            masked = '*' * len(original)

        mask_tag = f"[{g['label']}已遮罩]"

        mask_map.append({
            "original_preview": masked,  # 不回傳完整原文！只給遮罩版
            "masked": mask_tag,
            "type": g["type"],
            "label": g["label"],
            "start": g["start"],
            "end": g["end"],
        })
        pieces.append(text[pos:g["start"]])
        pieces.append(mask_tag)
        pos = g["end"]
    pieces.append(text[pos:])
    masked_text = "".join(pieces)

    has_pii = len(mask_map) > 0

    if has_pii:
        logger.info(f"[PII Masking] 偵測到 {len(mask_map)} 筆敏感資訊：{[m['type'] for m in mask_map]}")

    return MaskResult(
        masked_text=masked_text,
        mask_map=mask_map,
        has_pii=has_pii,
    )
