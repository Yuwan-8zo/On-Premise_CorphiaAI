"""
聊天附圖片 (test_chat_images.py)

- 上傳的檔案一律重新解碼、縮小、另存：不是圖片的擋掉，拍攝地點等附帶資訊拿掉，超大圖不會把記憶體吃光
- 圖片只附給下一則訊息；一則最多幾張；可以取消
- 只有對話的主人讀得到圖片
- 有圖片的那一題交給圖文模型，圖片內嵌在請求裡；沒有圖文模型時老實說看不到
"""
import io
import uuid

import pytest
from PIL import Image
from sqlalchemy import select

import app.services.chat_images as chat_images
from app.core.config import settings
from app.models.conversation import Conversation
from app.models.message import Message
from app.services.chat_service import ChatService


def _png(size=(64, 48), color=(200, 30, 30), mode="RGB") -> bytes:
    out = io.BytesIO()
    Image.new(mode, size, color).save(out, format="PNG")
    return out.getvalue()


@pytest.fixture(autouse=True)
def image_folder(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "upload_directory", str(tmp_path))
    chat_images._pending.clear()
    yield tmp_path
    chat_images._pending.clear()


# ── 檔案檢查與轉存 ───────────────────────────────────────────────────────────

def test_image_is_reencoded_as_jpeg_and_scaled_down():
    clean = chat_images.normalise(_png(size=(4000, 1000)))
    with Image.open(io.BytesIO(clean)) as img:
        assert img.format == "JPEG" and max(img.size) == chat_images.MAX_SIDE and img.size[1] == chat_images.MAX_SIDE // 4


def test_location_and_device_info_are_dropped():
    exif = Image.Exif()
    exif[0x010F] = "某廠牌手機"      # 裝置廠牌
    exif[0x8825] = {1: "N", 2: (25, 2, 0)}  # 拍攝地點
    out = io.BytesIO()
    Image.new("RGB", (40, 40), (1, 2, 3)).save(out, format="JPEG", exif=exif)
    with Image.open(io.BytesIO(out.getvalue())) as original:
        assert len(original.getexif()) > 0
    with Image.open(io.BytesIO(chat_images.normalise(out.getvalue()))) as cleaned:
        assert len(cleaned.getexif()) == 0


def test_transparent_image_gets_a_white_background():
    clean = chat_images.normalise(_png(color=(0, 0, 0, 0), mode="RGBA"))
    with Image.open(io.BytesIO(clean)) as img:
        assert img.getpixel((5, 5))[0] > 240, "透明的地方要變白色，不是黑色"


@pytest.mark.parametrize("data", [
    b"", b"this is not an image", b"%PDF-1.7 fake", b"MZ\x90\x00 fake exe",
    b"\x89PNG\r\n\x1a\n" + b"broken" * 20,
])
def test_files_that_are_not_images_are_refused(data):
    with pytest.raises(chat_images.ChatImageError):
        chat_images.normalise(data)


def test_oversized_file_is_refused():
    with pytest.raises(chat_images.ChatImageError):
        chat_images.normalise(b"x" * (chat_images.MAX_BYTES + 1))


def test_decompression_bomb_is_refused(monkeypatch):
    monkeypatch.setattr(Image, "MAX_IMAGE_PIXELS", 1000)
    with pytest.raises(chat_images.ChatImageError):
        chat_images.normalise(_png(size=(200, 200)))


# ── 附給下一則訊息 ───────────────────────────────────────────────────────────

def test_attach_keeps_good_images_and_reports_bad_ones():
    result = chat_images.attach("conv-1", [("a.png", _png()), ("x.exe", b"MZ fake"), ("b.png", _png())])
    assert len(result["images"]) == 2 and [s["name"] for s in result["skipped"]] == ["x.exe"]
    assert chat_images.pending("conv-1") == result["images"]
    assert all(chat_images.image_path("conv-1", i) for i in result["images"])


