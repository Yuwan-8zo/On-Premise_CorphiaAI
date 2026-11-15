"""
瀏覽器臨時資料夾：使用者在聊天室用瀏覽器選這台電腦的一個資料夾，附給 AI 看

和「連接資料夾」（A，管理員在伺服器上設定、長期索引）不一樣：這個是使用者自己操作、
只附在「下一則」訊息，不建立 documents／document_chunks 紀錄，伺服器不留底——

  attach()  收到上傳的檔案（已經在記憶體裡的 bytes）→ 寫到暫存檔解析成文字（解析完立刻刪暫存檔，
            解析失敗、逾時、程序被中斷都一樣會刪，見 finally）→ 送模型前的篩檢（context_guard）→
            放進「這個對話的暫存格」，等對方送下一則訊息才用，用完或過期就清掉
  consume() 這個對話有沒有剛附的內容；有就回文字並清掉（只用一次）

暫存格只在這台伺服器的記憶體裡（process 內的 dict），不是資料庫欄位：伺服器重啟、這個對話還沒送出
下一則訊息，暫存的內容就不見了——這本來就是設計成「只附這一次」。
"""

from __future__ import annotations

import asyncio
import logging
import math
import re
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path
from threading import Lock

from app.core.config import settings
import app.services.text_extract as text_extract
from app.services.context_guard import screen_chunks

logger = logging.getLogger(__name__)


class BrowserFolderError(Exception):
    """給使用者看的錯誤（整批都不收，例如檔案數、總大小超過上限）"""


@dataclass
class _Pending:
    text: str
    files: list[str]
    skipped: list[dict]
    report: dict
    expires_at: float


@dataclass
class _Store:
    items: dict[str, _Pending] = field(default_factory=dict)
    lock: Lock = field(default_factory=Lock)


_store = _Store()

# 程式碼和網頁原始檔：原封不動交給 AI（要改網頁、改程式時才看得到 <style>、<script> 和完整原始碼），
# 不像知識庫那樣轉成純文字。副檔名 → 給 AI 看的語言標記
CODE_EXTS = {
    ".html": "html", ".htm": "html", ".css": "css", ".js": "javascript", ".mjs": "javascript",
    ".ts": "typescript", ".tsx": "tsx", ".jsx": "jsx", ".json": "json", ".py": "python", ".xml": "xml", ".svg": "svg",
}


