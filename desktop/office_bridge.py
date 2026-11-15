"""
本機小幫手：操控這台電腦上的 Word、Excel、PowerPoint（桌面版程式用）

用 Office 自己的程式介面（COM），不是看螢幕移滑鼠：動作準、使用者看得到 Office 視窗裡的變化、可以按復原。

能做的事（每一件都是使用者在介面上按按鈕才做）：
  status()                 三個程式有沒有安裝、有沒有開著、目前文件叫什麼
  read(app)                讀目前的內容：Word＝選取範圍（沒選就整份）、Excel＝選取範圍（只選一格就整張表）、PowerPoint＝整份簡報的文字
  write(app, markdown)     把 AI 的回答寫進去：Word＝游標處、Excel＝從目前儲存格往右下填、PowerPoint＝在最後加一張投影片
  open_file(filename, b64) 把 AI 產出的檔案存到「文件\\Corphia AI 產出」並用 Office 打開

安全：
  - 改一份「已經存過檔」的文件之前，先備份一份到 %LOCALAPPDATA%\\CorphiaAI\\backups（每份文件每次執行備份一次），回傳備份路徑
  - 只動「目前使用中的那一份」；不關檔、不存檔、不刪東西（存不存由使用者決定）
  - Word 寫錯可以 Ctrl+Z；Excel 用程式寫入不能復原，所以要填的範圍裡只要有資料就不寫，請使用者改選空白的位置
  - Office 正在忙（開著對話框、Excel 正在編輯儲存格）或沒回應時，回給使用者看得懂的原因，不會讓介面一直等
  - open_file 只收 docx／xlsx／pptx，檔名去掉路徑字元，只寫進自己的資料夾
  - 讀出來的內容有長度上限（READ_MAX_CHARS），之後會跟一般訊息一樣經過伺服器的資安檢查

每個方法都回 dict：{"ok": True, ...} 或 {"ok": False, "error": "給使用者看的原因"}。
"""

from __future__ import annotations

import base64
import os
import re
import shutil
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as CallTimeout
from pathlib import Path
from typing import Any, Callable, Optional

APPS = {"word": "Word.Application", "excel": "Excel.Application", "powerpoint": "PowerPoint.Application"}
APP_LABEL = {"word": "Word", "excel": "Excel", "powerpoint": "PowerPoint"}
ALLOWED_EXT = {".docx", ".xlsx", ".pptx"}
READ_MAX_CHARS = 4000
# Excel 一次最多讀多少列、欄（很大的工作表整張讀會卡很久；反正讀出來的字數也有上限）
READ_MAX_ROWS = 400
READ_MAX_COLS = 50
# 一個動作最多等 Office 多久（秒）
CALL_TIMEOUT = 45
# Office 正在忙、暫時不接受操控時回的錯誤代碼（RPC_E_CALL_REJECTED、RPC_E_SERVERCALL_RETRYLATER）
BUSY_CODES = ("-2147418111", "-2147417846")
BUSY_TEXT = "Office 正在忙（可能有對話框開著，或 Excel 正在編輯儲存格）。請先回到 Office 處理完，再試一次"
TIMEOUT_TEXT = "Office 沒有回應（可能有對話框開著）。請回到 Office 處理完再試一次；剛才的動作有可能在 Office 恢復後接著完成"
OUTPUT_FOLDER = "Corphia AI 產出"
MAX_SLIDE_BULLETS = 8

# Word 內建樣式代號（跟 Office 語言無關）
WD_STYLE_NORMAL, WD_STYLE_HEADING1, WD_STYLE_HEADING2, WD_STYLE_LIST_BULLET = -1, -2, -3, -49
PP_LAYOUT_TEXT = 2  # 標題＋內容


class BridgeError(Exception):
    """給使用者看的錯誤（訊息直接顯示在介面上）"""


def _init_com() -> None:
    import pythoncom

    pythoncom.CoInitialize()


# 所有操控 Office 的動作都在這一條專用執行緒上做：連線（COM）只初始化一次、不關。
# 不在呼叫端的執行緒上開關連線——那條執行緒可能是視窗自己的（它也在用 COM），關掉會連帶弄壞別人的東西；
# 一條執行緒也讓動作自然排隊，不會兩個按鈕同時去動同一份文件。
_worker = ThreadPoolExecutor(max_workers=1, thread_name_prefix="office", initializer=_init_com)


