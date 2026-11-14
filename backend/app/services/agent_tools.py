"""
AI 自己動手做事：模型可以用的工具 (agent_tools.py)

模型回答前可以自己決定「先查一下、算一下」，一題可以連做好幾步（上限見 chat_service 的 AGENT_MAX_ROUNDS）。
這裡定義有哪些工具、每個工具實際做什麼。原則：

  1. 只有「查」和「算」，沒有會改東西的工具（寫檔、刪檔、寄信、執行程式都不在這裡）。
     模型被文件或網頁裡的字騙去亂呼叫工具時，最壞的結果也只是多查一次。
  2. 權限跟著這個人：查文件只查得到他本來就看得到的；連外網照管理者的政策，送出前一樣過列管字詞檢查。
  3. 工具拿回來的東西都當成「外部、不可信的資料」：先過和文件片段同一套檢查（藏指令、列管字詞、個資遮罩）才給模型。
  4. 每一步都留下紀錄：畫面上看得到做了什麼，稽核紀錄也有一筆。
"""

from __future__ import annotations

import ast
import logging
import operator
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Awaitable, Callable, Optional

import app.services.context_guard as context_guard
import app.services.web_search as web_search_svc

logger = logging.getLogger(__name__)

# 一個工具的結果最多給模型幾個字（太長會把上下文塞滿）
RESULT_MAX_CHARS = 3000
# 查文件一次拿幾段
DOCUMENT_HITS = 4
# 算式最長幾個字、次方最大到多少（避免 9**9**9 這種把主機算到當掉的式子）
EXPRESSION_MAX_CHARS = 200
POWER_MAX = 1000
NUMBER_MAX = 10 ** 30

WEEKDAYS = "一二三四五六日"


@dataclass
class ToolContext:
    """這一題可以用的範圍（由 chat_service 依對話主人、管理者政策填好）"""

    # 查文件：給關鍵字，回這個人看得到的文件裡相關的段落；None＝這個人沒有可以查的文件
    search_documents: Optional[Callable[[str], Awaitable[list[dict]]]] = None
    # 這一題可不可以由模型自己決定連外網（政策是「自動」而且還沒查過）
    allow_web: bool = False
    now: Callable[[], datetime] = datetime.now
    # 使用者這一題原本的問題、這一題用到的公司內部資料（檢索片段、工具查到的文件段落）：
    # 只給對外搜尋的出口檢查「關鍵字有沒有把內部資料帶出去」用，本身不會送出
    question: str = ""
    private_texts: list = field(default_factory=list)


@dataclass
class ToolResult:
    """一步做完的結果"""

    # 給模型看的內容（已經過安全檢查）
    text: str
    # 給使用者看的一句話（畫面上的步驟清單）
    summary: str
    ok: bool = True
    # 查文件拿到的段落（接到回答的「參考來源」）
    hits: list[dict] = field(default_factory=list)
    # 連外網的報告（接到回答的「已連外網」標示與稽核）
    web_report: Optional[dict] = None


def _function(name: str, description: str, properties: dict, required: list[str]) -> dict:
    return {"type": "function", "function": {
        "name": name, "description": description,
        "parameters": {"type": "object", "properties": properties, "required": required},
    }}


TOOL_SEARCH_DOCUMENTS = _function(
    "search_documents",
    "在公司內部文件裡找相關段落。問題跟公司的規定、流程、產品、內部資料有關時先用這個。",
    {"query": {"type": "string", "description": "要找的關鍵字或一句話"}}, ["query"],
)
TOOL_WEB_SEARCH = _function(
    "web_search",
    "連到公開網路搜尋。只有需要最新、即時、或公司文件裡不會有的公開資訊時才用。關鍵字裡不要放人名、內部名稱或任何個人資料。",
    {"query": {"type": "string", "description": "2 到 6 個搜尋關鍵字，用空白分開"}}, ["query"],
)
TOOL_CALCULATE = _function(
    "calculate",
    "算數學式（加減乘除、次方、括號、百分比先換成小數）。任何要算的數字都用這個，不要心算。",
    {"expression": {"type": "string", "description": "算式，例如 (1250 * 12) * 0.05"}}, ["expression"],
)
TOOL_CURRENT_TIME = _function(
    "current_time", "現在的日期、時間、星期幾。問題跟今天、現在、期限、還有幾天有關時用。", {}, [],
)


