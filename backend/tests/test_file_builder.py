"""
AI 產出檔案（services/file_builder）的單元測試

兩件事：
1. 判斷使用者這句話是不是要做檔案（寧可漏判，也不要把一般問題搶去做檔案）
2. 把內容規格排版成 Word／Excel／簡報（數字存成數字、公式開頭的文字不會被執行…）
不需要模型、不需要資料庫。
"""

import io

import pytest
from docx import Document
from openpyxl import load_workbook
from pptx import Presentation

from app.services import file_builder as fb

WANT_FILE = [
    ("幫我做一份第三季業績的簡報", "pptx"), ("把剛剛的內容整理成 Word 檔", "docx"), ("產生一份出差費用的 Excel", "xlsx"),
    ("請幫我寫一份 word 文件介紹公司的請假規定", "docx"), ("Create a PowerPoint about onboarding", "pptx"), ("エクセルで経費一覧を作って", "xlsx"),
    ("幫我做一份試算表，列出五個部門的預算", "xlsx"), ("做投影片：新人訓練", "pptx"), ("我想做一份簡報", "pptx"),
    ("可以幫我把這些資料做成 Excel 嗎", "xlsx"), ("用 Excel 做一份預算表", "xlsx"),
    ("幫我做一份關於 2026 年度第三季各部門業績與預算執行狀況的簡報", "pptx"),
    ("幫我做一份 Word 文件，主題是「新進員工報到須知」，包含報到流程、需要準備的文件、第一週的安排三個章節。", "docx"),
    ("產生一份 Excel 試算表：列出業務部、人資部、研發部、財務部四個部門今年的預算（單位元）和負責人。", "xlsx"),
    ("把剛剛的新進員工報到須知做成簡報，五張投影片以內。", "pptx"), ("Please make me a spreadsheet of the budget", "xlsx"),
    ("スライドを作って", "pptx"), ("generate an excel file with these numbers", "xlsx"), ("把這份 Word 的內容做成簡報", "pptx"),
    ("請匯出成 xlsx", "xlsx"), ("幫我擬一份 Word 文件", "docx"), ("write a word document about leave policy", "docx"),
]
NOT_A_FILE = [
    "Word 怎麼設定頁碼？", "如何做簡報比較好", "公司的出差規定是什麼", "幫我寫一封信", "excel 的 vlookup 是什麼",
    "幫我寫一封信，說明 Excel 報表延遲的原因", "幫我寫一封 email，附件是 Excel 報表", "我昨天做的簡報被主管退回，幫我寫一段道歉的話",
    "Excel 的樞紐分析表是什麼？用兩句話說明。", "幫我整理這份簡報的重點", "請幫我檢查這個 Excel 公式哪裡寫錯：=SUM(A1:A3",
    "幫我翻譯這句話：I will send the PowerPoint tomorrow.", "記住我的報告都要用 Word 格式", "寫一段文字介紹公司",
    "幫我把 Word 裡的這段話改得正式一點", "word", "",
]


class TestDetectFileRequest:
    @pytest.mark.parametrize("text,kind", WANT_FILE)
    def test_file_requests(self, text, kind):
        assert fb.detect_file_request(text) == kind

    @pytest.mark.parametrize("text", NOT_A_FILE)
    def test_ordinary_questions(self, text):
        assert fb.detect_file_request(text) is None


class TestBuildFile:
    def test_word(self):
        data = fb.build_file("docx", {"title": "出差管理辦法摘要", "sections": [
            {"heading": "住宿", "paragraphs": ["國內出差住宿費每晚上限新臺幣三千二百元。"], "bullets": ["三日前申請", "超過自付"]},
            {"heading": "交通", "paragraphs": ["以大眾運輸為原則。"], "bullets": []},
        ]})
        texts = [p.text for p in Document(io.BytesIO(data)).paragraphs]
        assert texts[0] == "出差管理辦法摘要"
        assert "住宿" in texts and "三日前申請" in texts
        assert len(texts) == 7

    def test_excel(self):
        data = fb.build_file("xlsx", {"title": "部門預算", "sheets": [{"name": "預算/2026", "columns": ["部門", "預算", "編號", "備註"], "rows": [
            ["業務部", "1,200,000", "007", "=SUM(A1)"], ["人資部", "350000.5", "012", "-待確認"], ["研發部", "800000"],
        ]}]})
        ws = load_workbook(io.BytesIO(data)).worksheets[0]
        assert ws.title == "預算 2026"                                   # 工作表名稱去掉不能用的字
        assert (ws["B2"].value, ws["B3"].value) == (1200000, 350000.5)   # 數字存成數字
        assert ws["C2"].value == "007"                                    # 編號維持文字（不會變成 7）
        assert (ws["D2"].value, ws["D3"].value) == ("'=SUM(A1)", "'-待確認")  # 公式開頭的文字不會被執行
        assert ws["D4"].value is None and ws.freeze_panes == "A2"         # 少的欄位補空、凍結首列

    def test_excel_cell_holding_a_whole_record(self):
        """模型偶爾會把一整筆資料塞進一格：挑出屬於這一欄的值"""
        data = fb.build_file("xlsx", {"title": "t", "sheets": [{"name": "預算", "columns": ["部門", "預算（單位元）", "負責人"], "rows": [
            ["業務部", '{"預算": 5000000, "負責人": "張三"}', "張三"], ["人資部", '{"x": 1, "y": "二"}', "李四"], ["研發部", "{不是 JSON}", "王五"],
        ]}]})
        ws = load_workbook(io.BytesIO(data)).worksheets[0]
        assert ws["B2"].value == 5000000
        assert ws["B3"].value == "1、二"
        assert ws["B4"].value == "{不是 JSON}"

    def test_slides(self):
        data = fb.build_file("pptx", {"title": "第三季業績報告", "subtitle": "業務部", "slides": [
            {"title": "整體表現", "bullets": ["營收成長 12%", "新客戶 18 家", "續約率 91%"]}, {"title": "下一步", "bullets": ["擴大北區團隊", "導入地端 AI"]},
        ]})
        deck = Presentation(io.BytesIO(data))
        assert len(deck.slides) == 3                                      # 封面＋2 張
        assert round(deck.slide_width / deck.slide_height, 2) == 1.78     # 16:9


class TestHelpers:
    def test_outline(self):
        assert fb.outline("docx", {"sections": [{"heading": "住宿"}, {"heading": "交通"}]}) == ["住宿", "交通"]
        assert fb.outline("xlsx", {"sheets": [{"name": "預算", "rows": [[1], [2]]}]}) == ["預算（2 列）"]

    def test_safe_filename(self):
        assert fb.safe_filename('Q3: 業績/報告?', "pptx") == "Q3  業績 報告.pptx"
        assert fb.safe_filename("", "docx") == "AI 產出.docx"

    def test_empty_spec_is_not_usable(self):
        assert fb.spec_is_usable("docx", {"title": "simulated", "sections": False}) is False
        assert fb.spec_is_usable("pptx", {"slides": [{"title": "a", "bullets": ["b"]}]}) is True
