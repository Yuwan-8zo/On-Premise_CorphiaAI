"""
模型「回答」的檢查：送到使用者畫面、存進資料庫之前再過一關

進模型之前已經篩過（message_guard、context_guard），這裡處理的是「模型自己寫出來」的東西：
  1. 外部圖片：回答裡的 ![說明](http…) 或 <img src="http…">。畫面一顯示，瀏覽器就會自動連到那個網址——
     被惡意內容誘導的模型可以把資料夾帶在網址裡送出公司（常見的資料外洩手法）。一律換成純文字，不留網址。
  2. 個資：身分證、信用卡、手機、電子郵件等。照理說進模型前都遮過了，模型看不到原值；
     這裡是第二道，擋的是模型自己編出來、或從漏網內容拼出來的。
  3. 控制字元：拿掉看不見的控制字元（保留換行、定位）。

串流的難處：樣式可能被切在兩段之間（「A1234」「56789」）。做法是把結尾「還可能是樣式開頭」的那一小段先留著，
等後面的字到了再判斷：中文內容不會被留住（照常一個字一個字出來），只有英數字尾巴和還沒寫完的圖片語法會稍等。

用法（每一則回答一個）：
    screen = OutputScreen()
    out = screen.feed(chunk)   # 可以先送出去的部分（可能是空字串）
    out = screen.flush()       # 結束時把留著的送完
    screen.report              # {"pii": 遮罩了幾個, "images": 拿掉幾張外部圖片}
"""

from __future__ import annotations

import re

from app.core.config import settings
from app.services.pii_masking_service import mask_pii

# 結尾最多留多少字等後續（個資樣式最長的是電子郵件、帶分隔的卡號）
HOLD_TAIL_MAX = 48
# 還沒寫完的圖片語法最多留多少字（超過就不等了，當一般文字處理）
HOLD_IMAGE_MAX = 600

# 可能屬於個資樣式的字元（英數字、@ . - _ + 和空白）；中文等其他字元一出現就代表前面的樣式結束了
_TOKEN_CHARS = frozenset("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz@._-+ ")
# 外部圖片：Markdown 與 HTML 兩種寫法；網址是 http(s) 或省略協定的 //
_MD_IMAGE_RE = re.compile(r"!\[([^\]\n]{0,200})\]\(\s*<?(?:https?:)?//[^)\n]{0,2000}\)", re.I)
_HTML_IMAGE_RE = re.compile(r"<img\b[^>]{0,2000}>", re.I)
_CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
IMAGE_NOTE = "（已移除外部圖片{alt}）"


def _strip_images(text: str) -> tuple[str, int]:
    count = 0

    def md(m: re.Match) -> str:
        nonlocal count
        count += 1
        alt = m.group(1).strip()
        return IMAGE_NOTE.format(alt=f"：{alt}" if alt else "")

    def html(m: re.Match) -> str:
        nonlocal count
        count += 1
        return IMAGE_NOTE.format(alt="")

    return _HTML_IMAGE_RE.sub(html, _MD_IMAGE_RE.sub(md, text)), count


def screen_output(text: str) -> tuple[str, dict]:
    """一整段文字一次檢查（非串流用；串流用 OutputScreen）"""
    report = {"pii": 0, "images": 0}
    if not settings.enable_output_guard:
        return text, report
    out = _CONTROL_RE.sub("", text or "")
    out, report["images"] = _strip_images(out)
    if settings.enable_pii_masking:
        masked = mask_pii(out)
        if masked["has_pii"]:
            report["pii"] = len(masked["mask_map"])
            out = masked["masked_text"]
    return out, report


class OutputScreen:
    """串流版：feed() 回傳可以先送出去的部分，結尾可能還沒完整的樣式先留著"""

    def __init__(self) -> None:
        self._pending = ""
        self.report = {"pii": 0, "images": 0}

    def _emit(self, text: str) -> str:
        out, report = screen_output(text)
        self.report["pii"] += report["pii"]
        self.report["images"] += report["images"]
        return out

    def _safe_cut(self) -> int:
        """pending 裡可以放心送出去到哪裡（後面的要留著等）"""
        p = self._pending
        cut = len(p)
        # 結尾連續的「樣式字元」先留著（最多 HOLD_TAIL_MAX 個）
        low = max(0, cut - HOLD_TAIL_MAX)
        while cut > low and p[cut - 1] in _TOKEN_CHARS:
            cut -= 1
        # 還沒寫完的圖片：從 ![ 或 <img 開始留著（太長就不等了）
        for marker in ("![", "<img", "<IMG"):
            i = p.rfind(marker, max(0, len(p) - HOLD_IMAGE_MAX))
            if i != -1 and i < cut:
                rest = p[i:]
                closed = (")" in rest) if marker == "![" else (">" in rest)
                if not closed:
                    cut = i
        # 結尾單獨一個「!」或「<」可能是圖片語法的開頭
        if cut and p[cut - 1] in "!<":
            cut -= 1
        return cut

    def feed(self, chunk: str) -> str:
        if not settings.enable_output_guard:
            return chunk
        self._pending += chunk or ""
        cut = self._safe_cut()
        if cut <= 0:
            return ""
        ready, self._pending = self._pending[:cut], self._pending[cut:]
        return self._emit(ready)

    def flush(self) -> str:
        if not settings.enable_output_guard:
            return ""
        ready, self._pending = self._pending, ""
        return self._emit(ready) if ready else ""

    @property
    def changed(self) -> bool:
        return bool(self.report["pii"] or self.report["images"])
