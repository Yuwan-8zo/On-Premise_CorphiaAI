"""
檔案簽章 / 副檔名驗證

SECURITY:
- ALLOWED_EXTENSIONS 是白名單，未列入的副檔名一律拒絕（含 .exe / .sh / .py / .svg 等）
- .html／.htm 允許上傳：系統只抽出純文字給檢索用（腳本、樣式整段丟掉），也沒有任何路徑會把原始檔當網頁送回瀏覽器，所以沒有 XSS 風險
- 對應副檔名要驗證 magic bytes 開頭，防止攻擊者把 .exe rename 成 .pdf 上傳
- 純文字檔（txt/md/csv）沒固定 header，但會嘗試解碼確認不是 binary
"""

# Magic bytes 字典
MAGIC_BYTES = {
    "pdf": b"%PDF-",
    "zip": b"PK\x03\x04",  # DOCX / XLSX / PPTX 底層都是 OOXML = ZIP 容器
    "png": b"\x89PNG\r\n\x1a\n",
    "jpg": b"\xff\xd8\xff",
}

# 白名單：只接受這些副檔名。任何不在這裡的（包括 .exe / .bat / .sh / .ps1 / .py / .svg）一律拒絕。
# html／htm 只做文字抽取（見 document_service._parse_html），原始檔不會被當網頁送出。
ALLOWED_EXTENSIONS = {"pdf", "docx", "xlsx", "pptx", "txt", "md", "csv", "html", "htm"}


def validate_file_signature(file_bytes: bytes, filename: str, content_type: str) -> bool:
    """
    進行檔案簽章檢查，防止攻擊者修改副檔名上傳惡意腳本。

    回傳 True 才允許上傳；False 一律拒絕。
    """
    if not filename:
        return False

    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    # SECURITY-FIX: 白名單檢查（取代原本「未記錄的格式 return True」的鬆綁）
    # 未列入白名單的副檔名一律拒絕，含可執行檔、腳本等。
    if ext not in ALLOWED_EXTENSIONS:
        return False

    # 雙重檢查：副檔名為 X 但實際 magic bytes 不對 → 拒絕
    if ext == "pdf":
        return file_bytes.startswith(MAGIC_BYTES["pdf"])

    if ext in {"docx", "xlsx", "pptx"}:
        # OOXML 都是 ZIP 容器；只需驗 ZIP magic 即可擋改副檔名的可執行檔
        return file_bytes.startswith(MAGIC_BYTES["zip"])

    if ext in {"txt", "md", "csv", "html", "htm"}:
        # 純文字嘗試解碼；不只試 utf-8，也試 utf-8-sig（BOM）跟常見的 cp950 / big5
        # （台灣使用者匯出的舊 csv 常見 big5 編碼）
        # Only the first 1 KB is sampled; that cut can land in the middle of a
        # multi-byte character (Chinese is 3 bytes in UTF-8), so decode it
        # incrementally and ignore an unfinished character at the end.
        import codecs
        for encoding in ("utf-8", "utf-8-sig", "cp950", "big5"):
            try:
                codecs.getincrementaldecoder(encoding)().decode(file_bytes[:1024], final=False)
                return True
            except UnicodeDecodeError:
                continue
        return False  # 全部 encoding 試完都不行 → 八成是 binary 偽裝成 .txt

    # 不應該到這裡（白名單已 cover），保險 fallback：拒絕
    return False

