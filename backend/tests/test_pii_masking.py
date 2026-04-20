"""
PII 遮罩服務的單元測試

測試各種敏感資訊的偵測與遮罩邏輯：
- 台灣身分證字號
- 信用卡號
- 手機號碼
- 電子郵件
- API 金鑰
- 混合場景
"""

import pytest
from app.services.pii_masking_service import mask_pii


class TestPIIMasking:
    """PII 遮罩功能測試"""

    def test_no_pii(self):
        """純文字不含 PII 時應回傳原文"""
        result = mask_pii("今天天氣真好，我想出去走走")
        assert result["has_pii"] is False
        assert result["masked_text"] == "今天天氣真好，我想出去走走"
        assert len(result["mask_map"]) == 0

    def test_taiwan_national_id(self):
        """偵測台灣身分證字號"""
        result = mask_pii("我的身分證號碼是 A123456789")
        assert result["has_pii"] is True
        assert "A123456789" not in result["masked_text"]
        assert "[台灣身分證已遮罩]" in result["masked_text"]
        assert len(result["mask_map"]) == 1
        assert result["mask_map"][0]["type"] == "tw_national_id"

    def test_credit_card(self):
        """偵測信用卡號（連續 16 位）"""
        result = mask_pii("卡號 4111111111111111 已扣款")
        assert result["has_pii"] is True
        assert "4111111111111111" not in result["masked_text"]
        assert "[信用卡號已遮罩]" in result["masked_text"]

    def test_credit_card_with_spaces(self):
        """偵測帶空格的信用卡號"""
        result = mask_pii("卡號 4111 1111 1111 1111 已扣款")
        assert result["has_pii"] is True
        assert "[信用卡號已遮罩]" in result["masked_text"]

    def test_taiwan_phone(self):
        """偵測台灣手機號碼"""
        result = mask_pii("聯繫電話 0912345678")
        assert result["has_pii"] is True
        assert "0912345678" not in result["masked_text"]
        assert "[手機號碼已遮罩]" in result["masked_text"]

    def test_taiwan_phone_with_dash(self):
        """偵測帶 dash 的台灣手機號碼"""
        result = mask_pii("手機 0912-345-678")
        assert result["has_pii"] is True
        assert "[手機號碼已遮罩]" in result["masked_text"]

    def test_email(self):
        """偵測電子郵件"""
        result = mask_pii("請聯繫 user@example.com 詢問")
        assert result["has_pii"] is True
        assert "user@example.com" not in result["masked_text"]
        assert "[電子郵件已遮罩]" in result["masked_text"]

    def test_api_key(self):
        """偵測 API 金鑰"""
        result = mask_pii("使用 sk-proj-abcdefghijklmnop1234 這個 key")
        assert result["has_pii"] is True
        assert "[API 金鑰已遮罩]" in result["masked_text"]

    def test_aws_key(self):
        """偵測 AWS Access Key"""
        result = mask_pii("我的 AKIA1234567890ABCDEF key")
        assert result["has_pii"] is True
        assert "[API 金鑰已遮罩]" in result["masked_text"]

    def test_multiple_pii(self):
        """混合多種 PII"""
        text = "身分證 A223456789，信箱 test@corp.com，手機 0987654321"
        result = mask_pii(text)
        assert result["has_pii"] is True
        assert len(result["mask_map"]) >= 3

    def test_mask_preview_partial(self):
        """遮罩預覽應保留頭尾各 2 字元"""
        result = mask_pii("我的身分證 A123456789")
        if result["mask_map"]:
            preview = result["mask_map"][0]["original_preview"]
            # 頭 2 + 尾 2 字元應保留，中間用 *
            assert preview.startswith("A1")
            assert preview.endswith("89")
            assert "*" in preview

    def test_empty_string(self):
        """空字串不應出錯"""
        result = mask_pii("")
        assert result["has_pii"] is False
        assert result["masked_text"] == ""
