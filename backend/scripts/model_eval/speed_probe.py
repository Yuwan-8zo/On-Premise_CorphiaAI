"""
加速實驗：同一個模型、不同設定，量「等第一個字」和「打字速度」
================================================================
每個設定各啟動一次引擎，問同樣的幾題（兩輪對話＋一題帶長文件），結果寫到 out/speed_<名稱>.json 與 out/speed.md

  .venv\Scripts\python.exe scripts\model_eval\speed_probe.py --model gpt-oss-20b
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent))
from eval_data import long_doc  # noqa: E402
from run_eval import ENGINE, MODEL_DIR, MODELS, OUT  # noqa: E402

PORT = 8191
BASE = f"http://127.0.0.1:{PORT}"
SYSTEM = "你是企業內部的 AI 助理，一律用台灣正體中文回答，回答要精簡。"
Q1 = "請用三句話說明什麼是資料外洩防護（DLP）。"
Q2 = "那中小企業導入時，最先該做的一件事是什麼？一句話回答。"


def start(model: Path, extra: list[str], log: Path) -> subprocess.Popen:
    cmd = [str(ENGINE), "-m", str(model), "-ngl", "99", "-c", "16384", "--jinja", "-fa", "auto",
           "--host", "127.0.0.1", "--port", str(PORT), "--reasoning-format", "auto", "--no-webui", *extra]
    proc = subprocess.Popen(cmd, stdout=log.open("w", encoding="utf-8"), stderr=subprocess.STDOUT,
                            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
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


def ask(messages: list[dict], body_extra: dict) -> dict:
    """串流問一題：回 等第一個「思考或回答」的字、等第一個「回答」的字、總時間、引擎回報的速度"""
    body = {"messages": messages, "max_tokens": 600, "temperature": 0.3, "stream": True, **body_extra}
    t0 = time.perf_counter()
    first_any = first_answer = None
    answer, reasoning_chars, timings = "", 0, {}
    with httpx.stream("POST", BASE + "/v1/chat/completions", json=body, timeout=600) as r:
        for line in r.iter_lines():
            if not line.startswith("data:") or line[5:].strip() == "[DONE]":
                continue
            chunk = json.loads(line[5:])
            timings = chunk.get("timings") or timings
            delta = (chunk.get("choices") or [{}])[0].get("delta") or {}
            if delta.get("reasoning_content"):
                reasoning_chars += len(delta["reasoning_content"])
                first_any = first_any or time.perf_counter() - t0
            if delta.get("content"):
                first_any = first_any or time.perf_counter() - t0
                first_answer = first_answer or time.perf_counter() - t0
                answer += delta["content"]
    return {
        "first_any_s": round(first_any or 0, 2), "first_answer_s": round(first_answer or 0, 2),
        "total_s": round(time.perf_counter() - t0, 2), "answer_chars": len(answer), "reasoning_chars": reasoning_chars,
        "prompt_n": timings.get("prompt_n"), "cache_n": timings.get("cache_n"),
        "prompt_tps": round(timings.get("prompt_per_second") or 0, 1), "gen_tps": round(timings.get("predicted_per_second") or 0, 1),
        "answer": answer[:160],
    }


def run_config(name: str, model: Path, server_extra: list[str], body_extra: dict) -> dict:
    proc = start(model, server_extra, OUT / f"speed_{name}_server.log")
    try:
        ask([{"role": "user", "content": "說「好」"}], body_extra)  # 暖機：第一次會多花時間，不列入比較
        doc, question = long_doc(), "根據上面的員工手冊，員工到職滿一年有幾天特別休假？請直接回答天數。"
        base = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": Q1}]
        turn1 = ask(base, body_extra)
        # 第二輪：前面的內容完全相同，只多一輪 → 引擎有重複利用已讀內容的話，prompt 只需要讀新增的部分
        turn2 = ask(base + [{"role": "assistant", "content": turn1["answer"]}, {"role": "user", "content": Q2}], body_extra)
        long_q = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": f"{doc}\n\n問題：{question}"}]
        long1 = ask(long_q, body_extra)
        long2 = ask(long_q + [{"role": "assistant", "content": long1["answer"]}, {"role": "user", "content": "請再用一句話重述重點。"}], body_extra)
        return {"name": name, "turn1": turn1, "turn2": turn2, "long1": long1, "long2": long2}
    finally:
        proc.terminate()
        try:
            proc.wait(30)
        except subprocess.TimeoutExpired:
            proc.kill()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="gpt-oss-20b")
    ap.add_argument("--configs", default="base,effort-low,no-cache")
    a = ap.parse_args()
    model = MODEL_DIR / MODELS[a.model]
    configs = {
        "base": ([], {}),
        # 思考少一點：會推理的模型（gpt-oss）可以調思考的深度
        "effort-low": ([], {"reasoning_effort": "low", "chat_template_kwargs": {"reasoning_effort": "low"}}),
        # 對照組：關掉「重複利用已讀內容」，看它平常到底省了多少
        "no-cache": (["--no-cache-prompt"], {"cache_prompt": False}),
        # 小模型打草稿（只有和草稿模型同一個家族才能用）
        "draft-3b": (["-md", str(MODEL_DIR / "Qwen2.5-3B-Instruct-Q5_K_M.gguf"), "-ngld", "99"], {}),
    }
    rows = []
    for name in a.configs.split(","):
        print(f"=== {a.model} / {name}", flush=True)
        r = run_config(f"{a.model}_{name}", model, *configs[name])
        (OUT / f"speed_{a.model}_{name}.json").write_text(json.dumps(r, ensure_ascii=False, indent=2), encoding="utf-8")
        rows.append(r)
        for k in ("turn1", "turn2", "long1", "long2"):
            x = r[k]
            print(f"  {k}: 等回答 {x['first_answer_s']} 秒（等第一個字 {x['first_any_s']}）、共 {x['total_s']} 秒、打字 {x['gen_tps']} tok/s、"
                  f"讀入 {x['prompt_n']} tok（重複利用 {x['cache_n']}）、思考 {x['reasoning_chars']} 字、回答 {x['answer_chars']} 字", flush=True)
    lines = ["# 加速實驗", "", "| 設定 | 題目 | 等回答秒 | 總秒 | 打字 tok/s | 新讀入 tok | 重複利用 tok | 思考字數 |", "|---|---|---|---|---|---|---|---|"]
    for r in rows:
        for k in ("turn1", "turn2", "long1", "long2"):
            x = r[k]
            lines.append(f"| {r['name']} | {k} | {x['first_answer_s']} | {x['total_s']} | {x['gen_tps']} | {x['prompt_n']} | {x['cache_n']} | {x['reasoning_chars']} |")
    path = OUT / f"speed_{a.model}.md"
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n結果：", path)


if __name__ == "__main__":
    main()
