"""
按停止時保存已產生的回答 (test_stop_saves_partial.py)

用假的模型（每 0.05 秒吐一段字）測：
- 中途按停止（取消任務）→ 已寫出的部分存起來，最後加「（已停止）」
- 一個字都還沒寫就停止 → 不存
- 連線中斷（提早關閉生成流程）→ 也存
- 正常寫完 → 存完整回答，沒有停止標記
"""
import asyncio
import uuid
from contextlib import aclosing

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import Conversation
from app.models.message import Message
from app.models.user import User
from app.services.chat_service import STOPPED_NOTES, ChatService


class FakeLLM:
    def __init__(self, chunks, first_delay=0.0):
        self.chunks = chunks
        self.first_delay = first_delay

    async def generate_stream(self, **_kwargs):
        await asyncio.sleep(self.first_delay)
        for c in self.chunks:
            await asyncio.sleep(0.05)
            yield ("content", c)


@pytest.fixture
def llm_ready(monkeypatch):
    import app.services.boot_service as boot
    monkeypatch.setattr(boot, "is_llm_ready", lambda: True)


async def make_service(db: AsyncSession, user: User, llm: FakeLLM):
    conv = Conversation(id=str(uuid.uuid4()), user_id=user.id, tenant_id=user.tenant_id, title="t")
    db.add(conv)
    await db.flush()
    svc = ChatService(db)
    svc.llm_service = llm

    async def fake_prepare(*_a, **_k):
        return "prompt", "", [], "chat"

    svc._prepare_prompt = fake_prepare
    return svc, conv


async def assistant_messages(db: AsyncSession, conv: Conversation) -> list[str]:
    rows = await db.execute(select(Message.content).where(Message.conversation_id == conv.id, Message.role == "assistant"))
    return [r[0] for r in rows.all()]


async def consume(svc: ChatService, conv: Conversation):
    async with aclosing(svc.send_message_stream(conversation_id=conv.id, content="問題", language="zh-TW")) as s:
        async for _ in s:
            pass


async def test_stop_midway_saves_partial(db_session: AsyncSession, test_user: User, llm_ready):
    svc, conv = await make_service(db_session, test_user, FakeLLM(["第一段", "第二段", "第三段", "第四段"]))
    task = asyncio.create_task(consume(svc, conv))
    await asyncio.sleep(0.13)  # 大約寫出兩段
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    saved = await assistant_messages(db_session, conv)
    assert len(saved) == 1
    assert saved[0].startswith("第一段") and "第四段" not in saved[0]
    assert saved[0].endswith("*" + STOPPED_NOTES["zh-TW"] + "*")


async def test_stop_before_any_text_saves_nothing(db_session: AsyncSession, test_user: User, llm_ready):
    svc, conv = await make_service(db_session, test_user, FakeLLM(["字"], first_delay=1.0))
    task = asyncio.create_task(consume(svc, conv))
    await asyncio.sleep(0.1)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert await assistant_messages(db_session, conv) == []


async def test_disconnect_saves_partial(db_session: AsyncSession, test_user: User, llm_ready):
    svc, conv = await make_service(db_session, test_user, FakeLLM(["甲", "乙", "丙"]))
    # 模擬連線中斷：送出第二段時出錯，提早離開
    with pytest.raises(RuntimeError):
        async with aclosing(svc.send_message_stream(conversation_id=conv.id, content="問題", language="zh-TW")) as s:
            n = 0
            async for ev in s:
                if ev["type"] == "stream":
                    n += 1
                    if n == 2:
                        raise RuntimeError("websocket closed")
    saved = await assistant_messages(db_session, conv)
    assert len(saved) == 1 and saved[0].startswith("甲乙") and STOPPED_NOTES["zh-TW"] in saved[0]


async def test_complete_answer_has_no_note(db_session: AsyncSession, test_user: User, llm_ready):
    svc, conv = await make_service(db_session, test_user, FakeLLM(["完", "整"]))
    await consume(svc, conv)
    assert await assistant_messages(db_session, conv) == ["完整"]
