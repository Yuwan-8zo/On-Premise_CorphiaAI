"""
Corphia AI - LLM 推論速度測試
================================

不走 API、不用登入，直接載入 GGUF 模型跑一次生成，量測：
  - tokens/sec（生成階段）
  - prompt eval ms（輸入處理階段）
  - 輸出長度

用法（從 backend/ 目錄）：
    .\.venv\Scripts\python.exe benchmark_speed.py

預期看到的數字：
    純 CPU（i5/i7 13 代）       → 5~10 tok/s
    CPU + Intel Arc 部分 offload → 10~20 tok/s
    NVIDIA RTX 全 offload        → 30~80 tok/s

如果你看到 <5 tok/s → 確實該優化（GPU/Vulkan）
如果你看到 >15 tok/s → 沒必要折騰，現狀很好
"""

import os
import sys
import time
from pathlib import Path

# 確保能 import app/ 模組
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.services.model_manager import _find_model_dir


def run_benchmark():
    print("=" * 60)
    print(" Corphia AI - LLM Speed Benchmark")
    print("=" * 60)

    # 找模型
    model_dir = _find_model_dir()
    print(f"\n[1/4] Model dir: {model_dir}")

    gguf_files = list(model_dir.glob("*.gguf"))
    if not gguf_files:
        print(f"ERROR: No .gguf in {model_dir}")
        sys.exit(1)

    # 優先用 7B（使用者主要用的尺寸）；fallback 3B；都沒有就第一個
    chosen = (
        next((f for f in gguf_files if "7B" in f.name or "7b" in f.name), None)
        or next((f for f in gguf_files if "3B" in f.name or "3b" in f.name), None)
        or gguf_files[0]
    )
    print(f"      Using: {chosen.name} ({chosen.stat().st_size / 1024**3:.2f} GB)")

    # ── Load llama-cpp ─────────────────────────────────────
    print(f"\n[2/4] Loading model (this can take 10-60 sec)...")
    t0 = time.time()
    from llama_cpp import Llama

    llm = Llama(
        model_path=str(chosen),
        n_ctx=2048,
        n_threads=os.cpu_count() or 8,
        n_gpu_layers=-1,   # 嘗試把所有層 offload 到 GPU；沒 GPU 自動 fallback CPU
        verbose=False,
    )
    load_time = time.time() - t0
    print(f"      Loaded in {load_time:.1f}s")

    # ── Detect what backend was used ───────────────────────
    print(f"\n[3/4] Backend detection:")
    # llama-cpp-python 載入時會印 backend log，但 verbose=False 看不到
    # 重新初始化一次帶 verbose 看 backend (非必要，只供 debug)
    # 簡化：直接看 n_gpu_layers 的回應
    print(f"      n_gpu_layers requested: -1 (all)")
    print(f"      → 看下面 prompt eval 跟 generation 時間判斷")

    # ── Run benchmark ──────────────────────────────────────
    print(f"\n[4/4] Running 200-token generation test...")
    prompt = "請用大約 200 字詳細介紹台灣的茶文化，包含歷史、品種與品茶方式。"

    t0 = time.time()
    output = llm(
        prompt=prompt,
        max_tokens=200,
        temperature=0.7,
        echo=False,
    )
    elapsed = time.time() - t0

    text = output["choices"][0]["text"]
    usage = output.get("usage", {})
    completion_tokens = usage.get("completion_tokens", len(text.split()))
    prompt_tokens = usage.get("prompt_tokens", 0)

    tok_per_sec = completion_tokens / elapsed if elapsed > 0 else 0

    print()
    print("=" * 60)
    print(" RESULTS")
    print("=" * 60)
    print(f"  Prompt tokens:       {prompt_tokens}")
    print(f"  Completion tokens:   {completion_tokens}")
    print(f"  Total elapsed:       {elapsed:.2f}s")
    print(f"  Tokens/sec:          {tok_per_sec:.2f}")
    print()

    if tok_per_sec >= 15:
        verdict = "EXCELLENT - 沒必要折騰 GPU 加速"
    elif tok_per_sec >= 8:
        verdict = "GOOD - 可接受，要不要折騰看你"
    elif tok_per_sec >= 4:
        verdict = "MEDIOCRE - 體感稍慢，可以考慮優化"
    else:
        verdict = "SLOW - 強烈建議做 Vulkan/GPU 加速"

    print(f"  Verdict: {verdict}")
    print()
    print("-" * 60)
    print("Sample output (first 200 chars):")
    print("-" * 60)
    print(text[:200])
    print()


if __name__ == "__main__":
    run_benchmark()
