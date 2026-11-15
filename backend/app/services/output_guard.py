"""
模型「回答」的檢查：送到使用者畫面、存進資料庫之前再過一關

進模型之前已經篩過（message_guard、context_guard），這裡處理的是「模型自己寫出來」的東西：
  1. 外部圖片：回答裡的 ![說明](http…) 或 <img src="http…">。畫面一顯示，瀏覽器就會自動連到那個網址——
     被惡意內容誘導的模型可以把資料夾帶在網址裡送出公司（常見的資料外洩手法）。一律換成純文字，不留網址。
  2. 個資：身分證、信用卡、手機、電子郵件等。照理說進模型前都遮過了，模型看不到原值；
     這裡是第二道，擋的是模型自己編出來、或從漏網內容拼出來的。
  3. 控制字元：拿掉看不見的控制字元（保留換行、定位）。

串流的難處：樣式可能被切在兩段之間（「A1234」「56789」）。做法是把結尾「還可能是樣式開頭」的那一小段先留著，
等後面的字到了再判斷：中文內容不會被留住（照常一個字一個字出來），只有還沒寫完的英數字詞、圖片語法會稍等。
串流和整段檢查一樣分兩關，順序也一樣：
  第一關（圖片）：還沒寫完、但還可能變成圖片的語法先留著；完整的圖片拿掉後，才交給第二關
  第二關（個資）：只在「不會把樣式切成兩半」的地方切（見 _pii_cut）
    - 中文、標點後面可以切；英文在「詞與詞之間的空白」可以切（數字後面的空白不行：卡號、手機中間有空白）
    - 「統編 12345678」「護照號碼：123456789」這種要看前後文的：關鍵字和號碼要留在同一段
目標是「不管怎麼切段，結果都和整段一次檢查一樣」（tests/test_output_guard.py 用隨機切段驗證）。

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

# 一個沒有空白、還沒寫完的英數字詞最多留多少字等後續（金鑰類可以到一百多字；一般文字遇到空白、中文就會放行，不會等這麼久）
HOLD_TAIL_MAX = 256
# 還沒寫完的圖片語法最多留多少字（和下面圖片樣式能吃的長度一致；超過就不等了，當一般文字處理）
HOLD_IMAGE_MAX = 2300

# 可能屬於個資樣式的字元（英數字、@ . - _ + 和空白）；中文等其他字元一出現就代表前面的樣式結束了
_TOKEN_CHARS = frozenset("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz@._-+ ")
# 外部圖片：Markdown 與 HTML 兩種寫法；網址是 http(s) 或省略協定的 //
_MD_IMAGE_RE = re.compile(r"!\[([^\]\n]{0,200})\]\(\s*<?(?:https?:)?//[^)\n]{0,2000}\)", re.I)
_HTML_IMAGE_RE = re.compile(r"<img\b[^>]{0,2000}>", re.I)
_CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
# 「還沒寫完、但還可能變成圖片」的開頭（要整段比對到結尾）：![說明  →  ![說明](  →  ![說明](網址…
# 「![重點] 之後是一般文字」這種不會成立，不用留著等
_MD_IMAGE_OPEN_RE = re.compile(r"!\[[^\]\n]{0,200}(?:\](?:\(\s*[^)\n]{0,2010})?)?")
_HTML_IMAGE_OPEN_RE = re.compile(r"<img\b[^>]{0,2000}", re.I)
IMAGE_NOTE = "（已移除外部圖片{alt}）"
# 要看前後文才算個資的樣式（pii_masking_service 的統一編號、護照號碼）：關鍵字、關鍵字還沒寫完的開頭、號碼
_KEYWORD_RE = re.compile(r"統一?編號|統編|VAT|護照(?:號碼|號)?|passport", re.I)
_KEYWORD_PREFIXES = ("統一編", "統一", "統", "護")
_CONTEXT_DIGITS_RE = re.compile(r"(?<!\d)\d{8,9}(?!\d)")
# 關鍵字和號碼之間最多隔幾個字（和 pii_masking_service 的樣式一致）、最長的關鍵字幾個字
_CONTEXT_GAP = 20
_KEYWORD_MAX = 8
# 「關鍵字＋號碼」整組（兩種順序）：已經到齊的整組不能被切成兩段
_CONTEXT_UNIT_RE = re.compile(
    rf"(?:{_KEYWORD_RE.pattern})[^\d]{{0,{_CONTEXT_GAP}}}\d{{8,9}}(?!\d)|(?<!\d)\d{{8,9}}[^\d]{{0,{_CONTEXT_GAP}}}(?:{_KEYWORD_RE.pattern})",
    re.I,
)


def _is_boundary(p: str, i: int) -> bool:
    """可不可以在 p[i] 前面切：前一個字不是樣式字元；或是空白（含換行）、而且空白前面不是數字（卡號、手機中間的空白不能切）"""
    if i == 0:
        return True
    c = p[i - 1]
    if c.isspace():
        return i < 2 or not p[i - 2].isdigit()
    return c not in _TOKEN_CHARS


def _keyword_pending(p: str) -> int:
    """有關鍵字後面的號碼還沒寫完（或還沒出現）→ 回最前面那個關鍵字開頭的位置；不用等回 -1"""
    for m in _KEYWORD_RE.finditer(p):
        rest = p[m.end():]
        gap = 0
        while gap < len(rest) and gap <= _CONTEXT_GAP and not rest[gap].isdigit():
            gap += 1
        if gap > _CONTEXT_GAP:
            continue                   # 隔太遠，不會是它的號碼了
        if gap == len(rest):
            return m.start()           # 號碼還沒出現
        end = gap
        while end < len(rest) and rest[end].isdigit():
            end += 1
        if end == len(rest):
            return m.start()           # 號碼寫到結尾＝可能還沒寫完
    return -1


def _units(p: str) -> list[tuple[int, int]]:
    """不能被切成兩段的範圍：已經到齊的「關鍵字＋號碼」（互相重疊的也要，所以從每個關鍵字、每個號碼的開頭各比一次）"""
    spans: list[tuple[int, int]] = []
    starts = {m.start() for m in _KEYWORD_RE.finditer(p)} | {m.start() for m in _CONTEXT_DIGITS_RE.finditer(p)}
    for i in starts:
        m = _CONTEXT_UNIT_RE.match(p, i)
        if m:
            spans.append(m.span())
    return spans


def _image_pending(p: str) -> int:
    """還沒寫完、但還可能變成圖片的語法從哪裡開始（最前面那個）；沒有回 -1"""
    start = max(0, len(p) - HOLD_IMAGE_MAX)
    found = -1
    for marker, rx in (("![", _MD_IMAGE_OPEN_RE), ("<img", _HTML_IMAGE_OPEN_RE)):
        text = p if marker == "![" else p.lower()
        i = text.find(marker, start)
        while i != -1:
            if rx.fullmatch(p, i):
                found = i if found == -1 else min(found, i)
                break
            i = text.find(marker, i + 1)
    return found


def _digits_pending(p: str) -> int:
    """最後一個 8～9 位數字後面可能接「統編／護照」→ 回數字開頭的位置；不用等回 -1"""
    last = None
    for m in _CONTEXT_DIGITS_RE.finditer(p):
        last = m
    if last is None:
        return -1
    rest = p[last.end():]
    if any(ch.isdigit() for ch in rest) or _KEYWORD_RE.search(rest):
        return -1                      # 後面又有數字（樣式斷了）或關鍵字已經到齊（這一段就能判斷）
    return last.start() if len(rest) < _CONTEXT_GAP + _KEYWORD_MAX else -1


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


def _image_cut(p: str) -> int:
    """第一關：原文可以放心交給「拿掉圖片」處理到哪裡（還沒寫完的圖片語法留著）"""
    cut = len(p)
    image = _image_pending(p)
    if image != -1:
        cut = image
    # 結尾是「!」或「<img」還沒寫完的開頭（<、<i、<im），可能是圖片語法的開頭
    tail = p[:cut][-3:].lower()
    for start in ("<im", "<i", "<", "!"):
        if tail.endswith(start):
            cut -= len(start)
            break
    return cut


def _pii_cut(p: str) -> int:
    """第二關：拿掉圖片後的文字可以放心送出去到哪裡（後面的要留著等）"""
    low = max(0, len(p) - HOLD_TAIL_MAX)

    def settle(cut: int) -> int:
        # 往回退到最近一個「可以切」的地方；還沒寫完的英數字詞留著（最多 HOLD_TAIL_MAX 個字，超過就不等了）
        while cut > low and not _is_boundary(p, cut):
            cut -= 1
        return cut

    cut = settle(len(p))
    # 要看前後文的個資：關鍵字（或它還沒寫完的開頭）和號碼要留在同一段
    for hold in (_keyword_pending(p), _digits_pending(p)):
        if hold != -1:
            cut = min(cut, hold)
    for prefix in _KEYWORD_PREFIXES:
        if p.endswith(prefix):
            cut = min(cut, len(p) - len(prefix))
            break
    # 已經到齊的「關鍵字＋號碼」整組不能被切開；切點移動後要再確認落在可切的位置（做到不再變動為止）
    units = _units(p)
    while True:
        before = cut
        for start, end in units:
            if start < cut < end:
                cut = start
        cut = settle(cut)
        if cut == before:
            return cut


class OutputScreen:
    """串流版：feed() 回傳可以先送出去的部分，結尾可能還沒完整的樣式先留著"""

    def __init__(self) -> None:
        self._raw = ""       # 第一關：還沒處理圖片的原文
        self._pending = ""   # 第二關：圖片處理完、還沒遮個資的文字
        self.report = {"pii": 0, "images": 0}

    def _advance(self, final: bool) -> str:
        # 第一關：圖片
        cut = len(self._raw) if final else _image_cut(self._raw)
        if cut > 0:
            ready, self._raw = self._raw[:cut], self._raw[cut:]
            stripped, images = _strip_images(ready)
            self.report["images"] += images
            self._pending += stripped
        # 第二關：個資
        cut = len(self._pending) if final else _pii_cut(self._pending)
        if cut <= 0:
            return ""
        ready, self._pending = self._pending[:cut], self._pending[cut:]
        if settings.enable_pii_masking:
            masked = mask_pii(ready)
            if masked["has_pii"]:
                self.report["pii"] += len(masked["mask_map"])
                ready = masked["masked_text"]
        return ready

    def feed(self, chunk: str) -> str:
        if not settings.enable_output_guard:
            return chunk
        self._raw += _CONTROL_RE.sub("", chunk or "")
        return self._advance(final=False)

    def flush(self) -> str:
        if not settings.enable_output_guard:
            return ""
        return self._advance(final=True)

    @property
    def changed(self) -> bool:
        return bool(self.report["pii"] or self.report["images"])
