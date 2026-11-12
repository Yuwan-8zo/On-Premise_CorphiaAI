"""
AI 產出檔案：把模型寫的「內容規格」（JSON）排版成 Word、Excel、簡報檔

分工：模型只負責內容（標題、段落、表格、每張投影片的重點），用引擎的語法限制輸出固定格式的 JSON，
所以小模型也不會寫壞格式；排版、字型、樣式全部由這裡的程式做，每次長得都一樣整齊。

  detect_file_request(text)  使用者是不是在要求「做一份檔案」，要哪一種
  SCHEMAS / INSTRUCTIONS     每一種檔案的內容規格與給模型的說明
  build_file(kind, spec)     規格 → 檔案內容（bytes）
  outline(kind, spec)        給使用者看的大綱（放在回答裡）

這個模組不碰資料庫、不碰模型；存檔與權限在 services/generated_files.py。
"""

from __future__ import annotations

import io
import json
import re
from typing import Optional

KIND_DOCX = "docx"
KIND_XLSX = "xlsx"
KIND_PPTX = "pptx"
KINDS = (KIND_DOCX, KIND_XLSX, KIND_PPTX)

MIME = {
    KIND_DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    KIND_XLSX: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    KIND_PPTX: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}

# 版面設定（只在這裡定義一次）
FONT = "Microsoft JhengHei"  # 微軟正黑體：Windows 內建，中文不會掉回新細明體
MAX_SECTIONS, MAX_ITEMS = 12, 10
MAX_SHEETS, MAX_COLS, MAX_ROWS = 4, 12, 60
MAX_SLIDES, MAX_BULLETS = 15, 6
SLIDE_W_IN, SLIDE_H_IN = 13.333, 7.5  # 16:9
COL_WIDTH_MIN, COL_WIDTH_MAX = 10, 48
ACCENT_HEX = "0A84FF"

# ── 判斷使用者是不是要檔案 ────────────────────────────────────────────────
_KIND_RES = [
    (KIND_PPTX, re.compile(r"簡報|投影片|ppt|powerpoint|slides?\b|スライド|プレゼン", re.I)),
    (KIND_XLSX, re.compile(r"excel|xlsx|試算表|工作表|spreadsheet|エクセル|表計算", re.I)),
    (KIND_DOCX, re.compile(r"\bword\b|docx|word\s*檔|word\s*文件|文件檔|ワード", re.I)),
]
_MAKE_RE = re.compile(
    r"做|製作|產生|產出|建立|生成|撰寫|寫|整理成|整理一份|匯出|輸出|轉成|存成|擬|"
    r"\b(?:create|make|generate|export|draft|build|write|prepare)\b|作って|作成|書いて",
    re.I,
)
# 「Word 怎麼設定頁碼」「如何做簡報」是在問用法，不是要檔案
_HOWTO_RE = re.compile(r"怎麼|怎樣|如何|為什麼|是什麼|\bhow\s+(?:do|to|can)\b|\bwhat\s+is\b|どうやって|方法", re.I)


def detect_file_request(text: str) -> Optional[str]:
    """使用者這句話是不是要求做一份檔案；是就回種類（docx／xlsx／pptx），不是回 None"""
    t = text or ""
    if not _MAKE_RE.search(t) or _HOWTO_RE.search(t):
        return None
    for kind, rx in _KIND_RES:
        if rx.search(t):
            return kind
    return None


# ── 內容規格（引擎照這個限制模型的輸出）────────────────────────────────────
def _str(max_len: int) -> dict:
    return {"type": "string", "maxLength": max_len}


