"""上傳檔名的整理：只留最後一段、去掉控制字元、裁到資料庫放得下（壓力測試找到：超長檔名會回 500 並留下孤兒檔案）"""
import pytest

from app.services.document_service import ORIGINAL_FILENAME_MAX, clean_original_filename


@pytest.mark.parametrize("raw, expected", [
    ("報表.xlsx", "報表.xlsx"),
    ("../../../evil.txt", "evil.txt"),
    ("..\\..\\win.txt", "win.txt"),
    ("C:\\Users\\me\\報表.xlsx", "報表.xlsx"),
    ("a\x00b.txt", "ab.txt"),
    ("  空 白 (1).md  ", "空 白 (1).md"),
    (".txt", "未命名.txt"),
    ("", "未命名"),
])
def test_clean_original_filename(raw, expected):
    assert clean_original_filename(raw) == expected


def test_long_name_is_cut_and_keeps_extension():
    name = clean_original_filename("很長" * 300 + ".txt")
    assert len(name) == ORIGINAL_FILENAME_MAX
    assert name.endswith(".txt")


def test_no_path_separators_survive():
    for raw in ["a/b\\c.txt", "/etc/passwd", "\\\\server\\share\\x.pdf"]:
        cleaned = clean_original_filename(raw)
        assert "/" not in cleaned and "\\" not in cleaned
