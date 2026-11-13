"""
檔案（PDF／Word／Excel／PowerPoint／純文字／CSV／HTML）→ 純文字

抽出來獨立成檔（原本在 document_service.py 裡）：伺服器資料夾索引、連接資料夾、
瀏覽器臨時資料夾三個地方都要解析同一批格式，不要各寫一份。
只做「檔案 → 文字」，不碰資料庫、不管分塊和向量化（那些留在 document_service.py）。
"""

from __future__ import annotations

import asyncio
import csv
import io
import logging
import re
from html.parser import HTMLParser
from pathlib import Path

logger = logging.getLogger(__name__)

# 支援的檔案類型（副檔名含點 → MIME）：唯一來源，DocumentService.SUPPORTED_TYPES 直接引用這份
SUPPORTED_TYPES = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".doc": "application/msword",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls": "application/vnd.ms-excel",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".ppt": "application/vnd.ms-powerpoint",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".csv": "text/csv",
    ".html": "text/html",
    ".htm": "text/html",
}
# .doc／.xls／.ppt 是舊版二進位格式，函式庫不支援：凡是「讀得到就不事先问使用者」的情境（連接資料夾、
# 瀏覽器臨時資料夾）用這份排除舊格式；DocumentService.upload_document 單檔上傳仍收，失敗時再個別告知
SUPPORTED_EXTS = set(SUPPORTED_TYPES) - {".doc", ".xls", ".ppt"}

# 副檔名（不含點） → 判斷用的集合；和 SUPPORTED_TYPES 的副檔名一致
TEXT_EXTS = {"txt", "md"}
HTML_EXTS = {"html", "htm"}
WORD_EXTS = {"docx", "doc"}
EXCEL_EXTS = {"xlsx", "xls"}
PPT_EXTS = {"pptx", "ppt"}


async def extract_text(file_path: Path, ext: str) -> str:
    """
    依副檔名解析成純文字；ext 不含點、小寫（例如 "docx"）。
    檔案格式本身不支援時（例如 .doc、.ppt 這種舊版二進位格式）函式庫會丟例外，呼叫端自己接。
    """
    ext = ext.lower()
    if ext in TEXT_EXTS:
        return await _parse_text_file(file_path)
    if ext == "pdf":
        return await _parse_pdf(file_path)
    if ext in WORD_EXTS:
        return await _parse_word(file_path)
    if ext in EXCEL_EXTS:
        return await _parse_excel(file_path)
    if ext in PPT_EXTS:
        return await _parse_powerpoint(file_path)
    if ext == "csv":
        return await _parse_csv(file_path)
    if ext in HTML_EXTS:
        return await _parse_html(file_path)
    raise ValueError(f"不支援的檔案類型: {ext}")


async def _parse_text_file(file_path: Path) -> str:
    """解析純文字檔案"""
    import chardet

    def _process():
        with open(file_path, "rb") as f:
            raw_data = f.read()
        # 偵測編碼
        detected = chardet.detect(raw_data)
        encoding = detected.get("encoding", "utf-8")
        return raw_data.decode(encoding, errors="ignore")

    return await asyncio.to_thread(_process)


