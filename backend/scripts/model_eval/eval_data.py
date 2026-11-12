"""
本機模型評估：題目與測試用檔案
================================

給 run_eval.py 用。內容都以「台灣中小企業」的日常工作為主：
  - ZH_QUESTIONS：正體中文問答、寫作、翻譯、法規常識（有標準答案的附 must 關鍵字，自動判對錯）
  - LONG_DOC：一份約 6 千字的員工手冊，用來量「讀長文件要等多久」和「從長文件找答案」
  - TOOL_TASKS：要用工具（列檔、讀檔、寫檔、跑程式）才做得完的工作，用 check() 自動檢查結果
  - build_workspace()：產生工具題用的資料夾（報價單.xlsx、會議紀錄.docx、銷售紀錄.csv）
"""

from __future__ import annotations

import csv
import random
from pathlib import Path

from docx import Document
from openpyxl import Workbook

# ── 長文件：員工手冊（重複章節湊到約 6 千字，答案藏在中間） ─────────────────────────
_HANDBOOK_SECTIONS = [
    "第一章 總則：本手冊適用於本公司全體正職與約聘人員，目的在說明工作規範、出勤、休假、薪資與資訊安全等事項。",
    "第二章 出勤：上班時間為上午九點至下午六點，中午休息一小時。遲到超過十五分鐘需於系統補登原因並經主管核可。",
    "第三章 薪資：每月五日發放上月薪資，以轉帳方式匯入員工指定帳戶。加班費依勞動基準法計算，需事先提出加班申請。",
    "第四章 資訊安全：員工不得將公司文件上傳至外部雲端服務。客戶個資僅能存放於公司內部伺服器，離職時須繳回所有設備。",
    "第五章 教育訓練：新進人員須於到職三十日內完成資訊安全與個資保護線上課程，每年另需完成六小時在職訓練。",
    "第六章 報帳：出差費用須於返回後十個工作天內檢附單據報帳，單筆超過新臺幣三萬元需經部門主管與財務長雙重簽核。",
]
_HANDBOOK_ANSWER = (
    "第七章 休假：員工到職滿一年者，本公司給予特別休假十二天，優於勞基法規定的七天；"
    "到職滿兩年者給予十四天。未休完的特休可於隔年三月底前申請折算工資。"
)


def long_doc(repeat: int = 6) -> str:
    """約 6 千字：前後是一般章節，特休那一段放在正中間（測模型會不會只看開頭結尾）"""
    body = [s for _ in range(repeat) for s in _HANDBOOK_SECTIONS]
    mid = len(body) // 2
    body.insert(mid, _HANDBOOK_ANSWER)
    return "員工手冊（2026 年版）\n\n" + "\n".join(body)


# ── 正體中文題（must：答案要出現的關鍵字，任一組全中即算對；None＝開放題，看人工／報告） ──
ZH_QUESTIONS: list[dict] = [
    {"id": "law_overtime", "type": "法規常識", "q": "依台灣勞動基準法，平日加班的前兩小時，加班費至少要加給平日每小時工資的多少？請直接回答比例。",
     "must": [["三分之一"], ["1/3"], ["1.34"], ["4/3"]]},
    {"id": "vat", "type": "法規常識", "q": "台灣一般營業稅的稅率是多少？只回答數字與單位。", "must": [["5%"], ["5％"], ["百分之五"]]},
    {"id": "ubn", "type": "法規常識", "q": "台灣公司的統一編號有幾碼？", "must": [["8"], ["八"]]},
    {"id": "math", "type": "計算", "q": "一張訂單有 3 個品項：單價 1200 元買 4 個、單價 350 元買 10 個、單價 5800 元買 1 個。加上 5% 營業稅後總共多少元（四捨五入到整數）？只回答數字。",
     "must": [["14,805"], ["14805"]]},  # (4800 + 3500 + 5800) × 1.05
    {"id": "explain_dlp", "type": "解釋", "q": "用不懂技術的老闆聽得懂的話，三句以內說明什麼是「資料外洩防護（DLP）」。", "must": None},
    {"id": "risk", "type": "分析", "q": "列出中小企業導入地端 AI 系統的三個好處與三個風險，每點一句。", "must": None},
    {"id": "email", "type": "寫作", "q": "幫我寫一封給客戶的延遲出貨致歉信，150 字以內，語氣正式但誠懇，要提出補償方案。", "must": None},
    {"id": "translate", "type": "翻譯", "q": "把這段翻成台灣正體中文：We regret to inform you that the shipment will be delayed by two weeks due to a supplier issue. We will provide a 10% discount on your next order.",
     "must": [["兩週"], ["兩個星期"], ["二週"], ["兩周"]]},
    {"id": "todo", "type": "整理", "q": "把以下會議筆記整理成待辦清單（負責人、事項、期限）：小陳下週三前要把報價單寄給客戶；美玲負責週五前更新官網產品頁；老闆說月底前要決定是否續約伺服器維護合約。",
     "must": [["小陳"], ["美玲"]]},
    {"id": "code", "type": "程式", "q": "寫一個 Python 函式 total_with_tax(prices)，輸入品項金額的串列，回傳加上 5% 營業稅並四捨五入到整數的總額。只要程式碼。",
     "must": [["def total_with_tax"]]},
]