SCHEMAS: dict[str, dict] = {
    KIND_DOCX: {
        "type": "object",
        "properties": {
            "title": _str(60),
            "sections": {
                "type": "array", "minItems": 1, "maxItems": MAX_SECTIONS,
                "items": {
                    "type": "object",
                    "properties": {
                        "heading": _str(60),
                        "paragraphs": {"type": "array", "maxItems": MAX_ITEMS, "items": _str(600)},
                        "bullets": {"type": "array", "maxItems": MAX_ITEMS, "items": _str(200)},
                    },
                    "required": ["heading", "paragraphs", "bullets"],
                },
            },
        },
        "required": ["title", "sections"],
    },
    KIND_XLSX: {
        "type": "object",
        "properties": {
            "title": _str(60),
            "sheets": {
                "type": "array", "minItems": 1, "maxItems": MAX_SHEETS,
                "items": {
                    "type": "object",
                    "properties": {
                        "name": _str(24),
                        "columns": {"type": "array", "minItems": 1, "maxItems": MAX_COLS, "items": _str(30)},
                        # 每一格可以是文字或數字：只准文字的話，模型想寫數字時會被格式擋住，亂加前綴（實測出現過 user_input_1200000）
                        "rows": {"type": "array", "maxItems": MAX_ROWS, "items": {"type": "array", "maxItems": MAX_COLS, "items": {"anyOf": [_str(120), {"type": "number"}]}}},
                    },
                    "required": ["name", "columns", "rows"],
                },
            },
        },
        "required": ["title", "sheets"],
    },
    KIND_PPTX: {
        "type": "object",
        "properties": {
            "title": _str(60),
            "subtitle": _str(80),
            "slides": {
                "type": "array", "minItems": 1, "maxItems": MAX_SLIDES,
                "items": {
                    "type": "object",
                    "properties": {
                        "title": _str(50),
                        "bullets": {"type": "array", "minItems": 1, "maxItems": MAX_BULLETS, "items": _str(90)},
                    },
                    "required": ["title", "bullets"],
                },
            },
        },
        "required": ["title", "subtitle", "slides"],
    },
}

_COMMON = (
    "內容要具體、完整、可以直接使用；不要寫「待補」「請自行填寫」之類的空話。"
    "使用者或參考資料沒有提供的數字、人名、日期不要編造，也不要寫程式碼或代號充數：那一格（那一句）直接留空。只輸出 JSON。"
)
INSTRUCTIONS: dict[str, str] = {
    KIND_DOCX: "使用者要一份 Word 文件。請輸出文件內容的 JSON：title 是文件標題；sections 是章節，每個章節有 heading（小標題）、"
               "paragraphs（幾段完整的文字）、bullets（條列重點，沒有就給空陣列）。" + _COMMON,
    KIND_XLSX: "使用者要一份 Excel 試算表。請輸出表格內容的 JSON：title 是檔案標題；sheets 是工作表，每張有 name（工作表名稱）、"
               "columns（欄位名稱）、rows（每一列的值，順序和 columns 一樣；每一格只放那一欄的值；數字直接寫數字，不加引號、單位或其他字）。"
               '格式範例（內容不要照抄）：columns ["品項","數量"]，rows [["甲",3],["乙",12]]。' + _COMMON,
    KIND_PPTX: "使用者要一份簡報。請輸出簡報內容的 JSON：title 是簡報標題、subtitle 是副標題；slides 是每一張投影片，"
               "每張有 title（標題）和 bullets（3 到 5 個重點，每個重點一句話）。" + _COMMON,
}


# ── 排版 ──────────────────────────────────────────────────────────────────
def _clean(value, limit: int = 2000) -> str:
    return re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", str(value if value is not None else "")).strip()[:limit]


def safe_filename(title: str, kind: str) -> str:
    """檔名：拿掉 Windows 不能用的字元；空的就叫「AI 產出」"""
    name = re.sub(r'[\\/:*?"<>|\r\n\t]', " ", _clean(title, 60)).strip(" .") or "AI 產出"
    return f"{name}.{kind}"


def _docx(spec: dict) -> bytes:
    from docx import Document
    from docx.oxml.ns import qn
    from docx.shared import Pt

    doc = Document()
    for style_name in ("Normal", "Title", "Heading 1", "List Bullet"):
        style = doc.styles[style_name]
        style.font.name = FONT
        style.element.rPr.rFonts.set(qn("w:eastAsia"), FONT)  # 中文字型要另外設，不然會用預設的新細明體
    doc.styles["Normal"].font.size = Pt(12)
    doc.add_heading(_clean(spec.get("title")) or "文件", level=0)
    for sec in spec.get("sections") or []:
        heading = _clean(sec.get("heading"))
        if heading:
            doc.add_heading(heading, level=1)
        for para in sec.get("paragraphs") or []:
            if _clean(para):
                doc.add_paragraph(_clean(para))
        for item in sec.get("bullets") or []:
            if _clean(item):
                doc.add_paragraph(_clean(item), style="List Bullet")
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


