# -*- coding: utf-8 -*-
"""
跑紅隊測試並整理結果（promptfoo 0.126.0，MIT）

  python security/redteam/run.py

1. 用 npx 執行 promptfoo（第一次會下載到 npm 快取，之後離線可跑；遙測與更新檢查全部關閉）
2. 讀 promptfoo 的結果，依類別算攔截率（攻擊題）與誤擋率（正常題）
3. 逐題結果存到 docs/report/紅隊測試結果.csv
"""
import csv
import json
import os
import subprocess
import sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT_JSON = os.path.join(HERE, "results.json")
OUT_CSV = os.path.join(ROOT, "docs", "report", "紅隊測試結果.csv")
VERSION = "0.126.0"


def run_promptfoo() -> None:
    env = dict(os.environ)
    # 全部離線：不送使用數據、不檢查新版、不連 promptfoo 的雲端
    env.update(PROMPTFOO_DISABLE_TELEMETRY="1", PROMPTFOO_DISABLE_UPDATE="1",
               PROMPTFOO_DISABLE_SHARING="1", PROMPTFOO_DISABLE_REMOTE_GENERATION="1",
               PYTHONIOENCODING="utf-8")
    npx = "npx.cmd" if os.name == "nt" else "npx"
    cmd = [npx, "-y", f"promptfoo@{VERSION}", "eval", "-c", "promptfooconfig.yaml",
           "-o", OUT_JSON, "--no-cache", "--no-progress-bar"]
    subprocess.run(cmd, cwd=HERE, env=env, check=False)


def _verdict(output: str) -> str:
    """閘道回應的開頭 → 攔阻／放行／錯誤"""
    if output.startswith("[攔阻]"):
        return "攔阻"
    if output.startswith("[放行]"):
        return "放行"
    return "錯誤"


def _row(r: dict) -> dict:
    """promptfoo 的一筆結果 → 報告的一列"""
    case = r.get("testCase") or {}
    meta = case.get("metadata") or r.get("metadata") or {}
    prompt = (r.get("vars") or {}).get("prompt") or case.get("vars", {}).get("prompt", "")
    response = r.get("response") or {}
    output = str(response.get("output") or response.get("error") or "")
    return {
        "類別": meta.get("category", ""),
        "種類": "攻擊" if meta.get("kind") == "attack" else "正常",
        "題目": prompt,
        "結果": _verdict(output),
        "符合預期": bool(r.get("success")),
        "閘道回應": output[:200],
    }


def _print_list(title: str, items: list[str]) -> None:
    if items:
        print(title)
        for m in items:
            print("  ", m)


def _print_summary(rows: list[dict]) -> None:
    atk = [r for r in rows if r["種類"] == "攻擊"]
    nor = [r for r in rows if r["種類"] == "正常"]
    by_cat = defaultdict(lambda: [0, 0])
    for r in atk:
        by_cat[r["類別"]][0] += r["結果"] == "攔阻"
        by_cat[r["類別"]][1] += 1
    blocked = sum(r["結果"] == "攔阻" for r in atk)
    wrong = sum(r["結果"] != "放行" for r in nor)
    print()
    print(f"攻擊 {len(atk)} 題：攔下 {blocked}（{blocked / max(1, len(atk)):.1%}）")
    for cat, (ok, n) in sorted(by_cat.items()):
        print(f"  {cat}：{ok}/{n}")
    print(f"正常 {len(nor)} 題：誤擋 {wrong}（{wrong / max(1, len(nor)):.1%}）")
    _print_list("沒擋下的攻擊：", [r["題目"] for r in atk if r["結果"] != "攔阻"])
    _print_list("被誤擋的正常提問：", [r["題目"] for r in nor if r["結果"] != "放行"])


def summarize() -> None:
    with open(OUT_JSON, encoding="utf-8") as f:
        data = json.load(f)
    rows = [_row(r) for r in data.get("results", {}).get("results", [])]
    _print_summary(rows)
    os.makedirs(os.path.dirname(OUT_CSV), exist_ok=True)
    with open(OUT_CSV, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    print(f"明細：{OUT_CSV}")


if __name__ == "__main__":
    if "--summary-only" not in sys.argv:
        run_promptfoo()
    summarize()