# ── 工具題 ───────────────────────────────────────────────────────────────────────────
QUOTE_ITEMS = [("筆記型電腦", 32000, 3), ("螢幕 27 吋", 6800, 5), ("無線滑鼠", 590, 10), ("網路交換器", 4200, 2), ("UPS 不斷電", 8900, 1)]
QUOTE_TOTAL_TAXED = round(sum(p * q for _, p, q in QUOTE_ITEMS) * 1.05)

MONTHS = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]


def _sales_rows(seed: int = 7) -> list[tuple[str, str, int]]:
    rnd = random.Random(seed)
    rows = []
    for m in MONTHS:
        for _ in range(12):
            rows.append((f"{m}-{rnd.randint(1, 28):02d}", rnd.choice(["業務一部", "業務二部", "網路商店"]), rnd.randint(8, 95) * 1000))
    return rows


def best_month() -> str:
    totals: dict[str, int] = {}
    for d, _, amt in _sales_rows():
        totals[d[:7]] = totals.get(d[:7], 0) + amt
    return max(totals, key=totals.get)


MEETING_TODOS = [("王小明", "完成新版報價系統測試", "11/20"), ("林美玲", "整理客戶滿意度問卷結果", "11/22"), ("陳志豪", "聯絡機房廠商確認 UPS 保固", "11/25")]


def build_workspace(root: Path) -> Path:
    """產生工具題用的資料夾（每個模型各自一份，互不干擾）"""
    root.mkdir(parents=True, exist_ok=True)
    wb = Workbook()
    ws = wb.active
    ws.title = "報價單"
    ws.append(["品項", "單價", "數量"])
    for row in QUOTE_ITEMS:
        ws.append(list(row))
    wb.save(root / "報價單.xlsx")

    with open(root / "銷售紀錄.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["日期", "通路", "金額"])
        w.writerows(_sales_rows())

    doc = Document()
    doc.add_heading("11 月第二週部門會議紀錄", level=1)
    doc.add_paragraph("出席：王小明、林美玲、陳志豪、張經理")
    doc.add_paragraph("討論：本週主要檢討報價系統上線進度與客戶回饋。張經理提醒年底前要完成機房設備盤點。")
    for who, what, due in MEETING_TODOS:
        doc.add_paragraph(f"決議：{who} 負責{what}，期限 {due}。")
    doc.save(root / "會議紀錄.docx")
    (root / "說明.txt").write_text("這個資料夾是測試用的公司文件。", encoding="utf-8")
    return root


def _read(p: Path) -> str:
    return p.read_text(encoding="utf-8", errors="ignore") if p.exists() else ""


TOOL_TASKS: list[dict] = [
    {"id": "list", "q": "工作資料夾裡有哪些檔案？哪一個是報價單？",
     "check": lambda ws, ans: "報價單.xlsx" in ans},
    {"id": "quote_total", "q": "算出 報價單.xlsx 所有品項的總金額，加上 5% 營業稅後是多少元？（四捨五入到整數，回答數字）",
     "check": lambda ws, ans: str(QUOTE_TOTAL_TAXED) in ans.replace(",", "")},
    {"id": "best_month", "q": "銷售紀錄.csv 裡哪一個月份（例如 2026-01）的營收總和最高？請用程式計算。",
     "check": lambda ws, ans: best_month() in ans},
    {"id": "todo_file", "q": "讀 會議紀錄.docx，把所有待辦事項（負責人、事項、期限）整理成 Markdown 表格，寫成 待辦.md 存進工作資料夾。",
     "check": lambda ws, ans: all(w in _read(ws / "待辦.md") for w, _, _ in MEETING_TODOS)},
    {"id": "report", "q": "找出 銷售紀錄.csv 裡營收最高的月份與金額，寫一段兩三句的中文結論，存成 報告.txt。",
     "check": lambda ws, ans: best_month() in _read(ws / "報告.txt")},
]
