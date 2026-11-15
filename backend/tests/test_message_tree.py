"""
對話分支 (test_message_tree.py)

- 修改問題重送、請 AI 重答：舊版本都留著，畫面走新的那一條
- 切換版本：回到舊的那一條，之後的訊息接在它後面
- 模型只看得到畫面上這一條（別的版本不會混進上下文）
- 防竄改雜湊鏈：怎麼改、怎麼重答都驗得過（以前修改重送會讓鏈斷掉）
"""
import uuid
from types import SimpleNamespace

import pytest
from sqlalchemy import select

import app.services.message_tree as tree
from app.models.conversation import Conversation
from app.models.message import Message
from app.services.chat_service import ChatService
from app.services.hash_chain_service import verify_chain


def _m(mid, parent, role="user"):
    return SimpleNamespace(id=mid, parent_id=parent, role=role)


# ── 純邏輯 ──────────────────────────────────────────────────────────────────

#  q1 ─ a1 ─ q2 ─ a2
#        └─ q2b ─ a2b ─ q3 ─ a3
#                  └─ a2c
TREE = [
    _m("q1", None), _m("a1", "q1", "assistant"), _m("q2", "a1"), _m("a2", "q2", "assistant"),
    _m("q2b", "a1"), _m("a2b", "q2b", "assistant"), _m("q3", "a2b"), _m("a3", "q3", "assistant"),
    _m("a2c", "q2b", "assistant"),
]


def test_active_path_walks_up_from_the_leaf():
    assert [m.id for m in tree.active_path(TREE, "a3")] == ["q1", "a1", "q2b", "a2b", "q3", "a3"]
    assert [m.id for m in tree.active_path(TREE, "a2")] == ["q1", "a1", "q2", "a2"]


def test_missing_leaf_falls_back_to_the_last_written_message():
    linear = [_m("1", None), _m("2", "1", "assistant"), _m("3", "2")]
    assert [m.id for m in tree.active_path(linear, None)] == ["1", "2", "3"]
    assert [m.id for m in tree.active_path(linear, "不存在")] == ["1", "2", "3"]
    assert tree.active_path([], "x") == []


def test_versions_group_same_position_and_role():
    v = tree.versions(TREE)
    assert v["q2"] == v["q2b"] == ["q2", "q2b"]
    assert v["a2b"] == v["a2c"] == ["a2b", "a2c"]
    assert v["q1"] == ["q1"] and v["a3"] == ["a3"]


def test_deepest_leaf_follows_the_newest_child():
    assert tree.deepest_leaf(TREE, "q2") == "a2"
    assert tree.deepest_leaf(TREE, "q2b") == "a2c", "同一題有兩個回答：走最後寫入的那一個"
    assert tree.deepest_leaf(TREE, "a2b") == "a3"
    assert tree.deepest_leaf(TREE, "a3") == "a3"


def test_corrupt_parent_loop_does_not_hang():
    loop = [_m("a", "b"), _m("b", "a")]
    assert len(tree.active_path(loop, "a")) == 2
    assert tree.deepest_leaf(loop, "a") in ("a", "b")


# ── 聊天流程 ────────────────────────────────────────────────────────────────

class ScriptedLLM:
    """每問一次回下一句，並記下模型看到的對話"""

    def __init__(self, real, answers):
        self._real, self.answers, self.seen = real, list(answers), []

    def __getattr__(self, name):
        return getattr(self._real, name)

    async def generate_stream(self, prompt=None, **_kwargs):
        self.seen.append([m["content"] for m in prompt.messages if m["role"] in ("user", "assistant")])
        yield ("content", self.answers.pop(0))


@pytest.fixture
def llm_ready(monkeypatch):
    import app.services.boot_service as boot
    monkeypatch.setattr(boot, "is_llm_ready", lambda: True)


async def _chat(db, user, answers):
    conv = Conversation(id=str(uuid.uuid4()), user_id=user.id, tenant_id=user.tenant_id, title="t", settings={})
    db.add(conv)
    await db.flush()
    svc = ChatService(db)
    svc.llm_service = ScriptedLLM(svc.llm_service, answers)
    return svc, conv