def available_tools(ctx: ToolContext) -> list[dict]:
    """這一題給模型的工具清單（沒有權限或沒有資料的工具就不給，模型根本不知道有它）"""
    tools = [TOOL_CALCULATE, TOOL_CURRENT_TIME]
    if ctx.search_documents:
        tools.insert(0, TOOL_SEARCH_DOCUMENTS)
    if ctx.allow_web:
        tools.append(TOOL_WEB_SEARCH)
    return tools


# ── 計算 ─────────────────────────────────────────────────────────────────────

_BINARY = {
    ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul, ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv, ast.Mod: operator.mod, ast.Pow: operator.pow,
}
_UNARY = {ast.UAdd: operator.pos, ast.USub: operator.neg}


def _eval(node: ast.AST) -> float:
    """只認數字和加減乘除次方括號；其他任何東西（名稱、函式呼叫、屬性）一律拒絕——這裡不是在執行程式"""
    if isinstance(node, ast.Expression):
        return _eval(node.body)
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)) and not isinstance(node.value, bool):
        return node.value
    if isinstance(node, ast.UnaryOp) and type(node.op) in _UNARY:
        return _UNARY[type(node.op)](_eval(node.operand))
    if isinstance(node, ast.BinOp) and type(node.op) in _BINARY:
        left, right = _eval(node.left), _eval(node.right)
        if isinstance(node.op, ast.Pow) and (abs(right) > POWER_MAX or abs(left) > NUMBER_MAX):
            raise ValueError("數字太大")
        value = _BINARY[type(node.op)](left, right)
        if abs(value) > NUMBER_MAX:
            raise ValueError("數字太大")
        return value
    raise ValueError("只能算數字的加減乘除、次方和括號")


def calculate(expression: str) -> str:
    """算一個數學式，回結果的文字；式子不合規則丟 ValueError"""
    text = (expression or "").strip().replace("×", "*").replace("÷", "/").replace("^", "**").replace(",", "").replace("，", "")
    if not text or len(text) > EXPRESSION_MAX_CHARS:
        raise ValueError("算式是空的或太長")
    try:
        value = _eval(ast.parse(text, mode="eval"))
    except ZeroDivisionError:
        raise ValueError("不能除以零")
    except SyntaxError:
        raise ValueError("算式格式不對")
    if isinstance(value, float):
        value = round(value, 10)
        if value == int(value):
            value = int(value)
    return str(value)


# ── 執行 ─────────────────────────────────────────────────────────────────────

def _clip(text: str) -> str:
    return text if len(text) <= RESULT_MAX_CHARS else text[:RESULT_MAX_CHARS] + "…（後面省略）"


def _failed(reason: str) -> ToolResult:
    return ToolResult(text=f"沒有完成：{reason}", summary=reason, ok=False)


async def _run_search_documents(ctx: ToolContext, args: dict) -> ToolResult:
    query = str(args.get("query") or "").strip()
    if not ctx.search_documents or not query:
        return _failed("沒有可以查的文件" if not ctx.search_documents else "沒有給關鍵字")
    hits = await ctx.search_documents(query)
    # 文件片段是外部資料：和一般檢索同一套檢查（藏指令的整段丟掉、列管字詞丟掉、個資遮罩）
    kept, _report = context_guard.screen_chunks(hits)
    if not kept:
        return ToolResult(text="文件裡沒有找到相關內容。", summary=f"查文件「{query}」：沒有找到")
    parts = [f"[{(h.get('metadata') or {}).get('filename', '文件')}]\n{h.get('content', '')}" for h in kept]
    names = sorted({(h.get("metadata") or {}).get("filename", "") for h in kept} - {""})
    ctx.private_texts.extend(h.get("content", "") for h in kept)  # 之後若要連外網，關鍵字不能帶出這些內容
    return ToolResult(
        text=_clip("\n\n".join(parts)), hits=kept,
        summary=f"查文件「{query}」：找到 {len(kept)} 段（{'、'.join(names[:3])}{'…' if len(names) > 3 else ''}）",
    )


