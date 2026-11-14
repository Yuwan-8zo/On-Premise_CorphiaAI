"""
對外搜尋的「要不要查、查什麼」(test_web_search_policy.py)

- 管理者政策：auto／ask／off，舊的 web_search_auto 設定照樣讀得懂
- 需要即時資訊的判斷規則：問天氣、股價、最新版本會查；寫信、貼程式、問文件不會
- 送出去的只有濃縮後的關鍵字（模型濃縮失敗時用規則整理原句）
- 聊天流程：自動查、只提醒、專案資料夾不查、每則回答都存下「有沒有連外網」
"""
import uuid
from datetime import datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

import app.services.web_search as web_search_svc
import app.services.web_search_policy as policy
from app.core.config import settings
from app.models.conversation import Conversation
from app.models.tenant import Tenant
from app.models.user import User
from app.services.chat_service import ChatService

NOW = datetime(2026, 11, 13)


# ── 政策 ─────────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("stored, expected", [
    (None, "auto"),
    ({}, "auto"),
    ({"web_search_mode": "ask"}, "ask"),
    ({"web_search_mode": "off"}, "off"),
    ({"web_search_mode": "亂填"}, "auto"),
    ({"web_search_auto": True}, "auto"),      # 舊設定：不用先問
    ({"web_search_auto": False}, "ask"),      # 舊設定：每次先問 → 不自動查
    ({"web_search_auto": False, "web_search_mode": "auto"}, "auto"),  # 新設定優先
])
def test_mode_from_settings(stored, expected):
    assert policy.mode_from_settings(stored) == expected


# ── 需不需要即時資訊 ─────────────────────────────────────────────────────────

@pytest.mark.parametrize("question", [
    "台北今天天氣如何？",
    "台積電股價多少",
    "美元兌台幣匯率",
    "有什麼科技新聞",
    "Python 最新版本是多少？",
    "現任日本首相是誰",
    "2026 年基本工資調整結果",
    "幫我上網查一下這家公司的評價",
    "What is the weather in Taipei?",
    "What's the latest version of Node.js?",
    "search the web for pgvector benchmarks",
    "東京の天気を教えて",
    "最新のバージョンは？",
])
def test_questions_that_need_live_info(question):
    assert policy.needs_live_info(question, NOW)


@pytest.mark.parametrize("question", [
    "",
    "你好",
    "幫我寫一封請假信",
    "今天幫我整理一下這段文字",            # 有時間詞，但不是在問外界的事
    "請解釋什麼是遞迴",
    "把這段翻成英文：我們的價格很合理",      # 有「價格」，但沒有在問現在
    "這個函式為什麼會出錯？\n```python\nprint(latest_version)\n```",
    "最新版本是多少？" + "文件內容" * 200,   # 整段很長＝貼上來的文件
    "Write a haiku about autumn",
])
def test_questions_that_stay_offline(question):
    assert not policy.needs_live_info(question, NOW)


# ── 送出去的關鍵字 ──────────────────────────────────────────────────────────

def test_clean_query_strips_placeholders_politeness_and_symbols():
    assert policy.clean_query("請問 [NAME_1] 推薦的 Python\n最新版本是多少？") == "推薦的 Python 最新版本"
    assert len(policy.clean_query("天氣" * 100)) <= policy.QUERY_MAX_CHARS


class FakeLLM:
    def __init__(self, answer=None, error=False):
        self.answer, self.error, self.prompts = answer, error, []

    async def generate_structured(self, prompt, schema, **_kwargs):
        self.prompts.append(prompt)
        if self.error:
            raise RuntimeError("模型沒有回應")
        return self.answer


async def test_condense_query_uses_the_models_keywords():
    llm = FakeLLM({"query": "Python 最新版本"})
    assert await policy.condense_query(llm, "請問一下 Python 現在最新的版本是多少呢？") == "Python 最新版本"


@pytest.mark.parametrize("llm", [
    FakeLLM(error=True),
    FakeLLM({"query": ""}),
    FakeLLM({"query": "simulated"}),
    FakeLLM({"query": "這是一段比原本問題還要長很多很多的廢話" * 3}),
])
async def test_condense_query_falls_back_to_the_cleaned_question(llm):
    assert await policy.condense_query(llm, "請問台北今天天氣如何？") == "台北今天天氣"


# ── 聊天流程 ────────────────────────────────────────────────────────────────

class ChatLLM(FakeLLM):
    """只把「濃縮關鍵字」換成假的；組提示詞等其他事交給真的那一份"""

    def __init__(self, real, answer):
        super().__init__(answer)
        self._real = real

    def __getattr__(self, name):
        return getattr(self._real, name)