def _com(fn: Callable[[], dict]) -> dict:
    # 等太久放棄的動作：如果還在排隊沒開始，就不要再做了（不然使用者以為失敗、之後卻突然寫進去）
    abandoned = threading.Event()

    def run() -> dict:
        if abandoned.is_set():
            return {"ok": False, "error": TIMEOUT_TEXT}
        try:
            return {"ok": True, **fn()}
        except BridgeError as e:
            return {"ok": False, "error": str(e)}
        except Exception as e:  # COM 的錯誤訊息很雜，留前面一段就好
            text = str(e)
            if any(code in text for code in BUSY_CODES):
                return {"ok": False, "error": BUSY_TEXT}
            return {"ok": False, "error": f"操作 Office 時發生錯誤：{text[:160]}"}

    try:
        return _worker.submit(run).result(timeout=CALL_TIMEOUT)
    except CallTimeout:
        abandoned.set()
        return {"ok": False, "error": TIMEOUT_TEXT}


def _running(app: str):
    """已經開著的那個程式；沒開回 None"""
    import win32com.client

    try:
        return win32com.client.GetActiveObject(APPS[app])
    except Exception:
        return None


def _start(app: str):
    """開著就用開著的，沒開就啟動並顯示出來"""
    import win32com.client

    inst = _running(app)
    if inst is None:
        inst = win32com.client.Dispatch(APPS[app])
    inst.Visible = True
    return inst


def _installed(app: str) -> bool:
    import winreg

    try:
        winreg.CloseKey(winreg.OpenKey(winreg.HKEY_CLASSES_ROOT, APPS[app] + "\\CLSID"))
        return True
    except OSError:
        return False


# ── 文字整理 ──────────────────────────────────────────────────────────────
_INLINE_RE = re.compile(r"\*\*(.+?)\*\*|__(.+?)__|`([^`]+)`|\*(.+?)\*")
_TABLE_SEP_RE = re.compile(r"^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$")
_NUM_RE = re.compile(r"^-?\d{1,3}(?:,\d{3})*(?:\.\d+)?$|^-?\d+(?:\.\d+)?$")


def _plain(text: str) -> str:
    """拿掉粗體、行內程式碼等標記，只留字"""
    return _INLINE_RE.sub(lambda m: next(g for g in m.groups() if g is not None), text).strip()


def parse_markdown(md: str) -> list[tuple[str, Any]]:
    """AI 的回答（Markdown）→ 一段一段：("h1"|"h2"|"p"|"li", 文字) 或 ("table", [[格子…]…])"""
    blocks: list[tuple[str, Any]] = []
    table: list[list[str]] = []

    def flush_table():
        nonlocal table
        if table:
            blocks.append(("table", table))
            table = []

    for raw in (md or "").replace("\r\n", "\n").split("\n"):
        line = raw.strip()
        if line.startswith("|") and line.count("|") >= 2:
            if not _TABLE_SEP_RE.match(line):
                table.append([_plain(c) for c in line.strip("|").split("|")])
            continue
        flush_table()
        if not line or line.startswith("```"):
            continue
        m = re.match(r"^(#{1,6})\s+(.*)$", line)
        if m:
            blocks.append(("h1" if len(m.group(1)) <= 2 else "h2", _plain(m.group(2))))
            continue
        m = re.match(r"^(?:[-*•]|\d+[.)、])\s+(.*)$", line)
        if m:
            blocks.append(("li", _plain(m.group(1))))
            continue
        blocks.append(("p", _plain(line)))
    flush_table()
    return blocks


def _value(cell: str):
    """
    看起來是數字的給數字；其他給文字。
    前面加單引號＝告訴 Excel「這是純文字」：開頭 0 的編號（不加會被 Excel 變成數字，007 變 7）、
    公式開頭的字（= + @ -，不加會被當成公式執行）。
    """
    s = (cell or "").strip()
    if _NUM_RE.match(s):
        if len(s) > 1 and s[0] == "0" and "." not in s:
            return "'" + s
        n = float(s.replace(",", ""))
        return int(n) if n.is_integer() else n
    return "'" + s if s[:1] in "=+@-" else s


def _clip(text: str) -> tuple[str, bool]:
    text = (text or "").replace("\r", "\n").replace("\x07", "").strip()
    text = re.sub(r"\n{3,}", "\n\n", text)
    return (text[:READ_MAX_CHARS], True) if len(text) > READ_MAX_CHARS else (text, False)


# ── 備份 ──────────────────────────────────────────────────────────────────
_backed_up: set[str] = set()


def backup_dir() -> Path:
    return Path(os.environ.get("LOCALAPPDATA") or Path.home()) / "CorphiaAI" / "backups"


def _backup(full_name: str) -> Optional[str]:
    """改已存檔的文件前備份一份（雲端路徑或還沒存過的文件沒有本機檔可備份，回 None）"""
    try:
        src = Path(full_name)
        if not full_name or "://" in full_name or not src.is_file():
            return None
        key = str(src).lower()
        if key in _backed_up:
            return None
        dest = backup_dir() / f"{src.stem}.{time.strftime('%Y%m%d-%H%M%S')}{src.suffix}"
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)
        _backed_up.add(key)
        return str(dest)
    except OSError:
        return None