def test_limit_per_message_counts_what_is_already_attached():
    chat_images.attach("conv-1", [(f"{i}.png", _png()) for i in range(chat_images.MAX_IMAGES - 1)])
    with pytest.raises(chat_images.ChatImageError):
        chat_images.attach("conv-1", [("a.png", _png()), ("b.png", _png())])
    assert len(chat_images.pending("conv-1")) == chat_images.MAX_IMAGES - 1, "超過上限的那一批一張都不收"


def test_consume_uses_them_once_and_discard_deletes_the_files():
    ids = chat_images.attach("conv-1", [("a.png", _png())])["images"]
    assert chat_images.consume("conv-1") == ids and chat_images.consume("conv-1") == []
    assert chat_images.image_path("conv-1", ids[0]), "送出後圖片留著（掛在那一則訊息上）"

    other = chat_images.attach("conv-2", [("a.png", _png())])["images"]
    chat_images.discard("conv-2")
    assert chat_images.image_path("conv-2", other[0]) is None, "取消附加：檔案也刪掉"


def test_pending_images_expire(monkeypatch):
    chat_images.attach("conv-1", [("a.png", _png())])
    monkeypatch.setattr(chat_images.time, "time", lambda: 10 ** 12)
    assert chat_images.pending("conv-1") == []


@pytest.mark.parametrize("image_id", ["", "../../secret", "a" * 31, "g" * 32, "A" * 32])
def test_image_ids_cannot_point_outside_the_folder(image_id):
    assert chat_images.image_path("conv-1", image_id) is None


def test_data_uri_is_inline_and_deleting_the_conversation_removes_files():
    ids = chat_images.attach("conv-1", [("a.png", _png())])["images"]
    assert chat_images.data_uri("conv-1", ids[0]).startswith("data:image/jpeg;base64,")
    chat_images.delete_conversation_images("conv-1")
    assert chat_images.image_path("conv-1", ids[0]) is None and chat_images.data_uri("conv-1", ids[0]) is None


# ── API：只有對話的主人 ──────────────────────────────────────────────────────

@pytest.fixture
def vision_on(monkeypatch):
    from app.services.llm_service import LLMService
    monkeypatch.setattr(LLMService, "vision_available", property(lambda self: True))


async def _conversation(db, user) -> Conversation:
    conv = Conversation(id=str(uuid.uuid4()), user_id=user.id, tenant_id=user.tenant_id, title="t", settings={})
    db.add(conv)
    await db.flush()
    return conv


async def test_owner_can_attach_and_read_others_cannot(async_client, db_session, test_user, user_auth_headers, admin_auth_headers, vision_on):
    conv = await _conversation(db_session, test_user)
    r = await async_client.post(f"/api/v1/chat-images/{conv.id}/attach", headers=user_auth_headers,
                                files=[("files", ("shot.png", _png(), "image/png"))])
    assert r.status_code == 200 and len(r.json()["images"]) == 1
    image_id = r.json()["images"][0]

    mine = await async_client.get(f"/api/v1/chat-images/{conv.id}/{image_id}", headers=user_auth_headers)
    assert mine.status_code == 200 and mine.headers["content-type"] == "image/jpeg"
    assert "no-store" in mine.headers["cache-control"]

    theirs = await async_client.get(f"/api/v1/chat-images/{conv.id}/{image_id}", headers=admin_auth_headers)
    assert theirs.status_code in (403, 404), "別人（就算是管理員）讀不到你對話裡的圖片"
    assert (await async_client.get(f"/api/v1/chat-images/{conv.id}/{image_id}")).status_code in (401, 403)


