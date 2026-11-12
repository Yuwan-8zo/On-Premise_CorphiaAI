"""
本機模型評估：同一套題目跑每個模型，量速度、正體中文品質、用工具處理檔案的能力
================================================================================

引擎：專案根目錄 engine/llama-vulkan/llama-server.exe（llama.cpp 官方 Windows Vulkan 版，用 Arc 顯示晶片）
每個模型依序：啟動 llama-server → 跑三組測試 → 關掉 → 下一個（一次只佔一個模型的記憶體）

  1. 長文件：約 6 千字員工手冊＋一個藏在中間的問題 → 讀入速度、第一個字要等多久、打字速度、有沒有找對答案
  2. 正體中文：eval_data.ZH_QUESTIONS（有標準答案的自動判對錯；全部答案另存給人看）
     另外數「簡體字」：用 OpenCC 把每個字轉成正體，會變的就算簡體（少數兩岸通用字排除）
  3. 工具：eval_data.TOOL_TASKS，模型可呼叫 列檔／讀檔／寫檔／跑 Python，在各自的測試資料夾裡做事，做完自動檢查

結果：backend/scripts/model_eval/out/
  summary.md          總表（每個模型一列）
  <模型>.json         所有原始數據
  <模型>_answers.md   所有回答全文（人工評分用）

用法（從 backend/ 目錄）：
  .venv\\Scripts\\python.exe scripts\\model_eval\\run_eval.py                       # 全部模型
  .venv\\Scripts\\python.exe scripts\\model_eval\\run_eval.py --models gpt-oss-20b   # 指定模型（逗號分隔）
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path

import httpx
import psutil
from docx import Document
from openpyxl import load_workbook

sys.path.insert(0, str(Path(__file__).resolve().parent))
from eval_data import TOOL_TASKS, ZH_QUESTIONS, build_workspace, long_doc  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
ENGINE = ROOT / "engine" / "llama-vulkan" / "llama-server.exe"
MODEL_DIR = ROOT / "ai_model"
OUT = Path(__file__).resolve().parent / "out"
PORT = 8190
BASE = f"http://127.0.0.1:{PORT}"

# 候選模型：名稱 → 檔名
MODELS = {
    "qwen2.5-7b": "Qwen2.5-7B-Instruct-Q5_K_M.gguf",
    "qwen2.5-14b": "Qwen2.5-14B-Instruct-Q5_K_M.gguf",
    "breeze2-8b": "Llama-Breeze2-8B-Instruct-Text.Q5_K_M.gguf",
    "gpt-oss-20b": "gpt-oss-20b-MXFP4.gguf",
    "qwen3.6-35b-a3b": "Qwen_Qwen3.6-35B-A3B-Q4_K_M.gguf",
}
CTX = 16384
# 模型檔之外還要留的記憶體（對話記憶、引擎本身、系統）
MEM_HEADROOM_GB = 3.0
TEMPERATURE = 0.3
MAX_TOOL_STEPS = 10

SYSTEM_ZH = "你是企業內部的 AI 助理。一律使用台灣正體中文回答，不可使用簡體字；回答精確、有條理。"
SYSTEM_TOOLS = (
    SYSTEM_ZH + "你可以使用工具操作「工作資料夾」裡的檔案（路徑直接寫檔名）。"
    "需要資料時先用工具讀取，需要計算時用 run_python 跑程式，不要用猜的。完成後用一兩句話回報結果。"
)

# ── 簡體字偵測 ────────────────────────────────────────────────────────────────────
# 兩岸都在用、OpenCC 會「轉」但正體中文本來就會出現的字，不算簡體
_BOTH_OK = set("后里台才只干面系制准余冲志卷了么着周向范松游注征表采丑出谷斗几价云")
try:
    import opencc

    _cc = None
    for cfg in ("s2tw", "s2tw.json", "s2t", "s2t.json"):
        try:
            _cc = opencc.OpenCC(cfg)
            break
        except Exception:
            continue
except ImportError:
    _cc = None


def simplified_chars(text: str) -> list[str]:
    if not _cc:
        return []
    return [c for c in text if "一" <= c <= "鿿" and c not in _BOTH_OK and _cc.convert(c) != c]


# ── 工具（模型可以呼叫的） ────────────────────────────────────────────────────────
TOOLS = [
    {"type": "function", "function": {"name": "list_files", "description": "列出工作資料夾裡的所有檔案", "parameters": {"type": "object", "properties": {}}}},
    {"type": "function", "function": {"name": "read_file", "description": "讀取檔案內容（支援 .xlsx .docx .csv .txt .md）", "parameters": {"type": "object", "properties": {"path": {"type": "string", "description": "檔名"}}, "required": ["path"]}}},
    {"type": "function", "function": {"name": "write_file", "description": "建立或覆寫一個文字檔", "parameters": {"type": "object", "properties": {"path": {"type": "string"}, "content": {"type": "string"}}, "required": ["path", "content"]}}},
    {"type": "function", "function": {"name": "run_python", "description": "在工作資料夾裡執行 Python 程式，回傳印出的結果。可用 csv、openpyxl（讀 .xlsx）、python-docx（import docx，讀 .docx）、statistics、re；沒有 pandas", "parameters": {"type": "object", "properties": {"code": {"type": "string"}}, "required": ["code"]}}},
]
TOOL_OUTPUT_LIMIT = 6000
RUN_TIMEOUT_S = 60


def _safe(ws: Path, name: str) -> Path:
    p = (ws / name).resolve()
    if ws.resolve() not in p.parents and p != ws.resolve():
        raise ValueError("只能存取工作資料夾裡的檔案")
    return p


def run_tool(ws: Path, name: str, args: dict) -> str:
    try:
        if name == "list_files":
            return "\n".join(sorted(p.name for p in ws.iterdir() if p.is_file() and not p.name.startswith("_")))
        if name == "read_file":
            p = _safe(ws, args["path"])
            if p.suffix == ".xlsx":
                wb = load_workbook(p, data_only=True)
                return "\n".join("\t".join("" if v is None else str(v) for v in row) for ws_ in wb for row in ws_.iter_rows(values_only=True))[:TOOL_OUTPUT_LIMIT]
            if p.suffix == ".docx":
                return "\n".join(par.text for par in Document(p).paragraphs)[:TOOL_OUTPUT_LIMIT]
            return p.read_text(encoding="utf-8-sig", errors="ignore")[:TOOL_OUTPUT_LIMIT]
        if name == "write_file":
            _safe(ws, args["path"]).write_text(args["content"], encoding="utf-8")
            return "已寫入 " + args["path"]
        if name == "run_python":
            f = ws / "_run.py"
            f.write_text(args["code"], encoding="utf-8")
            r = subprocess.run([sys.executable, "-I", f.name], cwd=ws, capture_output=True, text=True, encoding="utf-8", errors="ignore", timeout=RUN_TIMEOUT_S)
            return ((r.stdout or "") + (r.stderr or ""))[:TOOL_OUTPUT_LIMIT] or "（沒有輸出）"
        return f"沒有這個工具：{name}"
    except Exception as e:  # 工具出錯也回給模型，看它會不會自己修正
        return f"錯誤：{type(e).__name__}: {e}"


# ── 引擎 ─────────────────────────────────────────────────────────────────────────
class MemWatch:
    """背景每 0.5 秒記一次系統可用記憶體，量載入模型後最低剩多少"""

    def __init__(self):
        self.min_avail = psutil.virtual_memory().available
        self._stop = False
        threading.Thread(target=self._run, daemon=True).start()

    def _run(self):
        while not self._stop:
            self.min_avail = min(self.min_avail, psutil.virtual_memory().available)
            time.sleep(0.5)

    def stop(self) -> float:
        self._stop = True
        return self.min_avail / 1e9


def start_server(model_file: Path, log: Path) -> subprocess.Popen:
    cmd = [str(ENGINE), "-m", str(model_file), "-ngl", "99", "-c", str(CTX), "--jinja", "-fa", "auto",
           "--host", "127.0.0.1", "--port", str(PORT), "--reasoning-format", "auto", "--no-webui"]
    proc = subprocess.Popen(cmd, stdout=log.open("w", encoding="utf-8"), stderr=subprocess.STDOUT, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    t0 = time.time()
    while time.time() - t0 < 900:
        if proc.poll() is not None:
            raise RuntimeError(f"引擎啟動失敗，看 {log}")
        try:
            if httpx.get(BASE + "/health", timeout=2).status_code == 200:
                return proc
        except httpx.HTTPError:
            pass
        time.sleep(1)
    proc.kill()
    raise RuntimeError("引擎啟動逾時")


def chat(messages: list[dict], tools: list | None = None, max_tokens: int = 1536) -> tuple[dict, float]:
    body = {"messages": messages, "max_tokens": max_tokens, "temperature": TEMPERATURE}
    if tools:
        body["tools"] = tools
    t = time.time()
    r = httpx.post(BASE + "/v1/chat/completions", json=body, timeout=1800)
    r.raise_for_status()
    return r.json(), time.time() - t


def must_ok(ans: str, must) -> bool | None:
    if not must:
        return None
    a = ans.replace(" ", "")
    return any(all(k.replace(" ", "") in a for k in group) for group in must)


# ── 三組測試 ─────────────────────────────────────────────────────────────────────
def test_long_doc() -> dict:
    doc = long_doc()
    q = "根據以下員工手冊，員工到職滿一年有幾天特別休假？請直接回答天數。\n\n" + doc
    res, dt = chat([{"role": "system", "content": SYSTEM_ZH}, {"role": "user", "content": q}], max_tokens=1024)
    tm = res.get("timings", {})
    ans = res["choices"][0]["message"].get("content") or ""
    return {
        "doc_chars": len(doc), "prompt_tokens": tm.get("prompt_n"),
        "prompt_tps": round(tm.get("prompt_per_second", 0), 1), "wait_first_s": round(tm.get("prompt_ms", 0) / 1000, 1),
        "gen_tps": round(tm.get("predicted_per_second", 0), 1), "total_s": round(dt, 1),
        "answer": ans, "correct": "12" in ans or "十二" in ans,
    }


def test_zh() -> list[dict]:
    out = []
    for item in ZH_QUESTIONS:
        res, dt = chat([{"role": "system", "content": SYSTEM_ZH}, {"role": "user", "content": item["q"]}])
        msg = res["choices"][0]["message"]
        ans = msg.get("content") or ""
        tm = res.get("timings", {})
        out.append({
            "id": item["id"], "type": item["type"], "q": item["q"], "answer": ans, "correct": must_ok(ans, item["must"]),
            "simplified": "".join(simplified_chars(ans)), "think_chars": len(msg.get("reasoning_content") or ""),
            "gen_tps": round(tm.get("predicted_per_second", 0), 1), "total_s": round(dt, 1),
        })
    return out


def test_tools(work_root: Path) -> list[dict]:
    out = []
    for task in TOOL_TASKS:
        ws = build_workspace(work_root / task["id"])
        msgs: list[dict] = [{"role": "system", "content": SYSTEM_TOOLS}, {"role": "user", "content": task["q"]}]
        calls, bad, final, t0 = [], 0, "", time.time()
        for _ in range(MAX_TOOL_STEPS):
            try:
                res, _dt = chat(msgs, tools=TOOLS)
            except httpx.HTTPError as e:
                # 模型寫出格式不對的工具呼叫時，引擎會回 500：這一題算失敗（記下原因），不要讓整個評估中斷
                bad += 1
                final = f"[引擎拒絕模型的輸出：{str(e)[:120]}]"
                break
            msg = res["choices"][0]["message"]
            tcs = msg.get("tool_calls") or []
            if not tcs:
                final = msg.get("content") or ""
                break
            keep = {"role": "assistant", "content": msg.get("content") or "", "tool_calls": tcs}
            if msg.get("reasoning_content"):
                keep["reasoning_content"] = msg["reasoning_content"]
            msgs.append(keep)
            for tc in tcs:
                fn = tc["function"]["name"]
                try:
                    args = json.loads(tc["function"].get("arguments") or "{}")
                except json.JSONDecodeError:
                    args, bad = {}, bad + 1
                result = run_tool(ws, fn, args)
                calls.append({"tool": fn, "args": {k: (v[:200] if isinstance(v, str) else v) for k, v in args.items()}, "result": result[:300]})
                msgs.append({"role": "tool", "tool_call_id": tc.get("id", ""), "content": result})
        ok = bool(task["check"](ws, final))
        out.append({"id": task["id"], "q": task["q"], "ok": ok, "steps": len(calls), "bad_args": bad, "total_s": round(time.time() - t0, 1), "final": final, "calls": calls})
    return out


# ── 主程式 ───────────────────────────────────────────────────────────────────────
def eval_model(name: str, fname: str) -> dict | None:
    path = MODEL_DIR / fname
    if not path.exists():
        print(f"[略過] {name}：找不到 {fname}")
        return None
    size_gb = path.stat().st_size / 1e9
    avail = psutil.virtual_memory().available / 1e9
    if avail < size_gb + MEM_HEADROOM_GB:
        print(f"[略過] {name}：需要約 {size_gb + MEM_HEADROOM_GB:.1f} GB 記憶體，現在只剩 {avail:.1f} GB（請先關閉後端或其他程式）")
        return {"model": name, "skipped": f"記憶體不足：需 {size_gb + MEM_HEADROOM_GB:.1f} GB、剩 {avail:.1f} GB"}
    print(f"\n=== {name}（{size_gb:.1f} GB）")
    watch = MemWatch()
    t = time.time()
    proc = start_server(path, OUT / f"{name}_server.log")
    load_s = time.time() - t
    try:
        print("  長文件…")
        ld = test_long_doc()
        print(f"    讀入 {ld['prompt_tps']} tok/s、等 {ld['wait_first_s']} 秒、打字 {ld['gen_tps']} tok/s、{'對' if ld['correct'] else '錯'}")
        print("  正體中文…")
        zh = test_zh()
        print("  工具…")
        with tempfile.TemporaryDirectory(prefix=f"eval_{name}_") as tmp:
            tools = test_tools(Path(tmp))
    finally:
        proc.terminate()
        try:
            proc.wait(30)
        except subprocess.TimeoutExpired:
            proc.kill()
    min_avail = watch.stop()
    objective = [z for z in zh if z["correct"] is not None]
    result = {
        "model": name, "file": fname, "size_gb": round(size_gb, 2), "load_s": round(load_s, 1),
        "min_avail_gb": round(min_avail, 1), "long_doc": ld, "zh": zh, "tools": tools,
        "zh_correct": sum(1 for z in objective if z["correct"]), "zh_objective": len(objective),
        "simplified_total": sum(len(z["simplified"]) for z in zh),
        "zh_gen_tps": round(sum(z["gen_tps"] for z in zh) / len(zh), 1), "zh_avg_s": round(sum(z["total_s"] for z in zh) / len(zh), 1),
        "tools_ok": sum(1 for x in tools if x["ok"]), "tools_n": len(tools),
    }
    (OUT / f"{name}.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    write_answers(result)
    print(f"  完成：中文 {result['zh_correct']}/{result['zh_objective']}、簡體字 {result['simplified_total']}、工具 {result['tools_ok']}/{result['tools_n']}")
    return result


def write_answers(r: dict):
    lines = [f"# {r['model']} 全部回答\n", f"## 長文件（{r['long_doc']['doc_chars']} 字）\n", r["long_doc"]["answer"], "\n## 正體中文\n"]
    for z in r["zh"]:
        mark = "" if z["correct"] is None else ("✅" if z["correct"] else "❌")
        lines += [f"### {z['id']}（{z['type']}）{mark}  {z['total_s']} 秒", f"**問**：{z['q']}\n", z["answer"], f"\n簡體字：{z['simplified'] or '無'}\n"]
    lines.append("## 工具\n")
    for x in r["tools"]:
        lines += [f"### {x['id']} {'✅' if x['ok'] else '❌'}  {x['steps']} 步、{x['total_s']} 秒", f"**問**：{x['q']}\n"]
        lines += [f"- `{c['tool']}` {json.dumps(c['args'], ensure_ascii=False)[:160]}" for c in x["calls"]]
        lines += ["", f"**最後回答**：{x['final']}\n"]
    (OUT / f"{r['model']}_answers.md").write_text("\n".join(lines), encoding="utf-8")


def write_summary():
    rows = []
    for name in MODELS:
        f = OUT / f"{name}.json"
        if f.exists():
            rows.append(json.loads(f.read_text(encoding="utf-8")))
    head = "| 模型 | 大小 GB | 載入秒 | 最低剩餘記憶體 GB | 讀入 tok/s | 長文件等待秒 | 打字 tok/s | 長文件找答案 | 中文客觀題 | 簡體字數 | 中文平均秒 | 工具完成 |\n|---|---|---|---|---|---|---|---|---|---|---|---|"
    body = []
    for r in rows:
        if r.get("skipped"):
            body.append(f"| {r['model']} | {r['skipped']} |" + " |" * 10)
            continue
        ld = r["long_doc"]
        body.append(f"| {r['model']} | {r['size_gb']} | {r['load_s']} | {r['min_avail_gb']} | {ld['prompt_tps']} | {ld['wait_first_s']} | {r['zh_gen_tps']} | {'對' if ld['correct'] else '錯'} | {r['zh_correct']}/{r['zh_objective']} | {r['simplified_total']} | {r['zh_avg_s']} | {r['tools_ok']}/{r['tools_n']} |")
    (OUT / "summary.md").write_text("# 本機模型評估總表\n\n" + head + "\n" + "\n".join(body) + "\n", encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", default=",".join(MODELS))
    a = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    for name in a.models.split(","):
        r = eval_model(name.strip(), MODELS[name.strip()])
        if r and r.get("skipped"):
            (OUT / f"{name.strip()}.json").write_text(json.dumps(r, ensure_ascii=False), encoding="utf-8")
        write_summary()
    print("\n總表：", OUT / "summary.md")


if __name__ == "__main__":
    main()