# ── 對外的四件事 ──────────────────────────────────────────────────────────
def status() -> dict:
    def run():
        out = {}
        for app in APPS:
            inst = _running(app) if _installed(app) else None
            name = ""
            try:
                if inst is not None:
                    doc = {"word": lambda: inst.ActiveDocument, "excel": lambda: inst.ActiveWorkbook, "powerpoint": lambda: inst.ActivePresentation}[app]()
                    name = doc.Name if doc is not None else ""
            except Exception:
                name = ""
            out[app] = {"installed": _installed(app), "running": inst is not None, "document": name}
        return {"apps": out}

    return _com(run)


def read(app: str) -> dict:
    def run():
        if app not in APPS:
            raise BridgeError("不支援的程式")
        inst = _running(app)
        if inst is None:
            raise BridgeError(f"{APP_LABEL[app]} 沒有開著，請先打開要讀的檔案")
        if app == "word":
            if inst.Documents.Count == 0:
                raise BridgeError("Word 沒有開啟的文件")
            doc, sel = inst.ActiveDocument, inst.Selection
            picked = (sel.Text or "").strip() if sel is not None and sel.Start != sel.End else ""
            text, scope = (picked, "selection") if picked else (doc.Content.Text, "document")
            name = doc.Name
        elif app == "excel":
            if inst.Workbooks.Count == 0:
                raise BridgeError("Excel 沒有開啟的活頁簿")
            rng = inst.Selection
            scope = "selection"
            if rng is None or rng.Cells.Count <= 1:
                rng, scope = inst.ActiveSheet.UsedRange, "sheet"
            rows_total, cols_total = rng.Rows.Count, rng.Columns.Count
            too_big = rows_total > READ_MAX_ROWS or cols_total > READ_MAX_COLS
            if too_big:
                # 太大的範圍只讀左上角這一塊（用列號、欄號算，理由同 write 的說明）
                sheet = rng.Worksheet
                rng = sheet.Range(
                    sheet.Cells(rng.Row, rng.Column),
                    sheet.Cells(rng.Row + min(rows_total, READ_MAX_ROWS) - 1, rng.Column + min(cols_total, READ_MAX_COLS) - 1),
                )
            values = rng.Value
            rows = values if isinstance(values, tuple) else ((values,),)
            lines = ["\t".join("" if v is None else (str(int(v)) if isinstance(v, float) and v.is_integer() else str(v)) for v in row) for row in rows]
            text = "\n".join(line for line in lines if line.strip())
            name = f"{inst.ActiveWorkbook.Name} / {inst.ActiveSheet.Name}"
        else:
            if inst.Presentations.Count == 0:
                raise BridgeError("PowerPoint 沒有開啟的簡報")
            pres = inst.ActivePresentation
            parts = []
            for i in range(1, pres.Slides.Count + 1):
                texts = []
                for shape in pres.Slides(i).Shapes:
                    if shape.HasTextFrame and shape.TextFrame.HasText:
                        texts.append(shape.TextFrame.TextRange.Text.replace("\r", "\n").strip())
                if texts:
                    parts.append(f"【第 {i} 張】\n" + "\n".join(texts))
            text, scope, name = "\n\n".join(parts), "presentation", pres.Name
        clipped, truncated = _clip(text)
        if not clipped:
            raise BridgeError(f"{APP_LABEL[app]} 目前的內容是空的")
        truncated = truncated or (app == "excel" and too_big)
        return {"app": app, "name": name, "scope": scope, "text": clipped, "chars": len(clipped), "truncated": truncated}

    return _com(run)


