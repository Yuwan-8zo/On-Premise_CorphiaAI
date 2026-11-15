"""
附加檔案與專案問答的判斷（不需要資料庫）：
- 附了 Word／Excel／簡報又要求修改 → 產出同一種檔案
- 附加的網頁、程式碼原封不動交給 AI（看得到 <style>、<script>）
- 「讀取／整理所有檔案」改給每份文件的開頭
"""

import asyncio

from app.services import browser_folder, file_builder
from app.services.doc_intents import wants_all_documents


class TestEditRequest:
    def test_edit_attached_word_makes_word(self):
        assert file_builder.detect_edit_request("幫我把錯字修正", ["報告.docx"]) == file_builder.KIND_DOCX
        assert file_builder.detect_edit_request("翻譯成英文", ["prices.xlsx"]) == file_builder.KIND_XLSX
        assert file_builder.detect_edit_request("幫我改一下這份", ["deck.pptx"]) == file_builder.KIND_PPTX

    def test_questions_are_not_edits(self):
        assert file_builder.detect_edit_request("這份在講什麼", ["報告.docx"]) is None
        assert file_builder.detect_edit_request("怎麼改比較好", ["報告.docx"]) is None

    def test_needs_an_office_attachment(self):
        assert file_builder.detect_edit_request("幫我改", None) is None
        assert file_builder.detect_edit_request("幫我改", ["index.html", "style.css"]) is None


class TestCodeAttachments:
    def test_html_css_js_are_passed_raw(self):
        html = b"<html><head><style>body{color:red}</style></head><body><script>alert(1)</script></body></html>"
        cid = "test-code-attach"
        try:
            result = asyncio.run(browser_folder.attach(cid, [("index.html", html), ("app.js", b"console.log(1)"), ("s.css", b"p{}")]))
            assert sorted(result["accepted"]) == ["app.js", "index.html", "s.css"]
            text, files = browser_folder.consume(cid)
            assert "<style>body{color:red}</style>" in text and "<script>alert(1)</script>" in text
            assert "```javascript\nconsole.log(1)\n```" in text
        finally:
            browser_folder.discard(cid)

    def test_big5_source_is_decoded(self):
        assert browser_folder._decode_source("中文".encode("big5")) == "中文"


class TestAllDocuments:
    def test_whole_folder_requests(self):
        for t in ["讀取所有檔案", "幫我整理這些文件", "總結全部文件", "每份文件在講什麼", "讀取檔案"]:
            assert wants_all_documents(t), t

    def test_specific_questions(self):
        for t in ["附件一的授課時數是多少", "報告書的結論是什麼", "指導老師是誰"]:
            assert not wants_all_documents(t), t


def test_select_relevant_picks_late_passage_and_variable_values():
    """大檔案：問的東西在很後面也挑得到；段落只寫 var(--x) 時附上 --x 的定義（數值才答得出來）"""
    from app.services import browser_folder as bf

    filler = "\n".join(f"無關的第 {i} 行內容，講別的事情。" for i in range(4000))
    defs = ":root{\n  --lens-w:93px;  --lens-h:88px;   /* 放大鏡的寬、高 */\n}"
    usage = "<p>放大鏡的尺寸怎麼算：寬用 var(--lens-w)、高用 var(--lens-h)。</p>"
    text = "【spec.html】\n" + defs + "\n" + filler + "\n" + usage + "\n" + filler
    out, cut = bf.select_relevant(text, "放大鏡的尺寸怎麼算？", 6000)
    assert cut and len(out) <= 6000
    assert "var(--lens-w)" in out
    assert "--lens-w:93px" in out


def test_select_relevant_small_text_kept_whole():
    from app.services import browser_folder as bf

    assert bf.select_relevant("短短的內容", "隨便問", 1000) == ("短短的內容", False)


def test_select_relevant_takes_the_match_before_its_neighbors():
    """長度只夠放一段時，放的是答案那段，不是它前面的段落"""
    from app.services import browser_folder as bf

    before = "\n".join(f"前面無關的第 {i} 行。" for i in range(150))
    answer = "答案：放大鏡寬 93。\n" + "\n".join(f"補充說明第 {i} 行。" for i in range(140))
    text = "【a.txt】\n" + before + "\n" + answer
    out, cut = bf.select_relevant(text, "放大鏡寬多少", 1800)
    assert cut
    assert "放大鏡寬 93" in out


def test_overview_budget_fits_small_model():
    """4096 的模型：總覽長度要扣掉回答、提示和問題，不能照 9000 字給（會整題失敗）"""
    from types import SimpleNamespace

    from app.services import chat_service as cs

    svc = SimpleNamespace(llm_service=SimpleNamespace(context_size=4096))
    small = cs.ChatService._overview_budget(svc, "讀取所有檔案")
    assert 0 < small < 4096 - cs.ATTACH_REPLY_RESERVE
    svc.llm_service.context_size = 32768
    assert cs.ChatService._overview_budget(svc, "讀取所有檔案") == cs.OVERVIEW_CONTEXT_CHARS
