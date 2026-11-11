"""
資料庫查詢的小工具（全後端共用）
"""


def like_contains(text: str) -> str:
    """
    「包含某段文字」的 LIKE 條件字串。
    % 和 _ 在 LIKE 裡是萬用字元，使用者搜尋「100%」要比對百分號本身，所以先跳脫；
    搭配 .ilike(like_contains(q), escape="\\\\") 使用。
    """
    escaped = text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def page_count(total: int, page_size: int) -> int:
    """總頁數（沒有資料時是 0）"""
    return (total + page_size - 1) // page_size if total > 0 and page_size > 0 else 0