async def _send(svc, conv, text, resubmit=None):
    async for _ in svc.send_message_stream(conversation_id=conv.id, content=text, use_rag=False, resubmit_message_id=resubmit):
        pass


async def _path(db, conv) -> list[str]:
    path, _all = await tree.current_path(db, conv.id)
    return [m.content for m in path]


async def _id_of(db, conv, content) -> str:
    return (await db.execute(select(Message.id).where(Message.conversation_id == conv.id, Message.content == content))).scalars().first()


async def test_edit_and_resend_keeps_the_old_version(db_session, test_user, llm_ready):
    svc, conv = await _chat(db_session, test_user, ["答一", "答二", "答二改"])
    await _send(svc, conv, "問一")
    await _send(svc, conv, "問二")
    await _send(svc, conv, "問二改", resubmit=await _id_of(db_session, conv, "問二"))

    assert await _path(db_session, conv) == ["問一", "答一", "問二改", "答二改"]
    everything = await tree.load_all(db_session, conv.id)
    assert {m.content for m in everything} == {"問一", "答一", "問二", "答二", "問二改", "答二改"}, "舊的那一版沒有被刪或改寫"
    v = tree.versions(everything)
    old, new = await _id_of(db_session, conv, "問二"), await _id_of(db_session, conv, "問二改")
    assert v[new] == [old, new]
    assert svc.llm_service.seen[-1] == ["問一", "答一", "問二改"], "模型看不到被換掉的那一版"
    assert (await verify_chain(db_session, conv.id))["valid"], "修改重送後防竄改雜湊鏈仍然完整"


async def test_regenerate_adds_another_answer_to_the_same_question(db_session, test_user, llm_ready):
    svc, conv = await _chat(db_session, test_user, ["第一次回答", "第二次回答"])
    await _send(svc, conv, "問題")
    await _send(svc, conv, "問題", resubmit=await _id_of(db_session, conv, "問題"))

    assert await _path(db_session, conv) == ["問題", "第二次回答"]
    everything = await tree.load_all(db_session, conv.id)
    assert [m.content for m in everything if m.role == "user"] == ["問題"], "問題沒有被複製一份"
    answers = [m for m in everything if m.role == "assistant"]
    assert tree.versions(everything)[answers[0].id] == [a.id for a in answers]
    assert svc.llm_service.seen[-1] == ["問題"], "重答時模型看不到上一次的回答"
    assert (await verify_chain(db_session, conv.id))["valid"]


async def test_switching_back_continues_from_the_old_version(db_session, test_user, llm_ready):
    svc, conv = await _chat(db_session, test_user, ["答一", "答一改", "接著舊的答"])
    await _send(svc, conv, "問一")
    await _send(svc, conv, "問一改", resubmit=await _id_of(db_session, conv, "問一"))
    assert await _path(db_session, conv) == ["問一改", "答一改"]

    everything = await tree.load_all(db_session, conv.id)
    await tree.set_leaf_id(db_session, conv.id, tree.deepest_leaf(everything, await _id_of(db_session, conv, "問一")))
    await db_session.commit()
    assert await _path(db_session, conv) == ["問一", "答一"]

    await _send(svc, conv, "接著問")
    assert await _path(db_session, conv) == ["問一", "答一", "接著問", "接著舊的答"]
    assert svc.llm_service.seen[-1] == ["問一", "答一", "接著問"]
    assert (await verify_chain(db_session, conv.id))["valid"]


async def test_resend_of_a_message_from_another_conversation_is_refused(db_session, test_user, llm_ready):
    svc, conv = await _chat(db_session, test_user, ["答"])
    await _send(svc, conv, "問")
    svc2, other = await _chat(db_session, test_user, ["不該用到"])
    events = [e async for e in svc2.send_message_stream(conversation_id=other.id, content="x", use_rag=False,
                                                        resubmit_message_id=await _id_of(db_session, conv, "問"))]
    assert events and events[0]["type"] == "error"
    assert await tree.load_all(db_session, other.id) == []