def _decode_source(data: bytes) -> str:
    """原始碼檔：UTF-8（含 BOM）讀不出來就用 Big5 再試；都不行就丟例外（呼叫端當成讀不出內容）"""
    for enc in ("utf-8-sig", "big5"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    raise ValueError("文字編碼無法辨識")

def _write_temp(data: bytes, ext: str) -> Path:
    """把上傳內容寫成暫存檔（給既有的解析器讀；呼叫端用完會刪掉）"""
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(data)
        return Path(tmp.name)



def _sweep_locked() -> None:
    """清掉過期的（呼叫端要先拿到 lock）"""
    now = time.time()
    for cid in [cid for cid, p in _store.items.items() if p.expires_at <= now]:
        del _store.items[cid]


def _ttl_seconds() -> float:
    return max(1, settings.browser_folder_ttl_min) * 60


async def attach(conversation_id: str, files: list[tuple[str, bytes]]) -> dict:
    """
    files：[(檔名, 內容), ...]（檔名只用來判斷副檔名、顯示給使用者看，不當成路徑使用）
    回傳摘要：{"accepted": [檔名...], "skipped": [{"name", "reason"}...], "chars": 附上的總字數}
    附上的內容本身不回傳給呼叫端（API 層不需要，也不要讓它再被記錄下來）
    """
    if not files:
        raise BrowserFolderError("沒有選到任何檔案")
    if len(files) > settings.browser_folder_max_files:
        raise BrowserFolderError(f"這個資料夾有 {len(files)} 個檔案，一次最多附 {settings.browser_folder_max_files} 個")
    total_bytes = sum(len(data) for _, data in files)
    max_bytes = settings.browser_folder_max_total_mb * 1024 * 1024
    if total_bytes > max_bytes:
        raise BrowserFolderError(f"這個資料夾總共 {total_bytes / 1024 / 1024:.1f} MB，超過 {settings.browser_folder_max_total_mb} MB 的上限")

    skipped: list[dict] = []
    chunks: list[dict] = []  # 給 context_guard.screen_chunks 用的格式
    per_file_max = settings.browser_folder_max_chars_per_file

    for name, data in files:
        ext = Path(name).suffix.lower()
        if ext in CODE_EXTS:
            try:
                source = _decode_source(data).strip()
            except ValueError:
                skipped.append({"name": name, "reason": "讀不出內容（檔案可能壞了或格式特殊）"})
                continue
            if not source:
                skipped.append({"name": name, "reason": "內容是空的"})
                continue
            fence = f"```{CODE_EXTS[ext]}"
            chunks.append({"chunk_id": name, "content": f"{fence}\n{source[:per_file_max]}\n```", "metadata": {"filename": name}})
            continue
        if ext not in text_extract.SUPPORTED_EXTS:
            skipped.append({"name": name, "reason": "不支援的檔案格式"})
            continue
        tmp_path: Path | None = None
        try:
            tmp_path = await asyncio.to_thread(_write_temp, data, ext)
            text = (await text_extract.extract_text(tmp_path, ext.lstrip("."))).strip()
        except Exception as e:
            logger.info("瀏覽器臨時資料夾：%s 解析失敗：%s", name, e)
            skipped.append({"name": name, "reason": "讀不出內容（檔案可能壞了或格式特殊）"})
            continue
        finally:
            # 暫存檔只是為了重用既有的解析器，解析完（不管成功失敗）都要立刻刪掉，不留底
            if tmp_path is not None:
                tmp_path.unlink(missing_ok=True)
        if not text:
            skipped.append({"name": name, "reason": "內容是空的"})
            continue
        chunks.append({"chunk_id": name, "content": text[:per_file_max], "metadata": {"filename": name}})

    kept, report = screen_chunks(chunks)
    dropped_names = set(report["injection"]) | set(report["dlp"])
    for c in chunks:
        if c["chunk_id"] in dropped_names:
            reason = "內容像是要改寫 AI 的規則" if c["chunk_id"] in report["injection"] else "內容含有公司禁止的詞"
            skipped.append({"name": c["chunk_id"], "reason": reason})

    if not kept:
        raise BrowserFolderError("這個資料夾裡沒有讀得到內容、而且通過安全檢查的檔案" if files else "沒有選到任何檔案")

    # 總字數還是太多：從後面開始整份拿掉（不要把每份都砍一半，變得兩邊都看不完整）
    total_chars = sum(len(c["content"]) for c in kept)
    while total_chars > settings.browser_folder_max_chars_total and len(kept) > 1:
        dropped = kept.pop()
        total_chars -= len(dropped["content"])
        skipped.append({"name": dropped["chunk_id"], "reason": "資料夾內容太多，超過上限的部分沒有附上"})
    if total_chars > settings.browser_folder_max_chars_total:
        kept[0]["content"] = kept[0]["content"][: settings.browser_folder_max_chars_total]
        total_chars = len(kept[0]["content"])

    text = "\n\n".join(f"【{c['chunk_id']}】\n{c['content']}" for c in kept)
    accepted = [c["chunk_id"] for c in kept]

    with _store.lock:
        _sweep_locked()
        _store.items[conversation_id] = _Pending(
            text=text, files=accepted, skipped=skipped, report=report, expires_at=time.time() + _ttl_seconds(),
        )
    return {"accepted": accepted, "skipped": skipped, "chars": total_chars, "pii": report["pii"]}


TRUNCATED_NOTE = "\n[……後面的內容超過模型一次能讀的長度，已省略；需要的話請分批附上或縮小資料夾……]"

# 依問題挑段落：每段多長（字）、挑中的段落前後各多帶幾段（上下文）
SELECT_PIECE_CHARS = 1200
SELECT_NEIGHBORS = 1
# 挑中的段落用到 CSS 變數（var(--x)）時，另外附上它定義的那一行；最多占這一題長度的比例、每行最多幾字
SELECT_VALUES_SHARE = 0.15
SELECT_VALUE_LINE_CHARS = 300
VALUES_NOTE = "（上面段落用到的設定值，取自檔案裡的定義）"
_VAR_REF = re.compile(r"--[A-Za-z0-9_-]+")
_VAR_DEF = re.compile(r"(--[A-Za-z0-9_-]+)\s*:")
SELECTED_NOTE = "（檔案太長，以下是依這一題挑出的相關段落，依原本順序排列；沒列出的部分這次沒有提供）"
_FILE_HEAD = re.compile(r"^【(.+)】$")
_WORD = re.compile(r"[A-Za-z][A-Za-z0-9_\-]{1,}")
_CJK = re.compile(r"[\u4e00-\u9fff]+")


# 問的說法和檔案的寫法常常不一樣（中文問、程式碼是英文；問「尺寸」、檔案寫「寬、高」）：常用的介面與文件用語補上同義詞
_SYNONYMS = {
    "尺寸": ["寬", "高", "大小", "size", "width", "height"], "大小": ["寬", "高", "size"], "寬度": ["寬", "width"], "高度": ["高", "height"],
    "放大鏡": ["lens", "鏡片"], "按鈕": ["button", "btn"], "顏色": ["color", "色"], "配色": ["color", "色"], "圓角": ["radius"],
    "字型": ["font"], "字體": ["font"], "間距": ["gap", "margin", "padding"], "動畫": ["animation", "transition"],
    "陰影": ["shadow"], "背景": ["background"], "選單": ["menu"], "對話框": ["dialog"], "輸入框": ["input"], "時間": ["duration"],
}


def _terms(question: str) -> list[str]:
    """問題裡用來比對的詞：英數字詞（小寫）＋中文兩字一組＋常用同義詞"""
    words = [w.lower() for w in _WORD.findall(question)]
    grams = [run[i:i + 2] for run in _CJK.findall(question) for i in range(len(run) - 1)]
    extra = [syn.lower() for key, syns in _SYNONYMS.items() if key in question for syn in syns]
    return list(dict.fromkeys(words + grams + extra))


def _pieces(text: str) -> list[tuple[str, str]]:
    """切成（檔名, 段落）：照行切、每段約 SELECT_PIECE_CHARS 字；遇到「【檔名】」換檔"""
    out: list[tuple[str, str]] = []
    name, buf, size = "", [], 0
    for line in text.split("\n"):
        head = _FILE_HEAD.match(line)
        if head:
            if buf:
                out.append((name, "\n".join(buf)))
            name, buf, size = head.group(1), [], 0
            continue
        while len(line) > SELECT_PIECE_CHARS:  # 一行就很長（壓縮過的 CSS／JS）：硬切
            if buf:
                out.append((name, "\n".join(buf)))
                buf, size = [], 0
            out.append((name, line[:SELECT_PIECE_CHARS]))
            line = line[SELECT_PIECE_CHARS:]
        buf.append(line)
        size += len(line) + 1
        if size >= SELECT_PIECE_CHARS:
            out.append((name, "\n".join(buf)))
            buf, size = [], 0
    if buf:
        out.append((name, "\n".join(buf)))
    return [(n, p) for n, p in out if p.strip()]


def select_relevant(text: str, question: str, budget_chars: int) -> tuple[str, bool]:
    """
    附件放得進這一題的長度就整份給；放不下時依問題挑段落（不是只給開頭）：
    切成小段 → 每段依問題裡的詞出現次數計分（越少見的詞分數越高）→ 從高分挑起、連前後各一段一起帶，
    直到放滿 → 照原本順序排好、標出檔名。回（文字, 有沒有節錄）。問題裡沒有可比對的詞就退回取開頭。
    """
    if len(text) <= budget_chars:
        return text, False
    pieces = _pieces(text)
    terms = _terms(question)
    if not pieces or not terms or budget_chars <= len(SELECTED_NOTE) + 50:
        return fit_to_budget(text, budget_chars)
    lowered = [p.lower() for _n, p in pieces]
    df = {t: sum(1 for p in lowered if t in p) for t in terms}
    n = len(pieces)
    weight = {t: math.log((n + 1) / (df[t] + 1)) + 0.1 for t in terms if df[t]}
    if not weight:
        return fit_to_budget(text, budget_chars)
    # 計分：同一段命中「越多種」詞越相關（每個詞最多算兩次，不讓一個到處都有的詞靠次數灌分），再乘上命中種類數
    def score(p: str) -> float:
        hit = {t: min(p.count(t), 2) for t in weight if t in p}
        return sum(c * weight[t] for t, c in hit.items()) * len(hit)

    scores = [score(p) for p in lowered]
    chosen: set[int] = set()
    used = len(SELECTED_NOTE) + 2
    values_budget = int(budget_chars * SELECT_VALUES_SHARE)
    budget_chars -= values_budget
    for i in sorted(range(n), key=lambda k: scores[k], reverse=True):
        if scores[i] <= 0:
            break
        for j in range(i - SELECT_NEIGHBORS, i + SELECT_NEIGHBORS + 1):
            if 0 <= j < n and j not in chosen:
                cost = len(pieces[j][1]) + len(pieces[j][0]) + 8
                if used + cost > budget_chars:
                    continue
                chosen.add(j)
                used += cost
    if not chosen:
        return fit_to_budget(text, budget_chars)
    out, last_name, last_idx = [SELECTED_NOTE], None, -2
    for i in sorted(chosen):
        name, piece = pieces[i]
        if name != last_name:
            out.append(f"【{name}】（節錄）")
            last_name = name
        elif i != last_idx + 1:
            out.append("……")
        out.append(piece)
        last_idx = i
    values = _value_lines(text, [pieces[i][1] for i in sorted(chosen)], values_budget)
    if values:
        out += [VALUES_NOTE, *values]
    return "\n".join(out), True


def _value_lines(text: str, chosen: list[str], budget: int) -> list[str]:
    """挑中的段落引用了、但本身沒寫出數值的 CSS 變數：從整份檔案找出定義那一行（數值才問得到）"""
    shown = "\n".join(chosen)
    defined_here = set(_VAR_DEF.findall(shown))
    wanted = [v for v in dict.fromkeys(_VAR_REF.findall(shown)) if v not in defined_here]
    if not wanted:
        return []
    where: dict[str, str] = {}
    for line in text.split("\n"):
        for name in _VAR_DEF.findall(line):
            where.setdefault(name, line.strip()[:SELECT_VALUE_LINE_CHARS])
    out: list[str] = []
    used = len(VALUES_NOTE) + 1
    for name in wanted:
        line = where.get(name)
        if not line or line in out or used + len(line) + 1 > budget:
            continue
        out.append(line)
        used += len(line) + 1
    return out


def fit_to_budget(text: str, budget_chars: int) -> tuple[str, bool]:
    """
    附加內容塞不進模型這一次能讀的長度時，只留前面能放得下的部分並註明省略。
    回（文字, 有沒有截掉）。budget 以字元計（和 llm_service 一樣保守估計：1 字元約 1 個詞元）
    """
    if len(text) <= budget_chars:
        return text, False
    keep = max(0, budget_chars - len(TRUNCATED_NOTE))
    return text[:keep] + TRUNCATED_NOTE, True


def consume(conversation_id: str) -> tuple[str, list[str]] | None:
    """這個對話有沒有剛附上、還沒用掉的內容；有的話回（文字, 檔名清單）並清掉。只用一次。"""
    with _store.lock:
        _sweep_locked()
        pending = _store.items.pop(conversation_id, None)
    return (pending.text, pending.files) if pending else None


def discard(conversation_id: str) -> None:
    """使用者按「取消附加」、或這則訊息送到一半失敗：主動清掉，不用等過期"""
    with _store.lock:
        _store.items.pop(conversation_id, None)


def pending_summary(conversation_id: str) -> dict | None:
    """查詢用（不消耗）：前端重新整理頁面後，看這個對話還有沒有等著送出的附加內容"""
    with _store.lock:
        _sweep_locked()
        pending = _store.items.get(conversation_id)
        if pending is None:
            return None
        return {"files": list(pending.files), "chars": len(pending.text), "expires_in_sec": max(0, int(pending.expires_at - time.time()))}
