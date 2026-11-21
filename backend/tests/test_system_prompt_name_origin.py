"""
系統提示要寫清楚 Corphia 名字的由來（Corpus 語料庫＋Sophia 智慧）。
模型自己不知道，被問到「為什麼叫 Corphia」會亂編（曾說成「拉丁文的心中女神」）。
一般模式、專案模式（只能用參考資料回答）兩種提示都要有，專案模式還要明說這是例外。
"""
from app.services.chat_service import ChatService


def test_both_prompts_explain_the_name():
    for prompt in (ChatService.DEFAULT_SYSTEM_PROMPT, ChatService.STRICT_RAG_SYSTEM_PROMPT):
        assert "Corpus" in prompt
        assert "語料庫" in prompt
        assert "Sophia" in prompt
        assert "智慧" in prompt
        assert "不要另外編造" in prompt


def test_project_mode_allows_answering_about_the_name():
    # 專案模式規定只能用參考資料回答：名字的由來要明說是例外，不然會回「找不到相關資訊」
    assert "名字的由來例外" in ChatService.STRICT_RAG_SYSTEM_PROMPT
