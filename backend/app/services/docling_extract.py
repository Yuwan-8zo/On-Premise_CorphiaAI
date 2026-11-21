"""
用 Docling（IBM，MIT 授權）把 PDF／Word／PowerPoint／Excel／HTML 轉成 Markdown

比原本逐頁抽純文字的好處：表格保留成 Markdown 表格（欄位不會黏在一起）、標題層級、閱讀順序（多欄排版不會左右交錯），
切塊和檢索時模型比較看得懂。

全程離線：版面與表格模型事先下載到 ai_model/docling（設定 docling_artifacts_path），
不做 OCR（掃描成圖片的 PDF 照舊抽不到字，和以前一樣），不連任何網路。
Docling 沒裝、模型不在、轉換失敗 → 回 None，由 text_extract 用原本的解析方式（不會因為這裡壞掉就整份檔案失敗）。

轉出來的文字跟以前一樣要經過「文件片段檢查」（context_guard.py）：藏指令的段落整段不送模型、個資遮罩後才送。
"""
from __future__ import annotations

import logging
import threading
from pathlib import Path
from typing import Optional

from app.core.config import settings
from app.services.llm_engine import REPO_ROOT

logger = logging.getLogger(__name__)

# Docling 處理得比原本好的格式（純文字、CSV 不需要）
DOCLING_EXTS = {"pdf", "docx", "pptx", "xlsx", "html", "htm"}

_converter = None
_lock = threading.Lock()


def artifacts_path() -> Path:
    p = Path(settings.docling_artifacts_path)
    return p if p.is_absolute() else REPO_ROOT / p


def available() -> bool:
    if not settings.enable_docling or not artifacts_path().is_dir():
        return False
    try:
        import docling  # noqa: F401
    except Exception:
        return False
    return True


def _get_converter():
    """第一次用到才建立（載入版面模型要幾秒）；之後共用同一個"""
    global _converter
    with _lock:
        if _converter is None:
            from docling.datamodel.base_models import InputFormat
            from docling.datamodel.pipeline_options import PdfPipelineOptions
            from docling.document_converter import DocumentConverter, PdfFormatOption

            pdf = PdfPipelineOptions(artifacts_path=str(artifacts_path()))
            pdf.do_ocr = False  # 不做 OCR：要另外下載 OCR 模型，而且掃描檔以前也不支援
            pdf.do_table_structure = True
            _converter = DocumentConverter(format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=pdf)})
        return _converter


def convert(file_path: Path, ext: str) -> Optional[str]:
    """同步呼叫（放在執行緒裡跑）；回 Markdown，不能用或失敗回 None"""
    if ext not in DOCLING_EXTS or not available():
        return None
    try:
        result = _get_converter().convert(str(file_path))
        text = result.document.export_to_markdown()
    except Exception as e:
        logger.warning("Docling 轉換失敗，改用原本的解析方式：%s（%s）", file_path.name, e)
        return None
    return text if text and text.strip() else None


__all__ = ["convert", "available", "artifacts_path", "DOCLING_EXTS"]
