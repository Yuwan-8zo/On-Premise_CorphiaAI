"""
匯出對話：把一則對話（畫面上那一條，不含被改掉的舊版本）轉成 Markdown 或 Word

  to_markdown(title, messages, exported_at)  →  str
  to_docx(title, messages, exported_at)      →  bytes（python-docx；表格、標題、條列、程式碼都照樣排）

PDF 不在這裡做：前端用同一份 Markdown 排好版面，交給瀏覽器的「列印成 PDF」（內網不用另外裝 PDF 引擎）。
這個模組不碰資料庫；權限與稽核在 api/conversations.py。
"""

from __future__ import annotations

import io
import re
from datetime import datetime
from typing import Iterable, Protocol

from app.services.file_builder import FONT, _clean

ROLE_LABEL = {"user": "我", "assistant": "Corphia"}
CODE_FONT = "Consolas"

_HEADING_RE = re.compile(r"^(#{1,6})\s+(.*)$")
_BULLET_RE = re.compile(r"^\s*[-*+]\s+(.*)$")
_NUMBERED_RE = re.compile(r"^\s*\d+[.)]\s+(.*)$")
_TABLE_SEP_RE = re.compile(r"^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$")
_INLINE_RE = re.compile(r"\*\*(.+?)\*\*|__(.+?)__|`([^`]+)`")


class MessageLike(Protocol):
    role: str
    content: str


def _exportable(messages: Iterable[MessageLike]) -> list[MessageLike]:
    return [m for m in messages if m.role in ROLE_LABEL and (m.content or "").strip()]


def to_markdown(title: str, messages: Iterable[MessageLike], exported_at: datetime) -> str:
    out = [f"# {_clean(title, 200) or '對話'}", "", f"> 匯出時間：{exported_at:%Y-%m-%d %H:%M}", ""]
    for m in _exportable(messages):
        out += [f"## {ROLE_LABEL[m.role]}", "", m.content.strip(), ""]
    return "\n".join(out).rstrip() + "\n"


def _cells(line: str) -> list[str]:
    return [c.strip() for c in line.strip().strip("|").split("|")]


def _add_runs(paragraph, text: str) -> None:
    """**粗體**、`程式碼` 保留樣式，其餘照原文"""
    pos = 0
    for m in _INLINE_RE.finditer(text):
        if m.start() > pos:
            paragraph.add_run(text[pos:m.start()])
        bold, bold2, code = m.groups()
        run = paragraph.add_run(bold or bold2 or code)
        if code:
            run.font.name = CODE_FONT
        else:
            run.bold = True
        pos = m.end()
    if pos < len(text):
        paragraph.add_run(text[pos:])


def _add_markdown(doc, content: str) -> None:
    lines = content.replace("\r\n", "\n").split("\n")
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.strip().startswith("```"):
            i += 1
            code = []
            while i < len(lines) and not lines[i].strip().startswith("```"):
                code.append(lines[i])
                i += 1
            p = doc.add_paragraph()
            run = p.add_run("\n".join(code))
            run.font.name = CODE_FONT
            i += 1
            continue
        if "|" in line and i + 1 < len(lines) and _TABLE_SEP_RE.match(lines[i + 1]):
            head = _cells(line)
            rows = []
            i += 2
            while i < len(lines) and "|" in lines[i] and lines[i].strip():
                rows.append(_cells(lines[i]))
                i += 1
            table = doc.add_table(rows=1 + len(rows), cols=len(head))
            table.style = "Table Grid"
            for c, text in enumerate(head):
                table.cell(0, c).text = ""
                _add_runs(table.cell(0, c).paragraphs[0], text)
                for run in table.cell(0, c).paragraphs[0].runs:
                    run.bold = True
            for r, row in enumerate(rows, start=1):
                for c in range(len(head)):
                    _add_runs(table.cell(r, c).paragraphs[0], row[c] if c < len(row) else "")
            continue
        if m := _HEADING_RE.match(line):
            doc.add_heading(_clean(m.group(2), 300), level=min(len(m.group(1)) + 1, 4))
        elif m := _BULLET_RE.match(line):
            _add_runs(doc.add_paragraph(style="List Bullet"), m.group(1))
        elif m := _NUMBERED_RE.match(line):
            _add_runs(doc.add_paragraph(style="List Number"), m.group(1))
        elif line.strip():
            _add_runs(doc.add_paragraph(), line.strip())
        i += 1


def to_docx(title: str, messages: Iterable[MessageLike], exported_at: datetime) -> bytes:
    from docx import Document
    from docx.oxml.ns import qn
    from docx.shared import Pt

    doc = Document()
    for style_name in ("Normal", "Title", "Heading 1", "Heading 2", "Heading 3", "Heading 4", "List Bullet", "List Number"):
        style = doc.styles[style_name]
        style.font.name = FONT
        style.element.get_or_add_rPr().get_or_add_rFonts().set(qn("w:eastAsia"), FONT)  # 中文字型要另外設
    doc.styles["Normal"].font.size = Pt(11)
    doc.add_heading(_clean(title, 200) or "對話", level=0)
    doc.add_paragraph(f"匯出時間：{exported_at:%Y-%m-%d %H:%M}")
    for m in _exportable(messages):
        doc.add_heading(ROLE_LABEL[m.role], level=1)
        _add_markdown(doc, _clean(m.content, 200_000))
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()
