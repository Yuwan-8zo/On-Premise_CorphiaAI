"""
B2: Hash Chain 服務的單元測試

測試 SHA-256 Hash Chain 的核心計算邏輯：
- 單則訊息 hash 計算
- 多則訊息鏈式串接
- 竄改偵測
- 邊界情況（空內容、特殊字元）
"""

import pytest
from app.services.hash_chain_service import compute_message_hash


class TestComputeMessageHash:
    """compute_message_hash 純函式測試"""

    def test_basic_hash(self):
        """基本 hash 計算應回傳 64 字元 hex"""
        result = compute_message_hash(
            prev_hash="GENESIS",
            role="user",
            content="你好",
            created_at_iso="2026-04-22T12:00:00",
        )
        assert isinstance(result, str)
        assert len(result) == 64  # SHA-256 hex digest

    def test_deterministic(self):
        """相同輸入必須產生相同 hash"""
        args = {
            "prev_hash": "GENESIS",
            "role": "user",
            "content": "測試訊息",
            "created_at_iso": "2026-04-22T12:00:00",
        }
        h1 = compute_message_hash(**args)
        h2 = compute_message_hash(**args)
        assert h1 == h2

    def test_different_content_different_hash(self):
        """不同內容產生不同 hash"""
        base = {
            "prev_hash": "GENESIS",
            "role": "user",
            "created_at_iso": "2026-04-22T12:00:00",
        }
        h1 = compute_message_hash(content="A", **base)
        h2 = compute_message_hash(content="B", **base)
        assert h1 != h2

    def test_different_role_different_hash(self):
        """不同角色產生不同 hash"""
        base = {
            "prev_hash": "GENESIS",
            "content": "相同內容",
            "created_at_iso": "2026-04-22T12:00:00",
        }
        h_user = compute_message_hash(role="user", **base)
        h_assistant = compute_message_hash(role="assistant", **base)
        assert h_user != h_assistant

    def test_different_prev_hash_different_result(self):
        """不同 prev_hash 產生不同 hash（鏈的核心特性）"""
        base = {
            "role": "user",
            "content": "相同",
            "created_at_iso": "2026-04-22T12:00:00",
        }
        h1 = compute_message_hash(prev_hash="GENESIS", **base)
        h2 = compute_message_hash(prev_hash="abc123", **base)
        assert h1 != h2

    def test_chain_integrity(self):
        """模擬三則訊息的鏈式串接"""
        # Message 1: GENESIS → user → hash1
        hash1 = compute_message_hash(
            prev_hash="GENESIS",
            role="user",
            content="你好",
            created_at_iso="2026-04-22T12:00:00",
        )
        # Message 2: hash1 → assistant → hash2
        hash2 = compute_message_hash(
            prev_hash=hash1,
            role="assistant",
            content="您好！有什麼可以幫您的嗎？",
            created_at_iso="2026-04-22T12:00:01",
        )
        # Message 3: hash2 → user → hash3
        hash3 = compute_message_hash(
            prev_hash=hash2,
            role="user",
            content="幫我寫一段程式",
            created_at_iso="2026-04-22T12:00:02",
        )

        # 三個 hash 必須互不相同
        assert len({hash1, hash2, hash3}) == 3

        # 如果竄改 Message 1 內容，整個鏈都會變
        tampered_hash1 = compute_message_hash(
            prev_hash="GENESIS",
            role="user",
            content="你好（竄改）",
            created_at_iso="2026-04-22T12:00:00",
        )
        assert tampered_hash1 != hash1

    def test_empty_content(self):
        """空內容不應拋錯"""
        result = compute_message_hash(
            prev_hash="GENESIS",
            role="system",
            content="",
            created_at_iso="2026-04-22T12:00:00",
        )
        assert isinstance(result, str)
        assert len(result) == 64

    def test_unicode_content(self):
        """Unicode（emoji、CJK 擴充）不應影響計算"""
        result = compute_message_hash(
            prev_hash="GENESIS",
            role="user",
            content="🔥 中文テスト 한국어 العربية",
            created_at_iso="2026-04-22T12:00:00",
        )
        assert isinstance(result, str)
        assert len(result) == 64

    def test_long_content(self):
        """超長內容（模擬大段對話）不應影響計算"""
        long_text = "A" * 100_000
        result = compute_message_hash(
            prev_hash="GENESIS",
            role="user",
            content=long_text,
            created_at_iso="2026-04-22T12:00:00",
        )
        assert isinstance(result, str)
        assert len(result) == 64
