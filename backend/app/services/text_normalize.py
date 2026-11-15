"""
比對前的文字正規化（三道資安閘道共用）

規則式的偵測最常見的繞過手法，是把字「變形」到樣式比對不到，但人和模型都還看得懂：
  1. 全形英數字：「Ａ１２３４５６７８９」代替「A123456789」
  2. 看不見的字元：在字和字中間插入零寬空格，畫面上看起來完全一樣
  3. 拆字：「忽 略 先 前 指 令」「A-1-2-3-4-5-6-7-8-9」，每個字中間塞空格或符號

這裡不改使用者的原文（全形標點、排版都保持原樣），而是另外產生「比對用的版本」，
並記下每個字對應到原文的哪個位置——偵測到之後可以回到原文準確地遮罩。

刻意不處理的：同形異字（例如西里爾字母的 а 冒充拉丁字母 a）、改寫成同義句、多輪對話誘導。
這些不是規則比對擋得住的，屬於本系統已知的限制。
"""
from __future__ import annotations

import re

# 看不見、不占位置的字元：零寬空格／連接符、方向控制字元、軟連字號、位元組順序標記
_INVISIBLE = frozenset(
    [chr(c) for c in range(0x200B, 0x2010)]
    + [chr(c) for c in range(0x202A, 0x202F)]
    + [chr(c) for c in range(0x2060, 0x2065)]
    + ["­", "﻿", "᠎"]
)

# 全形英數字與半形的位移（Ａ→A、ａ→a、０→0）
_FULLWIDTH_OFFSET = 0xFEE0

# 拆字時常用來隔開的符號
_SYMBOLS = "-_.*|/~^+=" + chr(0x00B7) + chr(0x2022)
_SEP = r"[\s\-_.*|/\~^+=:,]"
# 整段每個字都用空白隔開（6 個字以上才算，避免把「A B C 三個選項」當成拆字）：接回去時只拿掉空白
_SPLIT_SPACE = re.compile(r"(?<!\S)(?:\S\s{1,3}){5,}\S(?!\S)")
# 整段每個字都用同一個符號隔開（A-1-2-3-…）：接回去時只拿掉那個符號
_SPLIT_SYMBOL = [(c, re.compile(rf"(?:[^\s{re.escape(c)}]{re.escape(c)}){{5,}}[^\s{re.escape(c)}]")) for c in _SYMBOLS]
# 中文短詞拆字（「機 密」）：2 個字以上，但前後不能緊貼別的中文字（「司機 密碼」不是拆字）
_CJK = "[" + chr(0x4E00) + "-" + chr(0x9FFF) + "]"
_SPLIT_CJK = re.compile(rf"(?<!{_CJK})(?:{_CJK}{_SEP}{{1,3}})+{_CJK}(?!{_CJK})")
_SEP_CHAR = re.compile(_SEP)

Variant = tuple[str, list[int]]

# 信箱、電話、卡號裡會出現的符號的全形版本：＠ ． ＿ － ＋
_FULLWIDTH_JOINERS = frozenset(chr(c) for c in (0xFF20, 0xFF0E, 0xFF3F, 0xFF0D, 0xFF0B))


def _is_fullwidth_alnum(code: int) -> bool:
    return 0xFF10 <= code <= 0xFF19 or 0xFF21 <= code <= 0xFF3A or 0xFF41 <= code <= 0xFF5A


def _is_alnum(ch: str) -> bool:
    return (ch.isascii() and ch.isalnum()) or _is_fullwidth_alnum(ord(ch))


def fold(text: str) -> Variant:
    """全形英數字轉半形、拿掉看不見的字元。回傳（比對用的文字, 每個字在原文的位置）"""
    out: list[str] = []
    index: list[int] = []
    for i, ch in enumerate(text):
        if ch in _INVISIBLE:
            continue
        code = ord(ch)
        if _is_fullwidth_alnum(code):
            ch = chr(code - _FULLWIDTH_OFFSET)
        elif ch in _FULLWIDTH_JOINERS and (
            (i > 0 and _is_alnum(text[i - 1])) or (i + 1 < len(text) and _is_alnum(text[i + 1]))
        ):
            # 夾在英數字旁邊的全形符號（ａｍｙ＠ｇｍａｉｌ．ｃｏｍ）；一般中文句子裡的全形標點不動
            ch = chr(code - _FULLWIDTH_OFFSET)
        out.append(ch)
        index.append(i)
    return "".join(out), index


def squeeze(text: str, index: list[int]) -> Variant:
    """把被拆開的字接回去（只處理「一個字、一個分隔」這種刻意拆開的片段，一般句子裡的空格不動）"""
    drop = [False] * len(text)
    for match in _SPLIT_SPACE.finditer(text):
        for i in range(match.start(), match.end()):
            if text[i].isspace():
                drop[i] = True
    for symbol, pattern in _SPLIT_SYMBOL:
        for match in pattern.finditer(text):
            for i in range(match.start(), match.end()):
                if text[i] == symbol:
                    drop[i] = True
    for match in _SPLIT_CJK.finditer(text):
        for i in range(match.start(), match.end()):
            if _SEP_CHAR.match(text[i]):
                drop[i] = True
    if not any(drop):
        return text, index
    return "".join(ch for ch, d in zip(text, drop) if not d), [ix for ix, d in zip(index, drop) if not d]


def reassembled(text: str) -> str | None:
    """
    如果這段文字被拆過字：回傳接回去之後的樣子；沒有拆過回傳 None。
    整句拆開再接回去，單字之間原本的空格也不見了（ignoreallpreviousinstructions），
    呼叫的人要用「不看空格」的方式比對。只有確定被拆過才會走這條路，一般句子不受影響。
    """
    folded, folded_index = fold(text)
    squeezed, _ = squeeze(folded, folded_index)
    return squeezed if squeezed != folded else None


def variants(text: str) -> list[Variant]:
    """原文＋正規化後的版本（內容相同的不重複）。每個版本都附「回到原文位置」的對照"""
    identity = list(range(len(text)))
    out: list[Variant] = [(text, identity)]
    folded, folded_index = fold(text)
    if folded != text:
        out.append((folded, folded_index))
    squeezed, squeezed_index = squeeze(folded, folded_index)
    if squeezed != folded:
        out.append((squeezed, squeezed_index))
    return out


def original_span(index: list[int], start: int, end: int) -> tuple[int, int]:
    """比對用文字裡的一段 [start, end) 對應到原文的哪一段"""
    return index[start], index[end - 1] + 1


def was_obfuscated(text: str) -> bool:
    """這段文字有沒有用到上面三種變形（寫稽核用：變形本身就是可疑的訊號）"""
    return len(variants(text)) > 1


__all__ = ["fold", "squeeze", "variants", "original_span", "reassembled", "was_obfuscated"]
