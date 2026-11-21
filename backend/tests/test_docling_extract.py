"""Docling 文件解析：不能用時自動改用原本的解析，不會讓整份檔案失敗"""
from pathlib import Path

import pytest

from app.services import docling_extract, text_extract


def test_disabled_returns_none(monkeypatch, tmp_path):
    monkeypatch.setattr(docling_extract.settings, "enable_docling", False)
    f = tmp_path / "a.html"
    f.write_text("<p>hi</p>", encoding="utf-8")
    assert docling_extract.convert(f, "html") is None


def test_missing_models_returns_none(monkeypatch, tmp_path):
    monkeypatch.setattr(docling_extract.settings, "docling_artifacts_path", str(tmp_path / "no-models"))
    assert docling_extract.available() is False


def test_unsupported_ext_skips_docling(tmp_path):
    f = tmp_path / "a.txt"
    f.write_text("hello", encoding="utf-8")
    assert docling_extract.convert(f, "txt") is None


@pytest.mark.asyncio
async def test_extract_falls_back_when_docling_fails(monkeypatch, tmp_path):
    monkeypatch.setattr(docling_extract, "convert", lambda *_a: None)
    f = tmp_path / "a.html"
    f.write_text("<html><body><p>公司請假流程</p></body></html>", encoding="utf-8")
    text = await text_extract.extract_text(Path(f), "html")
    assert "公司請假流程" in text


@pytest.mark.asyncio
async def test_extract_uses_docling_markdown(monkeypatch, tmp_path):
    monkeypatch.setattr(docling_extract, "convert", lambda *_a: "| 項目 | 金額 |\n| --- | --- |\n| 差旅 | 100 |")
    f = tmp_path / "a.pdf"
    f.write_bytes(b"%PDF-1.4")
    text = await text_extract.extract_text(Path(f), "pdf")
    assert "| 差旅 | 100 |" in text
