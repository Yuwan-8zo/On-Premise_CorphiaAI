"""
對外搜尋的「要不要查、查什麼」(web_search_policy.py)

真的連出去的只有 services/web_search.py（唯一出口）；這裡只做出去之前的三個決定：

  1. 這個單位的政策（管理者設定）：auto＝需要即時資訊時自動查、ask＝不自動查，只在回答下面提醒可以連網重答、
     off＝完全不連外網。
  2. 這一題需不需要即時資訊：用固定的規則判斷（看得懂、可稽核、不花時間），不是每一題都叫模型猜。
  3. 送出去的關鍵字：把整句問題濃縮成幾個搜尋詞再送，問題的其他內容不離開這台主機
     （送出前還會再過一次 DLP，見 web_search.search）。
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

MODES = ("auto", "ask", "off")
DEFAULT_MODE = "auto"

# 送出去的關鍵字最長幾個字（濃縮失敗時也用這個長度截斷）
QUERY_MAX_CHARS = 60
# 超過這個長度多半是貼上來的文件或程式，不是在問即時資訊
QUESTION_MAX_CHARS = 400
# 濃縮失敗時，問題不超過這個長度才直接拿來當關鍵字；更長的不送（寧可這次不查）
FALLBACK_MAX_CHARS = 30


def mode_from_settings(tenant_settings: Optional[dict]) -> str:
    """
    管理者的設定 → auto／ask／off。
    舊資料只有 web_search_auto（真＝不用先問）：真當成 auto、假當成 ask；兩個都沒設用預設值。
    """
    data = tenant_settings or {}
    mode = data.get("web_search_mode")
    if mode in MODES:
        return mode
    if "web_search_auto" in data:
        return "auto" if data.get("web_search_auto") else "ask"
    return DEFAULT_MODE


# ── 這一題需不需要即時資訊 ───────────────────────────────────────────────────────

# 使用者自己說要上網查
_EXPLICIT = re.compile(
    r"上網(查|找|搜)|網路上(查|找|搜)|連網(查|搜)|搜尋一下|查一下最新|幫我(搜尋|google)"
    r"|search (the )?(web|internet|online)|look (it |this )?up online|google (it|this)"
    r"|ネットで(調べ|検索)|ウェブで(調べ|検索)|検索して",
    re.IGNORECASE,
)

# 本身就是即時資訊的主題（不用再搭配時間詞）
_LIVE_TOPIC = re.compile(
    r"天氣|氣溫|降雨機率|颱風|地震|空氣品質|股價|股市|大盤|匯率|油價|金價|幣價|新聞|時事|頭條"
    r"|比分|賽程|賽果|戰績|開獎|票房|路況|航班|班機|停班停課"
    r"|\bweather\b|\bforecast\b|stock price|share price|exchange rate|\bnews\b|headlines|\bscores?\b"
    r"|天気|気温|台風|地震|株価|為替|ニュース|試合結果",
    re.IGNORECASE,
)

# 時間詞：講的是「現在」
_NOW = re.compile(
    r"最新|目前|現在|現任|今天|今日|昨天|昨日|明天|本週|這週|這禮拜|本月|這個月|最近|近期|今年|剛剛|即時"
    r"|\blatest\b|\bcurrent(ly)?\b|\btoday\b|\byesterday\b|\btomorrow\b|this (week|month|year)|\brecent(ly)?\b|right now"
    r"|現在の|最新の|今日の|昨日の|明日の|今週|今月|今年|最近の",
    re.IGNORECASE,
)

# 搭配時間詞才算：會隨時間改變的外界事實
_CHANGING_FACT = re.compile(
    r"版本|價格|售價|多少錢|報價|費率|利率|稅率|消息|公告|發布|發表|上市|上映|法規|政策|規定修正|排名|排行"
    r"|總統|總理|首相|院長|部長|市長|執行長|董事長|是誰|結果|狀況|情況|進度|活動|展覽|演唱會|營業時間|有開嗎"
    r"|\bversion\b|\bprice\b|\bcost\b|\brate\b|\brelease[ds]?\b|\bannounce|\bpolicy\b|\branking\b"
    r"|\bpresident\b|\bprime minister\b|\bceo\b|who is|\bresults?\b|\bstatus\b|\bevents?\b|opening hours"
    r"|バージョン|価格|値段|金利|発表|発売|政策|ランキング|大統領|首相|社長|誰|結果|状況|イベント|営業時間",
    re.IGNORECASE,
)

_CODE = re.compile(r"```|^\s{4,}\S", re.MULTILINE)


def needs_live_info(text: str, now: Optional[datetime] = None) -> bool:
    """
    這一題是不是在問「現在外面的狀況」。規則：
      - 自己說要上網查 → 是
      - 貼了程式、或整段很長（文件）→ 不是
      - 提到即時主題（天氣、股價、新聞…）→ 是
      - 時間詞（最新、今天、今年、今年或明年的年份）＋會隨時間改變的事實（版本、價格、誰是…）→ 是
    """
    text = (text or "").strip()
    if not text:
        return False
    if _EXPLICIT.search(text):
        return True
    if len(text) > QUESTION_MAX_CHARS or _CODE.search(text):
        return False
    if _LIVE_TOPIC.search(text):
        return True
    year = (now or datetime.now()).year
    mentions_now = bool(_NOW.search(text)) or any(str(y) in text for y in (year, year + 1))
    return mentions_now and bool(_CHANGING_FACT.search(text))


# ── 送出去的關鍵字 ──────────────────────────────────────────────────────────────

_QUERY_SCHEMA = {
    "type": "object",
    "properties": {"query": {"type": "string"}},
    "required": ["query"],
}

_QUERY_PROMPT = (
    "把下面這個問題改寫成給搜尋引擎用的關鍵字。\n"
    "規則：只留查得到答案的 2 到 6 個詞，用空白分開；不要完整句子、不要客套話；"
    "不要放人名、公司內部名稱、電話、信箱、編號這類個人或內部資料；語言跟問題一樣。\n\n"
    "問題：{question}"
)

# 個資遮罩留下的代號（例如 [NAME_1]、〔電話〕）和不該出現在關鍵字裡的符號
_PLACEHOLDER = re.compile(r"[\[〔【<（(][^\]〕】>）)]{0,24}[\]〕】>）)]")
_NOISE = re.compile(r"[\r\n\t\"'`*#|<>{}\\]+")
_POLITE = re.compile(
    r"^(請問一下|請問|請幫我|幫我|麻煩|想請教|我想知道|我想問|可以告訴我|告訴我|please|could you|can you|tell me)\s*[,，:：]?\s*",
    re.IGNORECASE,
)
_TAIL = re.compile(r"[?？!！。.~～\s]+$|(是什麼|是多少|怎麼樣|如何|嗎|呢)[?？]*$")


def clean_query(text: str) -> str:
    """關鍵字送出前的最後整理：拿掉個資代號、換行和符號、頭尾客套，限制長度"""
    q = _PLACEHOLDER.sub(" ", text or "")
    q = _NOISE.sub(" ", q)
    q = re.sub(r"\s+", " ", q).strip()
    q = _POLITE.sub("", q)
    q = _TAIL.sub("", q).strip()
    return q[:QUERY_MAX_CHARS].strip()


async def condense_query(llm_service, question: str, model_name: Optional[str] = None) -> str:
    """
    把整句問題濃縮成搜尋關鍵字（請本機模型做，格式用語法限制）。
    模型沒回、回空的、或回得比原句還長：問題本身很短（本來就像關鍵字）才用整理過的原句；
    長的問題寧可這次不查（回空字串）——整句送出去會帶太多不需要離開主機的內容。
    """
    cleaned = clean_query(question)
    fallback = cleaned if len(" ".join((question or "").split())) <= FALLBACK_MAX_CHARS else ""
    try:
        result = await llm_service.generate_structured(
            _QUERY_PROMPT.format(question=question[:QUESTION_MAX_CHARS]),
            _QUERY_SCHEMA, max_tokens=64, temperature=0.0, model_name=model_name,
        )
        query = clean_query(str((result or {}).get("query") or ""))
    except Exception as e:  # 濃縮失敗不能讓整題答不出來
        logger.warning("濃縮搜尋關鍵字失敗，改用原句: %s", e)
        return fallback
    # 模型沒有模型時的佔位答案、或沒濃縮到 → 用規則版
    if not query or query == "simulated" or len(query) > len(question):
        return fallback
    return query


__all__ = ["MODES", "DEFAULT_MODE", "mode_from_settings", "needs_live_info", "clean_query", "condense_query"]
