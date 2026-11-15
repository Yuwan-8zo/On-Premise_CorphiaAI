"""
帶多少對話歷史給模型 (test_history_window.py)

- 預算內全部帶上（記得住前面的對話）
- 超過預算才往前跳，而且一次跳一大段：連續好幾題的開頭都一樣，推論引擎才能重複利用
"""
from types import SimpleNamespace

from app.services.history_window import clip, select_history, window_start


def _conversation(n: int, size: int = 100):
    return [SimpleNamespace(role="user" if i % 2 == 0 else "assistant", content=f"{i:03d}" + "字" * (size - 3)) for i in range(n)]


def test_everything_fits_within_budget():
    msgs = _conversation(10)
    out = select_history(msgs, budget_chars=5000, message_chars=2000)
    assert [m["content"][:3] for m in out] == [f"{i:03d}" for i in range(10)]
    assert out[0] == {"role": "user", "content": msgs[0].content}


def test_over_budget_drops_the_oldest_down_to_half():
    out = select_history(_conversation(11), budget_chars=1000, message_chars=2000)
    assert sum(len(m["content"]) for m in out) <= 1000
    assert out[-1]["content"].startswith("010"), "最新的一定在"
    assert out[0]["content"].startswith("006"), "第 11 則超過預算：丟到剩一半（500 字）以內"


def test_start_stays_put_between_jumps():
    """連續問下去，起點大部分時候不動；這樣每一題的開頭都和上一題一樣"""
    lengths = [100] * 60
    starts = [window_start(lengths[:n], 1000) for n in range(1, 61)]
    assert starts == sorted(starts), "起點只會往後、不會往回"
    moves = sum(1 for a, b in zip(starts, starts[1:]) if a != b)
    assert moves <= 60 // 5, f"起點移動 {moves} 次：平均至少五則才移一次"
    assert all(sum(lengths[s:n]) <= 1000 for n, s in enumerate(starts, start=1))


def test_same_history_always_gives_the_same_start():
    lengths = [300, 50, 800, 120, 40, 900, 10, 700, 60]
    assert window_start(lengths, 1500) == window_start(list(lengths), 1500)
    # 多問一題：前面的起點不會因為後面多了東西而往回
    assert window_start(lengths + [20], 1500) >= window_start(lengths, 1500)


def test_one_huge_message_is_clipped_not_dropped():
    msgs = [SimpleNamespace(role="user", content="長" * 5000), SimpleNamespace(role="assistant", content="好")]
    out = select_history(msgs, budget_chars=3000, message_chars=1000)
    assert len(out) == 2 and len(out[0]["content"]) == 1001 and out[0]["content"].endswith("…")


def test_clip_and_empty_cases():
    assert clip(None, 10) == "" and clip("短", 10) == "短"
    assert select_history([], 1000, 100) == []
    assert window_start([], 1000) == 0
    assert window_start([5000], 1000) == 1, "單獨一則就超過預算：不帶（實際上先經過截短，不會發生）"


# ── 接到聊天流程：模型實際看到的歷史 ─────────────────────────────────────────

import uuid  # noqa: E402
from datetime import datetime, timedelta  # noqa: E402

from app.models.conversation import Conversation  # noqa: E402
from app.models.message import Message  # noqa: E402
from app.services.chat_service import ChatService  # noqa: E402


async def _conversation_with(db, user, n: int) -> Conversation:
    conv = Conversation(id=str(uuid.uuid4()), user_id=user.id, tenant_id=user.tenant_id, title="t")
    db.add(conv)
    base = datetime(2026, 1, 1)
    previous = None
    for i in range(n):
        message = Message(
            id=str(uuid.uuid4()), conversation_id=conv.id, role="user" if i % 2 == 0 else "assistant",
            content=f"第{i:03d}則", created_at=base + timedelta(seconds=i), parent_id=previous,  # 一直線：每則接在前一則後面
        )
        db.add(message)
        previous = message.id
    await db.flush()
    return conv


def _contents(prompt) -> list[str]:
    return [m["content"] for m in prompt.messages if m["role"] in ("user", "assistant")]


async def test_current_question_appears_once(db_session, test_user):
    """這一題在組提示詞前已經存進資料庫；提示詞裡只能出現一次"""
    conv = await _conversation_with(db_session, test_user, 3)  # 使用者、AI、使用者（＝這一題）
    prompt, *_ = await ChatService(db_session)._prepare_prompt(conv.id, "第002則", False, "zh-TW")
    assert _contents(prompt) == ["第000則", "第001則", "第002則"]


async def test_long_conversation_continues_from_the_latest_messages(db_session, test_user):
    """超過 50 則的對話：模型要接著最近的內容聊，不是停在最前面那幾則"""
    conv = await _conversation_with(db_session, test_user, 81)  # 最後一則（第 080 則）是這一題
    prompt, *_ = await ChatService(db_session)._prepare_prompt(conv.id, "第080則", False, "zh-TW")
    seen = _contents(prompt)
    assert seen[-1] == "第080則" and seen[-2] == "第079則"
    assert seen.count("第080則") == 1
    assert len(seen) >= 40, "預算內的歷史都帶上（以前只帶 4 則）"