async def _run_web_search(ctx: ToolContext, args: dict) -> ToolResult:
    if not ctx.allow_web:
        return _failed("這一題不能連外網")
    # 模型給的關鍵字也整理一次（拿掉個資代號、符號、限制長度）；送出前的列管字詞檢查在 web_search.search 裡
    from app.services.web_search_policy import clean_query

    query = clean_query(str(args.get("query") or ""))
    if not query:
        return _failed("沒有給關鍵字")
    report = await web_search_svc.search(query, question=ctx.question, private_texts=ctx.private_texts)
    if report["blocked"]:
        return ToolResult(text=f"沒有完成：{report['reason']}", summary=f"連外網被擋下：{report['reason']}", ok=False, web_report=report)
    if not report["results"]:
        return ToolResult(text="網路上沒有找到相關結果。", summary=f"連外網查「{query}」：沒有結果", web_report=report)
    return ToolResult(
        text=_clip(web_search_svc.format_results_for_prompt(report)), web_report=report,
        summary=f"連外網查「{query}」：{len(report['results'])} 筆結果",
    )


async def _run_calculate(_ctx: ToolContext, args: dict) -> ToolResult:
    expression = str(args.get("expression") or "")
    try:
        value = calculate(expression)
    except ValueError as e:
        return _failed(f"算不出來（{e}）")
    return ToolResult(text=value, summary=f"計算 {expression.strip()} = {value}")


async def _run_current_time(ctx: ToolContext, _args: dict) -> ToolResult:
    now = ctx.now()
    text = f"{now:%Y-%m-%d %H:%M}，星期{WEEKDAYS[now.weekday()]}"
    return ToolResult(text=text, summary=f"看現在時間：{text}")


_RUNNERS: dict[str, Callable[[ToolContext, dict], Awaitable[ToolResult]]] = {
    "search_documents": _run_search_documents,
    "web_search": _run_web_search,
    "calculate": _run_calculate,
    "current_time": _run_current_time,
}


async def run_tool(ctx: ToolContext, name: str, args: Any) -> ToolResult:
    """
    執行一步。模型給的工具名稱和參數都不可信：不在這一題清單裡的工具不做、參數不是物件就當成沒給；
    工具自己出錯也回一句話給模型（讓它換個做法），不會讓整題失敗。
    """
    allowed = {t["function"]["name"] for t in available_tools(ctx)}
    runner = _RUNNERS.get(name)
    if runner is None or name not in allowed:
        return _failed(f"沒有「{name}」這個工具")
    try:
        result = await runner(ctx, args if isinstance(args, dict) else {})
    except Exception as e:
        logger.warning("工具 %s 執行失敗: %s", name, e)
        return _failed("工具暫時不能用")
    # 最後一關：不管哪個工具，要給模型的字都再過一次檢查（個資遮罩；命中列管字詞或藏指令就不給）
    safe, reason = context_guard.screen_text(result.text)
    if safe is None:
        return ToolResult(text="沒有完成：結果沒有通過安全檢查。", summary=f"{result.summary}（內容沒通過安全檢查，沒有交給 AI）", ok=False,
                          web_report=result.web_report)
    result.text = safe
    return result


__all__ = ["ToolContext", "ToolResult", "available_tools", "run_tool", "calculate", "RESULT_MAX_CHARS"]