_NUM_RE = re.compile(r"^-?\d{1,3}(?:,\d{3})*(?:\.\d+)?$|^-?\d+(?:\.\d+)?$")


def _cell(value: str):
    """看起來是數字的存成數字（才能加總、排序）；開頭 0 的編號、電話維持文字"""
    s = _clean(value, 500)
    if _NUM_RE.match(s) and not (len(s) > 1 and s[0] == "0" and "." not in s):
        try:
            n = float(s.replace(",", ""))
            return int(n) if n.is_integer() else n
        except ValueError:
            pass
    # 開頭是 = + - @ 的文字 Excel 會當成公式執行：前面加單引號，當純文字
    return "'" + s if s[:1] in "=+@" or (s[:1] == "-" and not _NUM_RE.match(s)) else s


def _unwrap(column: str, value) -> str:
    """
    小模型偶爾會把一整筆資料塞進一格（例如 '{"預算": 5000000, "負責人": "張三"}'）：
    挑出屬於這一欄的值；對不上欄名就把所有值接起來，至少不要留一串大括號在表格裡。
    """
    s = _clean(value, 500)
    if not (s.startswith("{") and s.endswith("}")):
        return s
    try:
        data = json.loads(s)
    except ValueError:
        return s
    if not isinstance(data, dict) or not data:
        return s
    for key, v in data.items():
        if str(key) and (str(key) in column or column in str(key)):
            return _clean(v, 500)
    return "、".join(_clean(v, 200) for v in data.values())


def _text_width(s: str) -> int:
    """欄寬估計：中日韓字算 2 格"""
    return sum(2 if ord(ch) > 0x2E7F else 1 for ch in s)


