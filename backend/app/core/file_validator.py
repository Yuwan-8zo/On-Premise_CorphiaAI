
# Magic bytes 字典
MAGIC_BYTES = {
    "pdf": b"%PDF-",
    "zip": b"PK\x03\x04", # DOCX and XLSX are ZIP archives
    "png": b"\x89PNG\r\n\x1a\n",
    "jpg": b"\xff\xd8\xff",
}

def validate_file_signature(file_bytes: bytes, filename: str, content_type: str) -> bool:
    """
    進行粗略的檔案簽章檢查，防止攻擊者修改副檔名上傳惡意腳本。
    """
    ext = filename.split(".")[-1].lower() if "." in filename else ""
    
    # 檢查是否為 PDF
    if ext == "pdf" or content_type == "application/pdf":
        return file_bytes.startswith(MAGIC_BYTES["pdf"])
        
    # DOCX, XLSX 底層是 ZIP 格式
    if ext in ["docx", "xlsx"] or "openxmlformats" in content_type:
        return file_bytes.startswith(MAGIC_BYTES["zip"])
        
    # 純文字檔案無固定標頭，可嘗試解碼或認定通過
    if ext in ["txt", "md", "csv"] or content_type.startswith("text/"):
        try:
            file_bytes[:1024].decode('utf-8')
            return True
        except UnicodeDecodeError:
            return False # 可能不是純文字

    # 對於未記錄的檔案格式
    return True

