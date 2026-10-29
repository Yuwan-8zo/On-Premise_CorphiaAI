from app.core.zh_convert import to_traditional


def test_converts_simplified_only_chars():
    assert to_traditional("需要进一步的帮助，请随时告诉我") == "需要進一步的幫助，請隨時告訴我"
    assert to_traditional("文中并未列出") == "文中並未列出"


def test_keeps_valid_traditional_usage():
    text = "台灣的平台後台，干擾、皇后、裡面、Prompt Injection 3B"
    assert to_traditional(text) == text