def write(app: str, markdown: str) -> dict:
    def run():
        if app not in APPS:
            raise BridgeError("不支援的程式")
        blocks = parse_markdown(markdown)
        if not blocks:
            raise BridgeError("沒有可以寫入的內容")
        if not _installed(app):
            raise BridgeError(f"這台電腦沒有安裝 {APP_LABEL[app]}")
        inst = _start(app)

        if app == "word":
            doc = inst.ActiveDocument if inst.Documents.Count else inst.Documents.Add()
            backup = _backup(doc.FullName if doc.Path else "")
            sel = inst.Selection
            styles = {"h1": WD_STYLE_HEADING1, "h2": WD_STYLE_HEADING2, "li": WD_STYLE_LIST_BULLET, "p": WD_STYLE_NORMAL}
            count = 0
            # 游標停在一段已經有字的段落裡（沒有選取）：先換一段再寫，
            # 不然寫進去的標題／條列樣式會套到使用者原本那一段上
            if sel.Start == sel.End and sel.Paragraphs.Count and sel.Paragraphs(1).Range.Text.strip("\r\n\x07 "):
                sel.TypeParagraph()
            for kind, value in blocks:
                if kind == "table":
                    for row in value:
                        sel.Style = doc.Styles(WD_STYLE_NORMAL)
                        sel.TypeText("\t".join(row))
                        sel.TypeParagraph()
                        count += 1
                    continue
                sel.Style = doc.Styles(styles[kind])
                sel.TypeText(value)
                sel.TypeParagraph()
                count += 1
            sel.Style = doc.Styles(WD_STYLE_NORMAL)
            inst.Activate()
            return {"app": app, "name": doc.Name, "detail": f"已在 Word 游標處寫入 {count} 段", "backup": backup}

        if app == "excel":
            wb = inst.ActiveWorkbook if inst.Workbooks.Count else inst.Workbooks.Add()
            backup = _backup(wb.FullName if wb.Path else "")
            rows = next((v for k, v in blocks if k == "table"), None) or [[v] for k, v in blocks if k != "table"]
            width = max(len(r) for r in rows)
            data = tuple(tuple(_value(c) for c in list(r) + [""] * (width - len(r))) for r in rows)
            start = inst.ActiveCell
            sheet = inst.ActiveSheet
            # 右下角用列號、欄號算（不用 Offset：這個介面下 Offset(1,1) 會被當成「第 1 格」而不是「位移 1」）
            target = sheet.Range(start, sheet.Cells(start.Row + len(data) - 1, start.Column + width - 1))
            # Excel 用程式寫入不能按復原：要填的範圍裡只要有資料就不寫，請使用者改選空白的位置
            filled = int(inst.WorksheetFunction.CountA(target))
            if filled:
                where = target.Address.replace("$", "")
                raise BridgeError(f"要填入的範圍（{where}）裡已經有 {filled} 格有資料，為了不蓋掉原本的內容沒有寫入。請先點一個空白的位置再試一次")
            target.Value = data
            target.Columns.AutoFit()
            return {"app": app, "name": wb.Name, "detail": f"已從 {start.Address.replace('$', '')} 填入 {len(data)} 列 {width} 欄", "backup": backup}

        pres = inst.ActivePresentation if inst.Presentations.Count else inst.Presentations.Add()
        backup = _backup(pres.FullName if pres.Path else "")
        title = next((v for k, v in blocks if k in ("h1", "h2")), None)
        rest = [v if k != "table" else " ｜ ".join(v[0]) for k, v in blocks if not (k in ("h1", "h2") and v == title)]
        if title is None:
            title, rest = (rest[0], rest[1:]) if rest else ("", [])
        bullets = [b for b in rest if b][:MAX_SLIDE_BULLETS]
        slide = pres.Slides.Add(pres.Slides.Count + 1, PP_LAYOUT_TEXT)
        slide.Shapes(1).TextFrame.TextRange.Text = title[:120]
        slide.Shapes(2).TextFrame.TextRange.Text = "\r".join(bullets)
        try:
            inst.ActiveWindow.View.GotoSlide(slide.SlideIndex)
        except Exception:
            pass  # 沒有視窗（例如剛新增的簡報還沒顯示）不影響結果
        return {"app": app, "name": pres.Name, "detail": f"已新增第 {slide.SlideIndex} 張投影片（{len(bullets)} 個重點）", "backup": backup}

    return _com(run)


def output_dir() -> Path:
    return Path.home() / "Documents" / OUTPUT_FOLDER


def open_file(filename: str, data_b64: str) -> dict:
    def run():
        name = re.sub(r'[\\/:*?"<>|\r\n\t]', " ", os.path.basename(filename or "")).strip(" .")
        ext = Path(name).suffix.lower()
        if not name or ext not in ALLOWED_EXT:
            raise BridgeError("只能開啟 Word、Excel、PowerPoint 檔")
        try:
            data = base64.b64decode(data_b64 or "", validate=True)
        except ValueError:
            raise BridgeError("檔案內容不完整，請重新下載")
        if not data.startswith(b"PK"):  # docx／xlsx／pptx 都是 zip
            raise BridgeError("檔案格式不對")
        folder = output_dir()
        folder.mkdir(parents=True, exist_ok=True)
        path = folder / name
        n = 2
        while path.exists():  # 不覆蓋使用者已經有的檔案
            path = folder / f"{Path(name).stem} ({n}){ext}"
            n += 1
        path.write_bytes(data)
        os.startfile(str(path))  # 用預設程式（Office）打開
        return {"path": str(path), "name": path.name}

    return _com(run)
