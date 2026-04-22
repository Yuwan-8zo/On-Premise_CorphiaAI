"""
A3: DLP 服務的單元測試

測試 Data Loss Prevention 黑名單字詞攔阻邏輯：
- DLP 開啟/關閉
- 黑名單命中
- 不分大小寫
- 多重命中
- 無命中
"""

import pytest
from unittest.mock import patch


class TestDLPService:
    """DLP 黑名單攔阻測試"""

    def _check_with_config(self, text: str, *, enable: bool = True, terms: list[str] | None = None):
        """
        帶自訂設定呼叫 check_dlp

        透過 patch settings 來控制 DLP 開關與黑名單
        """
        if terms is None:
            terms = ["極機密", "project-x", "核心技術"]

        with patch("app.services.dlp_service.settings") as mock_settings:
            mock_settings.enable_dlp = enable
            mock_settings.dlp_blocklist_terms = terms
            from app.services.dlp_service import check_dlp
            return check_dlp(text)

    def test_dlp_disabled(self):
        """DLP 關閉時不應攔阻"""
        result = self._check_with_config("極機密文件", enable=False)
        assert result["blocked"] is False
        assert len(result["matched_terms"]) == 0

    def test_no_match(self):
        """無命中黑名單時不應攔阻"""
        result = self._check_with_config("今天天氣真好")
        assert result["blocked"] is False

    def test_single_match(self):
        """命中單一黑名單字詞"""
        result = self._check_with_config("這份極機密報告請勿外傳")
        assert result["blocked"] is True
        assert "極機密" in result["matched_terms"]

    def test_case_insensitive(self):
        """英文不分大小寫"""
        result = self._check_with_config("This is Project-X data")
        assert result["blocked"] is True
        assert "project-x" in result["matched_terms"]

    def test_multiple_match(self):
        """命中多個黑名單字詞"""
        result = self._check_with_config("這份極機密的核心技術文件")
        assert result["blocked"] is True
        assert len(result["matched_terms"]) >= 2

    def test_empty_text(self):
        """空字串不應攔阻"""
        result = self._check_with_config("")
        assert result["blocked"] is False

    def test_empty_blocklist(self):
        """黑名單為空時不應攔阻"""
        result = self._check_with_config("極機密", terms=[])
        assert result["blocked"] is False

    def test_reason_message(self):
        """攔阻時應有理由訊息"""
        result = self._check_with_config("project-x 相關資料")
        assert result["blocked"] is True
        assert "DLP" in result["reason"] or "列管" in result["reason"]
