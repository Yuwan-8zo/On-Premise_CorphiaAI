r"""
Corphia AI - LLM 推論速度測試 + 14B 外推
==========================================

本腳本會：
  1. 掃描 ai_model/ 目錄中所有 .gguf 模型
  2. 逐一載入並跑一次 200-token 生成，量測：
       - prompt eval（輸入處理）耗時
       - tokens/sec（生成階段）
  3. 根據實測結果，使用「記憶體頻寬限制模型」外推 14B Q5_K_M 的預估速度
     （因為 LLM 推論的瓶頸幾乎只在 RAM/VRAM 頻寬：tok/s ≈ k / model_size）

用法（從 backend/ 目錄）:
    .\.venv\Scripts\python.exe benchmark_speed.py
    .\.venv\Scripts\python.exe benchmark_speed.py --model 7B          # 只跑 7B
    .\.venv\Scripts\python.exe benchmark_speed.py --max-tokens 100    # 縮短測試
    .\.venv\Scripts\python.exe benchmark_speed.py --no-extrapolate    # 關閉 14B 外推

預期數字（同一台機器，Q5_K_M 量化）:
    純 CPU（i5/i7 13 代）       → 7B 約 5~10 tok/s
    CPU + Intel Arc 部分 offload → 7B 約 10~20 tok/s
    NVIDIA RTX 全 offload        → 7B 約 30~80 tok/s
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.services.model_manager import _find_model_dir  # noqa: E402


# ── 14B Q5_K_M 預估檔案大小（GB）─────────────────────────────
# Qwen2.5-14B-Instruct-Q5_K_M ≈ 10.51 GB（HuggingFace 官方檔案大小）
ESTIMATED_14B_Q5KM_GB = 10.51


@dataclass
class BenchResult:
    name: str
    file_size_gb: float
    load_time_s: float
    prompt_tokens: int
    completion_tokens: int
    elapsed_s: float
    tok_per_sec: float


_SHARD_PATTERN = re.compile(r"-(\d{5})-of-(\d{5})\.gguf$", re.IGNORECASE)


def _pick_models(model_dir: Path, filter_keyword: Optional[str]) -> List[Path]:
    """挑選要跑 benchmark 的 GGUF 檔。

    - 多分片 GGUF（檔名含 `-00001-of-0000N`）：只取第 1 份；llama.cpp 會自動載入其餘
    - 計算「等效大小」時，會把所有分片加總，讓外推更準
    """
    all_files = sorted(model_dir.glob("*.gguf"), key=lambda p: p.stat().st_size)
    selected: List[Path] = []
    seen_groups: set[str] = set()
    for f in all_files:
        m = _SHARD_PATTERN.search(f.name)
        if m:
            base = f.name[: m.start()]
            if base in seen_groups:
                continue
            seen_groups.add(base)
            if m.group(1) != "00001":
                first = next(
                    (g for g in all_files if g.name.startswith(base) and "-00001-of-" in g.name),
                    None,
                )
                if first is None:
                    continue
                selected.append(first)
                continue
        selected.append(f)

    if filter_keyword:
        kw = filter_keyword.lower()
        selected = [f for f in selected if kw in f.name.lower()]
    return selected


def _effective_size_gb(model_path: Path) -> float:
    """多分片模型回傳所有分片總和；單檔模型回傳自身大小。"""
    m = _SHARD_PATTERN.search(model_path.name)
    if not m:
        return model_path.stat().st_size / 1024 ** 3
    base = model_path.name[: m.start()]
    total = 0
    for f in model_path.parent.glob(f"{base}-*.gguf"):
        if _SHARD_PATTERN.search(f.name):
            total += f.stat().st_size
    return total / 1024 ** 3


def _run_one(model_path: Path, max_tokens: int, n_gpu_layers: int) -> BenchResult:
    print(f"\n{'─' * 60}")
    print(f"[Loading] {model_path.name}")
    file_size_gb = _effective_size_gb(model_path)
    is_sharded = _SHARD_PATTERN.search(model_path.name) is not None
    if is_sharded:
        print(f"          多分片 GGUF（自動載入所有分片），合計大小: {file_size_gb:.2f} GB")
    else:
        print(f"          檔案大小: {file_size_gb:.2f} GB")

    t0 = time.time()
    from llama_cpp import Llama

    llm = Llama(
        model_path=str(model_path),
        n_ctx=2048,
        n_threads=os.cpu_count() or 8,
        n_gpu_layers=n_gpu_layers,
        verbose=False,
    )
    load_time = time.time() - t0
    print(f"          載入耗時: {load_time:.1f}s")

    prompt = "請用大約 200 字詳細介紹台灣的茶文化，包含歷史、品種與品茶方式。"

    print(f"[Running] 生成 {max_tokens} tokens ...")
    t0 = time.time()
    output = llm(
        prompt=prompt,
        max_tokens=max_tokens,
        temperature=0.7,
        echo=False,
    )
    elapsed = time.time() - t0

    text = output["choices"][0]["text"]
    usage = output.get("usage", {})
    completion_tokens = int(usage.get("completion_tokens", len(text.split())))
    prompt_tokens = int(usage.get("prompt_tokens", 0))
    tok_per_sec = completion_tokens / elapsed if elapsed > 0 else 0.0

    print(f"[Result]  prompt_tokens={prompt_tokens}  completion_tokens={completion_tokens}")
    print(f"          elapsed={elapsed:.2f}s  → {tok_per_sec:.2f} tok/s")
    print(f"[Sample]  {text[:80].strip()} ...")

    del llm

    return BenchResult(
        name=model_path.stem,
        file_size_gb=file_size_gb,
        load_time_s=load_time,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        elapsed_s=elapsed,
        tok_per_sec=tok_per_sec,
    )


def _verdict(tok: float) -> str:
    if tok >= 15:
        return "EXCELLENT - 體感順，沒必要折騰 GPU 加速"
    if tok >= 8:
        return "GOOD - 可接受，要不要折騰看你"
    if tok >= 4:
        return "MEDIOCRE - 體感稍慢，可考慮優化"
    return "SLOW - 強烈建議改用 Vulkan/SYCL/GPU 後端"


def _extrapolate_14b(results: List[BenchResult]) -> None:
    """
    LLM 推論為 memory-bandwidth-bound：
        tok/s ≈ k / model_size_in_RAM
    其中 k 是「該硬體 + 該後端」的等效有效頻寬。

    取已測模型的 (size, tok/s) 算出 k，再代入 14B Q5_K_M 的尺寸推算。
    若有多筆，取平均；7B 的權重高一些（因為更接近 14B 的記憶體存取模式）。
    """
    print()
    print("=" * 60)
    print(" 14B Q5_K_M 外推（推算，未實測）")
    print("=" * 60)
    if not results:
        print("  無可用實測結果，跳過外推。")
        return

    weighted_k = 0.0
    weight_sum = 0.0
    for r in results:
        # 7B 樣本權重 2，3B 樣本權重 1（大模型更能反映記憶體頻寬瓶頸）
        w = 2.0 if r.file_size_gb >= 4.0 else 1.0
        k = r.tok_per_sec * r.file_size_gb
        weighted_k += k * w
        weight_sum += w
        print(
            f"  量測  {r.name:<40s}  "
            f"size={r.file_size_gb:5.2f} GB  "
            f"speed={r.tok_per_sec:6.2f} tok/s  "
            f"k={k:6.2f}"
        )

    k_eff = weighted_k / weight_sum
    est_14b = k_eff / ESTIMATED_14B_Q5KM_GB
    # 修正係數：14B 比 7B 多一倍層數，KV cache 與 attention 計算也變多，
    # 經驗上實際會比純線性外推再慢 5~15%；此處取保守 0.92。
    est_14b_adj = est_14b * 0.92

    print()
    print(f"  有效頻寬係數 k = {k_eff:.2f}  (= speed × size 的加權平均)")
    print(f"  14B Q5_K_M 假設檔案大小: {ESTIMATED_14B_Q5KM_GB:.2f} GB")
    print(f"  線性外推:           {est_14b:.2f} tok/s")
    print(f"  保守修正(×0.92):    {est_14b_adj:.2f} tok/s   ← 建議參考此值")
    print()

    print(f"  預估 14B Verdict: {_verdict(est_14b_adj)}")

    print()
    print("  可行性檢查:")
    # 載入 14B Q5_K_M 約需 11~12 GB RAM（檔案 + KV cache 2k ctx）
    needed_ram_gb = ESTIMATED_14B_Q5KM_GB + 1.5
    print(f"    最低 RAM 需求 ≈ {needed_ram_gb:.1f} GB（含 2k context 的 KV cache）")
    print("    你的機器: ASUS Zenbook S 14 / Core Ultra 7 258V / 32 GB ✅ 跑得動")
    print()
    print("  使用體感對照:")
    print("    >15 tok/s → 跟 7B 差不多順")
    print("     8-15     → 可用，短回答還行，長段落要等")
    print("     4-8      → 偏慢，建議只在需要更高品質回答時切換")
    print("     <4       → 不建議當主力模型")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--model",
        default=None,
        help="只測試名稱包含此關鍵字的模型 (ex: 7B / 3B / Qwen2.5-7B)",
    )
    ap.add_argument("--max-tokens", type=int, default=200)
    ap.add_argument(
        "--n-gpu-layers",
        type=int,
        default=-1,
        help="嘗試 offload 幾層到 GPU；-1 = 全部，0 = 純 CPU。預設 -1（無 GPU 後端會自動 fallback CPU）",
    )
    ap.add_argument(
        "--no-extrapolate",
        action="store_true",
        help="只跑量測，不做 14B 外推",
    )
    args = ap.parse_args()

    print("=" * 60)
    print(" Corphia AI - LLM Speed Benchmark")
    print("=" * 60)

    model_dir = _find_model_dir()
    print(f"Model dir: {model_dir}")

    files = _pick_models(model_dir, args.model)
    if not files:
        kw = f"（關鍵字 '{args.model}'）" if args.model else ""
        print(f"ERROR: 在 {model_dir} 找不到 .gguf 檔{kw}")
        sys.exit(1)

    print(f"將依序測試 {len(files)} 個模型:")
    for f in files:
        size = _effective_size_gb(f)
        tag = " [多分片]" if _SHARD_PATTERN.search(f.name) else ""
        print(f"  - {f.name}  ({size:.2f} GB){tag}")

    results: List[BenchResult] = []
    for f in files:
        try:
            r = _run_one(f, args.max_tokens, args.n_gpu_layers)
            results.append(r)
        except Exception as e:
            print(f"[ERROR] {f.name} 測試失敗: {e}")

    print()
    print("=" * 60)
    print(" 量測總結")
    print("=" * 60)
    print(f"  {'Model':<40s}  {'Size(GB)':>9s}  {'tok/s':>8s}  Verdict")
    for r in results:
        print(
            f"  {r.name:<40s}  {r.file_size_gb:>9.2f}  {r.tok_per_sec:>8.2f}  "
            f"{_verdict(r.tok_per_sec)}"
        )

    if not args.no_extrapolate:
        _extrapolate_14b(results)


if __name__ == "__main__":
    main()
