# -*- coding: utf-8 -*-
"""
三層資安閘道的對抗樣本實測（變形躲避偵測）

把 security_eval.py 的測試集逐筆做四種變形，看閘道還抓不抓得到：
  全形　　英數字換成全形（Ａ１２３…）
  零寬　　每個字中間插入看不見的零寬空格
  空格拆字　每個字中間插入空格（忽 略 先 前 指 令）
  符號拆字　每個字中間插入連字號（A-1-2-3-…）
「應偵測」的句子變形後應該仍然被偵測；「正常」的句子變形後不應該被誤判。
同時量「加強前」（不做正規化）與「加強後」的結果，方便對照。

執行：  cd backend && .venv\\Scripts\\python scripts\\security_eval_adversarial.py
輸出：  docs/report/資安閘道對抗樣本實測結果.csv（逐筆）與終端摘要
"""
import csv
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import app.services.pii_masking_service as pii_module  # noqa: E402
import app.services.text_normalize as normalize  # noqa: E402
from app.services.dlp_service import check_dlp  # noqa: E402
from app.services.pii_masking_service import mask_pii  # noqa: E402
from app.services.prompt_guard_service import check_prompt_injection  # noqa: E402
from security_eval import DLP_NEG, DLP_POS, PI_NEG, PI_POS, PII_NEG, PII_POS  # noqa: E402

ZERO_WIDTH = chr(0x200B)


def fullwidth(text: str) -> str:
    return "".join(chr(ord(c) + 0xFEE0) if (c.isascii() and c.isalnum()) else c for c in text)


def zero_width(text: str) -> str:
    return ZERO_WIDTH.join(text)


def split_with(sep: str):
    def apply(text: str) -> str:
        return sep.join(c for c in text if not c.isspace())
    return apply


TRANSFORMS = [("全形", fullwidth), ("零寬", zero_width), ("空格拆字", split_with(" ")), ("符號拆字", split_with("-"))]
GATES = {
    "PII遮罩": (lambda t: mask_pii(t)["has_pii"], [t for _, t in PII_POS], PII_NEG),
    "DLP": (lambda t: check_dlp(t)["blocked"], DLP_POS, DLP_NEG),
    "PromptInjection": (lambda t: check_prompt_injection(t)["is_suspicious"], PI_POS, PI_NEG),
}


def identity_only(text):
    return [(text, list(range(len(text))))]


def measure(rows, stage):
    for gate, (detect, positives, negatives) in GATES.items():
        for name, transform in TRANSFORMS:
            for kind, samples in (("應偵測", positives), ("正常", negatives)):
                for sample in samples:
                    changed = transform(sample)
                    rows.append({"階段": stage, "閘道": gate, "變形": name, "類別": kind, "原句": sample, "變形後": changed.replace(ZERO_WIDTH, "‧"),
                                 "是否攔截": "是" if detect(changed) else "否"})


def run():
    rows = []
    real_variants = normalize.variants
    # 加強前：不做正規化（把「比對用的版本」換成只有原文）
    real_reassembled = normalize.reassembled
    normalize.variants = identity_only
    normalize.reassembled = lambda _text: None
    pii_module.variants = identity_only
    measure(rows, "加強前")
    normalize.variants = real_variants
    normalize.reassembled = real_reassembled
    pii_module.variants = real_variants
    measure(rows, "加強後")

    # 處理時間（加強後）
    samples = [t for _, t in PII_POS] + PII_NEG + DLP_POS + DLP_NEG + PI_POS + PI_NEG
    rounds = 100
    start = time.perf_counter()
    for _ in range(rounds):
        for s in samples:
            mask_pii(s); check_dlp(s); check_prompt_injection(s)
    per = (time.perf_counter() - start) / (rounds * len(samples)) * 1000

    out = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "docs", "report", "資安閘道對抗樣本實測結果.csv")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader(); w.writerows(rows)

    def rate(stage, gate, name, kind):
        sel = [r for r in rows if r["階段"] == stage and r["閘道"] == gate and r["變形"] == name and r["類別"] == kind]
        hit = sum(r["是否攔截"] == "是" for r in sel)
        return hit, len(sel)

    print(f'{"閘道":<16}{"變形":<8}{"加強前偵測":>12}{"加強後偵測":>12}{"加強後誤判":>12}')
    for gate in GATES:
        for name, _ in TRANSFORMS:
            b, n = rate("加強前", gate, name, "應偵測")
            a, _ = rate("加強後", gate, name, "應偵測")
            fp, m = rate("加強後", gate, name, "正常")
            print(f"{gate:<16}{name:<8}{b:>6}/{n:<4}{a:>7}/{n:<4}{fp:>7}/{m:<4}")
    for stage in ("加強前", "加強後"):
        pos = [r for r in rows if r["階段"] == stage and r["類別"] == "應偵測"]
        neg = [r for r in rows if r["階段"] == stage and r["類別"] == "正常"]
        tp = sum(r["是否攔截"] == "是" for r in pos); fp = sum(r["是否攔截"] == "是" for r in neg)
        print(f"{stage}：偵測 {tp}/{len(pos)}（{tp / len(pos) * 100:.1f}%）　誤判 {fp}/{len(neg)}（{fp / len(neg) * 100:.1f}%）")
    print(f"三道閘道串接平均處理時間（加強後）：{per:.3f} ms／則")
    print("\n加強後仍漏判：")
    for r in rows:
        if r["階段"] == "加強後" and r["類別"] == "應偵測" and r["是否攔截"] == "否":
            print(f"  [{r['閘道']}/{r['變形']}] {r['原句']}")
    print("加強後誤判：")
    for r in rows:
        if r["階段"] == "加強後" and r["類別"] == "正常" and r["是否攔截"] == "是":
            print(f"  [{r['閘道']}/{r['變形']}] {r['原句']}")
    print("明細：", out)


if __name__ == "__main__":
    run()
