"""壓力測試找到的檔案安全問題：刪文件只能刪系統上傳區裡的檔案；同一個對話同時只能有一個回答"""
import asyncio

import pytest

from app.services import generation_registry
from app.services.document_service import is_inside, remove_upload_file


def test_remove_upload_file_only_inside_upload_dir(tmp_path):
    uploads = tmp_path / "uploads"
    (uploads / "default").mkdir(parents=True)
    mine = uploads / "default" / "a.txt"
    mine.write_text("x")
    company = tmp_path / "company" / "contract.docx"
    company.parent.mkdir()
    company.write_text("important")

    # 連接資料夾的原始檔（在上傳區外面）：不能刪
    assert remove_upload_file(str(company), uploads) is False
    assert company.exists()
    # 用 .. 繞出去也不行
    assert remove_upload_file(str(uploads / "default" / ".." / ".." / "company" / "contract.docx"), uploads) is False
    assert company.exists()
    # 上傳區裡的：刪
    assert remove_upload_file(str(mine), uploads) is True
    assert not mine.exists()
    # 沒有路徑、檔案不存在：不出錯
    assert remove_upload_file(None, uploads) is False
    assert remove_upload_file(str(mine), uploads) is False


def test_is_inside(tmp_path):
    assert is_inside(tmp_path / "a" / "b.txt", tmp_path)
    assert not is_inside(tmp_path.parent / "other.txt", tmp_path)
    assert not is_inside(tmp_path / ".." / "x.txt", tmp_path)


@pytest.mark.asyncio
async def test_generation_registry_one_answer_per_conversation():
    started = asyncio.Event()

    async def answer():
        started.set()
        await asyncio.sleep(60)

    task = asyncio.create_task(answer())
    generation_registry.register("conv-1", task)
    await started.wait()
    assert generation_registry.is_generating("conv-1")
    assert not generation_registry.is_generating("conv-2")

    # 刪除對話時：停掉並等它收尾
    assert await generation_registry.cancel("conv-1") is True
    assert task.cancelled()
    await asyncio.sleep(0)
    assert not generation_registry.is_generating("conv-1")
    assert await generation_registry.cancel("conv-1") is False


@pytest.mark.asyncio
async def test_generation_registry_forgets_finished_answers():
    async def answer():
        return None

    task = asyncio.create_task(answer())
    generation_registry.register("conv-3", task)
    await task
    await asyncio.sleep(0)
    assert not generation_registry.is_generating("conv-3")
    assert generation_registry.active_count() == 0