async def _parse_html(file_path: Path) -> str:
    """解析 HTML：只抽出看得到的文字，script／style／noscript／template 整段丟掉；區塊元素換行"""
    # 網頁幾乎都是 UTF-8：先照 UTF-8 解，失敗才交給自動偵測（短檔案自動偵測常誤判成 Big5）
    try:
        raw = file_path.read_bytes().decode("utf-8-sig")
    except UnicodeDecodeError:
        raw = await _parse_text_file(file_path)

    class _TextExtractor(HTMLParser):
        SKIP = {"script", "style", "noscript", "template", "svg", "head"}
        BLOCK = {"p", "div", "br", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6",
                 "section", "article", "header", "footer", "table", "ul", "ol", "pre", "blockquote", "title"}

        def __init__(self):
            super().__init__(convert_charrefs=True)
            self.parts: list[str] = []
            self.skip_depth = 0
            self.title = ""
            self._in_title = False

        def handle_starttag(self, tag, attrs):
            if tag == "title":
                self._in_title = True
            elif tag in self.SKIP:
                self.skip_depth += 1
            elif tag in self.BLOCK:
                self.parts.append("\n")

        def handle_endtag(self, tag):
            if tag == "title":
                self._in_title = False
            elif tag in self.SKIP and self.skip_depth:
                self.skip_depth -= 1
            elif tag in self.BLOCK:
                self.parts.append("\n")

        def handle_data(self, data):
            if self._in_title:
                self.title += data
            elif not self.skip_depth:
                self.parts.append(data)

    p = _TextExtractor()
    p.feed(raw)
    p.close()
    text = "".join(p.parts)
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    text = re.sub(r"\s*\n\s*", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    title = p.title.strip()
    return f"{title}\n\n{text}" if title else text


async def _parse_pdf(file_path: Path) -> str:
    """解析 PDF 檔案"""

    def _process():
        try:
            from PyPDF2 import PdfReader

            reader = PdfReader(str(file_path))
            text_parts = []

            for page in reader.pages:
                text = page.extract_text()
                if text:
                    text_parts.append(text)

            return "\n\n".join(text_parts)

        except ImportError:
            logger.warning("PyPDF2 未安裝，無法解析 PDF")
            raise

    return await asyncio.to_thread(_process)


async def _parse_word(file_path: Path) -> str:
    """解析 Word 檔案"""

    def _process():
        try:
            from docx import Document as DocxDocument

            doc = DocxDocument(str(file_path))
            text_parts = []

            for para in doc.paragraphs:
                if para.text.strip():
                    text_parts.append(para.text)

            return "\n\n".join(text_parts)

        except ImportError:
            logger.warning("python-docx 未安裝，無法解析 Word")
            raise

    return await asyncio.to_thread(_process)


async def _parse_excel(file_path: Path) -> str:
    """解析 Excel 檔案"""

    def _process():
        try:
            from openpyxl import load_workbook

            wb = load_workbook(str(file_path), data_only=True)
            text_parts = []

            for sheet in wb.worksheets:
                sheet_text = f"### {sheet.title}\n"
                for row in sheet.iter_rows(values_only=True):
                    row_text = " | ".join(str(cell) if cell else "" for cell in row)
                    if row_text.strip():
                        sheet_text += row_text + "\n"
                text_parts.append(sheet_text)

            return "\n\n".join(text_parts)

        except ImportError:
            logger.warning("openpyxl 未安裝，無法解析 Excel")
            raise

    return await asyncio.to_thread(_process)


async def _parse_csv(file_path: Path) -> str:
    """解析 CSV 檔案：自動偵測編碼（Big5 / UTF-8 皆可），每列轉為「欄名: 值」便於語意檢索"""
    import chardet

    def _process():
        with open(file_path, "rb") as f:
            raw = f.read()
        encoding = chardet.detect(raw).get("encoding") or "utf-8"
        text = raw.decode(encoding, errors="ignore").lstrip("﻿")
        rows = list(csv.reader(io.StringIO(text)))
        if not rows:
            return ""
        header = [h.strip() for h in rows[0]]
        lines = []
        for row in rows[1:]:
            cells = [c.strip() for c in row]
            if not any(cells):
                continue
            pairs = [f"{header[i] if i < len(header) and header[i] else f'欄{i + 1}'}: {v}"
                     for i, v in enumerate(cells) if v]
            lines.append(" | ".join(pairs))
        return "\n".join([" | ".join(header)] + lines)

    return await asyncio.to_thread(_process)


async def _parse_powerpoint(file_path: Path) -> str:
    """
    解析 PowerPoint (.pptx) 檔案
    --------------------------------
    策略：
      - 每張投影片做為一個段落，標記 ### Slide N
      - 抓所有 shape 裡 text_frame 的純文字（含 title / body / textbox）
      - 表格逐 row 用 ' | ' 串接（跟 Excel 一致風格）
      - 講者備忘 (notes_slide) 若有就附在投影片內容後面
      - 排除空字串避免噪音

    備註：
      - .ppt（舊版二進位格式）python-pptx 不支援。要求使用者轉成 .pptx，
        或後續加 LibreOffice 轉檔流程。目前若 ext=='ppt' 會走到這裡並
        被 python-pptx 直接擲出例外，process_document 會把狀態標 failed。
    """

    def _process():
        try:
            from pptx import Presentation
        except ImportError:
            logger.warning("python-pptx 未安裝，無法解析 PowerPoint")
            raise

        prs = Presentation(str(file_path))
        slide_blocks: list[str] = []

        for idx, slide in enumerate(prs.slides, start=1):
            lines: list[str] = [f"### Slide {idx}"]

            for shape in slide.shapes:
                # 含表格 → 逐 row 序列化
                if shape.has_table:
                    for row in shape.table.rows:
                        cells = [cell.text.strip() for cell in row.cells]
                        row_text = " | ".join(cells)
                        if row_text.strip("|").strip():
                            lines.append(row_text)
                    continue

                # 一般文字框 / title / body
                if shape.has_text_frame:
                    for para in shape.text_frame.paragraphs:
                        text = "".join(run.text for run in para.runs).strip()
                        if text:
                            lines.append(text)

            # 講者備忘（如果有）
            if slide.has_notes_slide:
                notes = slide.notes_slide.notes_text_frame.text.strip()
                if notes:
                    lines.append(f"[備忘] {notes}")

            slide_blocks.append("\n".join(lines))

        return "\n\n".join(slide_blocks)

    return await asyncio.to_thread(_process)
