"""
問句意圖：使用者是不是要「看整個專案資料夾的文件」（讀取／整理／總結所有檔案）

    chat_service 用它決定要不要一次給每份文件的開頭；
    message_guard 用它避免把「讀我自己專案的文件」誤判成索取機密（只拿掉這句，剩下的要求照樣檢查）。
"""
import re

_ALL_DOCS_RE = re.compile(
    r"(所有|全部|每一?[份個篇]|這些|整個|資料夾(裡|中|內)?的?)\s*(的)?\s*(檔案|文件|文獻|資料)"
    r"|(檔案|文件|文獻|資料)\s*(全部|都)"
    r"|(讀取|閱讀|讀一下|看一下|整理|總結|摘要|概述|介紹|列出)\s*(一下)?\s*(檔案|文件|文獻)\s*$"
)


# 拿掉時連前面的「請／幫我＋讀取、整理…」一起拿掉，只留下其餘的要求
_STRIP_RE = re.compile(
    r"(請|幫我|麻煩)?\s*(讀取|閱讀|讀一下|讀|看一下|看|整理|總結|摘要|概述|介紹|列出)?\s*(一下)?\s*(?:" + _ALL_DOCS_RE.pattern + r")"
)


def wants_all_documents(text: str) -> bool:
    """是不是要看整個資料夾（讀取／整理／總結所有檔案），而不是問某個具體問題"""
    return bool(_ALL_DOCS_RE.search((text or "").strip()))


def strip_all_documents_request(text: str) -> str:
    """拿掉「讀取所有檔案」這類片語，留下其餘的要求（例如「各用一句話說明」、「列出密碼」）"""
    rest = _STRIP_RE.sub(" ", text or "")
    return re.sub(r"^[\s，,。；;：:、]+|[\s，,。；;：:、]+$", "", rest)