async def test_attach_is_refused_when_the_host_has_no_vision_model(async_client, db_session, test_user, user_auth_headers, monkeypatch):
    from app.services.llm_service import LLMService
    monkeypatch.setattr(LLMService, "vision_available", property(lambda self: False))
    conv = await _conversation(db_session, test_user)
    r = await async_client.post(f"/api/v1/chat-images/{conv.id}/attach", headers=user_auth_headers,
                                files=[("files", ("shot.png", _png(), "image/png"))])
    assert r.status_code == 403
    status_response = await async_client.get("/api/v1/chat-images/status", headers=user_auth_headers)
    assert status_response.json()["enabled"] is False


# ── 聊天流程 ────────────────────────────────────────────────────────────────

class VisionLLM:
    """記下哪一個模型被叫到、看到了什麼"""

    supports_tools = True

    def __init__(self, real, vision: bool):
        self._real, self.vision_available, self.calls = real, vision, []

    def __getattr__(self, name):
        return getattr(self._real, name)

    async def generate_stream(self, prompt=None, tools=None, **_kwargs):
        self.calls.append(("text", prompt.messages[-1]["content"], bool(tools)))
        yield ("content", "文字模型的回答")

    async def generate_vision_stream(self, prompt=None, **_kwargs):
        self.calls.append(("vision", prompt.messages[-1]["content"], False))
        yield ("content", "圖上寫著 42")


@pytest.fixture
def llm_ready(monkeypatch):
    import app.services.boot_service as boot
    monkeypatch.setattr(boot, "is_llm_ready", lambda: True)
    monkeypatch.setattr(settings, "enable_web_search", False)


async def _chat(db, user, vision: bool):
    conv = await _conversation(db, user)
    svc = ChatService(db)
    svc.llm_service = VisionLLM(svc.llm_service, vision)
    return svc, conv


async def _send(svc, conv, text, resubmit=None) -> list[dict]:
    return [e async for e in svc.send_message_stream(conversation_id=conv.id, content=text, use_rag=False, resubmit_message_id=resubmit)]


async def test_message_with_an_image_goes_to_the_vision_model(db_session, test_user, llm_ready):
    svc, conv = await _chat(db_session, test_user, vision=True)
    ids = chat_images.attach(conv.id, [("shot.png", _png())])["images"]
    events = await _send(svc, conv, "圖上寫什麼？")

    kind, content, used_tools = svc.llm_service.calls[0]
    assert kind == "vision" and used_tools is False
    assert content[0] == {"type": "text", "text": "圖上寫什麼？"}
    assert content[1]["image_url"]["url"].startswith("data:image/jpeg;base64,"), "圖片內嵌在請求裡，不是網址"
    assert {"type": "vision", "images": 1} in events

    user_message = (await db_session.execute(select(Message).where(Message.conversation_id == conv.id, Message.role == "user"))).scalars().one()
    assert user_message.images == ids and chat_images.pending(conv.id) == [], "圖片掛在那一則訊息上，待送清單清空"

    await _send(svc, conv, "謝謝")
    assert svc.llm_service.calls[1][0] == "text", "下一題沒有附圖：回到一般的模型"


async def test_regenerate_shows_the_same_image_again(db_session, test_user, llm_ready):
    svc, conv = await _chat(db_session, test_user, vision=True)
    chat_images.attach(conv.id, [("shot.png", _png())])
    await _send(svc, conv, "圖上寫什麼？")
    user_message = (await db_session.execute(select(Message).where(Message.conversation_id == conv.id, Message.role == "user"))).scalars().one()
    await _send(svc, conv, "圖上寫什麼？", resubmit=user_message.id)
    assert [c[0] for c in svc.llm_service.calls] == ["vision", "vision"]


async def test_without_a_vision_model_it_says_so_instead_of_pretending(db_session, test_user, llm_ready):
    svc, conv = await _chat(db_session, test_user, vision=False)
    chat_images.attach(conv.id, [("shot.png", _png())])
    events = await _send(svc, conv, "圖上寫什麼？")
    assert {"type": "vision_unavailable"} in events
    assert svc.llm_service.calls[0][0] == "text" and isinstance(svc.llm_service.calls[0][1], str)