def _xlsx(spec: dict) -> bytes:
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill
    from openpyxl.utils import get_column_letter

    wb = Workbook()
    wb.remove(wb.active)
    used: set[str] = set()
    for i, sheet in enumerate(spec.get("sheets") or [], 1):
        name = re.sub(r"[\\/*?:\[\]]", " ", _clean(sheet.get("name"), 28)).strip() or f"工作表{i}"
        while name in used:
            name = f"{name[:26]}{i}"
        used.add(name)
        ws = wb.create_sheet(name)
        columns = [_clean(c, 60) for c in (sheet.get("columns") or [])] or ["內容"]
        ws.append(columns)
        for cell in ws[1]:
            cell.font = Font(name=FONT, bold=True, color="FFFFFF")
            cell.fill = PatternFill("solid", fgColor=ACCENT_HEX)
            cell.alignment = Alignment(vertical="center")
        widths = [_text_width(c) for c in columns]
        for row in sheet.get("rows") or []:
            values = [_cell(_unwrap(columns[j], v)) for j, v in enumerate(list(row)[: len(columns)])]
            values += [""] * (len(columns) - len(values))
            ws.append(values)
            for j, v in enumerate(values):
                widths[j] = max(widths[j], _text_width(str(v)))
        for row in ws.iter_rows(min_row=2):
            for cell in row:
                cell.font = Font(name=FONT)
                cell.alignment = Alignment(vertical="top", wrap_text=True)
        for j, w in enumerate(widths, 1):
            ws.column_dimensions[get_column_letter(j)].width = max(COL_WIDTH_MIN, min(COL_WIDTH_MAX, w + 2))
        ws.freeze_panes = "A2"
        ws.auto_filter.ref = ws.dimensions
    if not wb.sheetnames:
        wb.create_sheet("工作表1")
    wb.properties.title = _clean(spec.get("title"), 60)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _pptx(spec: dict) -> bytes:
    from pptx import Presentation
    from pptx.dml.color import RGBColor
    from pptx.enum.text import PP_ALIGN
    from pptx.util import Inches, Pt

    prs = Presentation()
    prs.slide_width, prs.slide_height = Inches(SLIDE_W_IN), Inches(SLIDE_H_IN)
    blank = prs.slide_layouts[6]
    accent, ink, muted = RGBColor.from_string(ACCENT_HEX), RGBColor(0x1C, 0x1C, 0x1E), RGBColor(0x6C, 0x6C, 0x70)
    margin = 0.9

    def text(slide, x, y, w, h, value, size, bold=False, color=ink, align=None):
        box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
        tf = box.text_frame
        tf.word_wrap = True
        if align is not None:
            tf.paragraphs[0].alignment = align
        run = tf.paragraphs[0].add_run()
        run.text = value
        run.font.size, run.font.bold, run.font.name = Pt(size), bold, FONT
        run.font.color.rgb = color
        return tf

    def bar(slide, x, y, w, h):
        shape = slide.shapes.add_shape(1, Inches(x), Inches(y), Inches(w), Inches(h))  # 1＝矩形
        shape.fill.solid()
        shape.fill.fore_color.rgb = accent
        shape.line.fill.background()
        shape.shadow.inherit = False  # 預設樣式會帶陰影，色條要乾淨的平面

    # 封面
    cover = prs.slides.add_slide(blank)
    bar(cover, margin, 2.55, 1.2, 0.08)
    text(cover, margin, 2.8, SLIDE_W_IN - 2 * margin, 1.5, _clean(spec.get("title"), 80) or "簡報", 44, bold=True)
    if _clean(spec.get("subtitle")):
        text(cover, margin, 4.3, SLIDE_W_IN - 2 * margin, 1.0, _clean(spec.get("subtitle"), 120), 22, color=muted)

    slides = spec.get("slides") or []
    for n, item in enumerate(slides, 1):
        slide = prs.slides.add_slide(blank)
        bar(slide, margin, 0.75, 0.08, 0.7)
        text(slide, margin + 0.25, 0.65, SLIDE_W_IN - 2 * margin - 0.25, 0.9, _clean(item.get("title"), 80), 30, bold=True)
        tf = text(slide, margin + 0.25, 1.9, SLIDE_W_IN - 2 * margin - 0.25, SLIDE_H_IN - 3.0, "", 22)
        first = True
        for b in item.get("bullets") or []:
            if not _clean(b):
                continue
            para = tf.paragraphs[0] if first else tf.add_paragraph()
            first = False
            run = para.add_run()
            run.text = "•  " + _clean(b, 200)
            run.font.size, run.font.name = Pt(22), FONT
            run.font.color.rgb = ink
            para.space_after = Pt(14)
        text(slide, SLIDE_W_IN - margin - 1.5, SLIDE_H_IN - 0.75, 1.5, 0.4, f"{n} / {len(slides)}", 12, color=muted, align=PP_ALIGN.RIGHT)
    buf = io.BytesIO()
    prs.save(buf)
    return buf.getvalue()


_BUILDERS = {KIND_DOCX: _docx, KIND_XLSX: _xlsx, KIND_PPTX: _pptx}


def spec_is_usable(kind: str, spec: dict) -> bool:
    """模型給的規格有沒有實際內容（結構化輸出失敗時會拿到全是預設值的空殼）"""
    if not isinstance(spec, dict):
        return False
    key = {KIND_DOCX: "sections", KIND_XLSX: "sheets", KIND_PPTX: "slides"}[kind]
    return isinstance(spec.get(key), list) and len(spec[key]) > 0 and isinstance(spec[key][0], dict)


def build_file(kind: str, spec: dict) -> bytes:
    return _BUILDERS[kind](spec)


def outline(kind: str, spec: dict) -> list[str]:
    """給使用者看的大綱：章節標題／工作表（幾列）／投影片標題"""
    if kind == KIND_DOCX:
        return [_clean(s.get("heading"), 60) for s in spec.get("sections") or [] if _clean(s.get("heading"))]
    if kind == KIND_XLSX:
        return [f"{_clean(s.get('name'), 28)}（{len(s.get('rows') or [])} 列）" for s in spec.get("sheets") or []]
    return [_clean(s.get("title"), 60) for s in spec.get("slides") or [] if _clean(s.get("title"))]
