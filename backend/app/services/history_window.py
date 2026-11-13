"""
帶多少對話歷史給模型 (history_window.py)

目標是兩件事同時成立：
  1. 記得住：在字數預算內，盡量把前面的對話都帶上（不是只帶最後幾則）。
  2. 不變慢：推論引擎會重複利用「和上一題開頭相同」的部分，不用重讀。如果每問一題就把最舊的一則擠掉，
     開頭每次都不一樣，整段歷史每題都要重讀一次。所以這裡的起點平常固定不動，只有超過預算時才一次往前跳一大段
     （丟到剩一半預算），之後好幾題都能繼續重複利用。

起點只由「這一則之前的歷史」決定，同一段對話每次算出來都一樣。
"""

from __future__ import annotations

from typing import Sequence


def clip(text: str, limit: int) -> str:
    """單一則太長就截短（貼了一大段文件的那種），免得一則就把預算用完"""
    text = text or ""
    return text if len(text) <= limit else text[:limit] + "…"


def window_start(lengths: Sequence[int], budget: int) -> int:
    """
    從第幾則開始帶。照順序一則一則加進來：加總超過預算，就把起點往後移到剩下的不超過一半預算為止。
    （一半：留空間給接下來的幾輪問答，不會下一題馬上又要移。）
    """
    start, total = 0, 0
    for i, n in enumerate(lengths):
        total += n
        if total > budget:
            while start <= i and total > budget // 2:
                total -= lengths[start]
                start += 1
    return start


def select_history(messages: Sequence, budget_chars: int, message_chars: int) -> list[dict]:
    """
    回傳要帶給模型的歷史（role、content）。messages 是這個對話到目前為止的訊息（有 role、content 屬性），由舊到新。
    """
    clipped = [(m.role, clip(m.content, message_chars)) for m in messages]
    start = window_start([len(text) for _role, text in clipped], budget_chars)
    return [{"role": role, "content": text} for role, text in clipped[start:]]


__all__ = ["clip", "window_start", "select_history"]