@pytest.fixture
def search_calls(monkeypatch):
    """假的對外搜尋：記下送出去的關鍵字，回一筆結果"""
    calls: list[str] = []

    async def fake_search(query: str, **_gate):
        calls.append(query)
        return {
            "blocked": False, "reason": "", "query": query,
            "results": [{"title": "中央氣象署", "url": "https://example.test/weather", "content": "晴"}],
            "screen": {"injection": [], "dlp": [], "pii": 0},
        }

    monkeypatch.setattr(settings, "enable_web_search", True)
    monkeypatch.setattr(web_search_svc, "search", fake_search)
    return calls


async def make_chat(db: AsyncSession, user: User, mode: str | None = None, folder: str | None = None):
    if mode:
        tenant = await db.get(Tenant, user.tenant_id)
        tenant.settings = {**(tenant.settings or {}), "web_search_mode": mode}
    conv = Conversation(
        id=str(uuid.uuid4()), user_id=user.id, tenant_id=user.tenant_id, title="t",
        settings={"folderName": folder} if folder else {},
    )
    db.add(conv)
    await db.flush()
    svc = ChatService(db)
    svc.llm_service = ChatLLM(svc.llm_service, {"query": "台北 天氣"})
    return svc, conv


async def test_auto_mode_searches_with_condensed_keywords(db_session, test_user, search_calls):
    svc, conv = await make_chat(db_session, test_user)
    _prompt, context, _sources, _route = await svc._prepare_prompt(conv.id, "請問台北今天天氣如何？", False, "zh-TW")
    assert search_calls == ["台北 天氣"], "送出去的是濃縮後的關鍵字，不是整句問題"
    assert "中央氣象署" in context
    assert svc._web_search_record() == {
        "used": True, "query": "台北 天氣",
        "sources": [{"title": "中央氣象署", "url": "https://example.test/weather"}],
    }


async def test_ordinary_question_does_not_go_online(db_session, test_user, search_calls):
    svc, conv = await make_chat(db_session, test_user)
    await svc._prepare_prompt(conv.id, "幫我寫一封請假信", False, "zh-TW")
    assert search_calls == []
    assert svc._web_search_record() == {"used": False, "suggested": False}


async def test_ask_mode_only_suggests(db_session, test_user, search_calls):
    svc, conv = await make_chat(db_session, test_user, mode="ask")
    await svc._prepare_prompt(conv.id, "台北今天天氣如何？", False, "zh-TW")
    assert search_calls == []
    assert svc._web_search_record() == {"used": False, "suggested": True}


async def test_ask_mode_searches_when_the_user_asks_for_it(db_session, test_user, search_calls):
    svc, conv = await make_chat(db_session, test_user, mode="ask")
    await svc._prepare_prompt(conv.id, "台北今天天氣如何？", False, "zh-TW", web_search=True)
    assert search_calls == ["台北 天氣"]


async def test_off_mode_never_goes_online(db_session, test_user, search_calls):
    svc, conv = await make_chat(db_session, test_user, mode="off")
    await svc._prepare_prompt(conv.id, "台北今天天氣如何？", False, "zh-TW", web_search=True)
    assert search_calls == []
    assert svc._web_search_record() == {"used": False, "suggested": False}


async def test_project_folder_conversation_does_not_search_automatically(db_session, test_user, search_calls):
    svc, conv = await make_chat(db_session, test_user, folder="人事規章")
    await svc._prepare_prompt(conv.id, "最新的請假規定公告是什麼？", False, "zh-TW")
    assert search_calls == []


async def test_blocked_search_is_recorded_as_not_used(db_session, test_user, monkeypatch):
    async def blocked(query: str, **_gate):
        return {"blocked": True, "reason": "命中列管字詞", "query": query, "results": [], "screen": {}}

    monkeypatch.setattr(settings, "enable_web_search", True)
    monkeypatch.setattr(web_search_svc, "search", blocked)
    svc, conv = await make_chat(db_session, test_user)
    await svc._prepare_prompt(conv.id, "台北今天天氣如何？", False, "zh-TW")
    assert svc._web_search_record() == {"used": False, "blocked": "命中列管字詞", "query": "台北 天氣"}


async def test_no_record_when_the_feature_is_disabled(db_session, test_user, monkeypatch):
    monkeypatch.setattr(settings, "enable_web_search", False)
    svc, conv = await make_chat(db_session, test_user)
    await svc._prepare_prompt(conv.id, "台北今天天氣如何？", False, "zh-TW")
    assert svc._web_search_record() is None
