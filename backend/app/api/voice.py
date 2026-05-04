"""
語音轉文字 API（Whisper）

設計重點：
  - 前端負責把 MediaRecorder 錄到的 webm/opus，用瀏覽器內建 Web Audio API
    解碼並重採樣成 16kHz mono 16-bit PCM WAV，再上傳。
  - 後端只負責用 Python 的 `wave` 標準庫讀 WAV，所以不需要 ffmpeg。
  - 第一次呼叫會 lazy-load `openai/whisper-base`（多語系），之後留在記憶體。
  - 推論在 thread pool（FastAPI run_in_threadpool）跑，避免 block event loop。
"""

from __future__ import annotations

import io
import logging
import time
import wave
from threading import Lock
from typing import Optional

import numpy as np
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from fastapi.concurrency import run_in_threadpool

from app.api.deps import CurrentUser

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/voice", tags=["語音"])

# 延遲載入：避免 server 啟動就吃滿 RAM
_pipeline = None
_pipeline_lock = Lock()
_DEFAULT_MODEL = "openai/whisper-base"
_TARGET_SAMPLE_RATE = 16000
_MAX_AUDIO_BYTES = 25 * 1024 * 1024  # 25 MB
_MAX_AUDIO_SECONDS = 5 * 60  # 5 分鐘上限


def _get_pipeline():
    """單例 Whisper pipeline，第一次呼叫會下載模型。"""
    global _pipeline
    with _pipeline_lock:
        if _pipeline is None:
            t0 = time.perf_counter()
            logger.info(f"[voice] 開始載入 Whisper 模型：{_DEFAULT_MODEL}（首次需要下載）")
            from transformers import pipeline as hf_pipeline  # 延遲 import
            _pipeline = hf_pipeline(
                task="automatic-speech-recognition",
                model=_DEFAULT_MODEL,
                chunk_length_s=30,
            )
            logger.info(f"[voice] Whisper pipeline 載入完成，耗時 {time.perf_counter() - t0:.1f}s")
    return _pipeline


def _wav_bytes_to_float_array(wav_bytes: bytes) -> tuple[np.ndarray, int]:
    """
    讀取 WAV → (float32 numpy array [-1, 1], sample_rate)
    支援 8-bit unsigned / 16-bit signed / 32-bit signed PCM；多聲道自動 mixdown。
    """
    with wave.open(io.BytesIO(wav_bytes), "rb") as wf:
        n_channels = wf.getnchannels()
        sampwidth = wf.getsampwidth()
        framerate = wf.getframerate()
        n_frames = wf.getnframes()
        raw = wf.readframes(n_frames)

    if sampwidth == 2:
        arr = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    elif sampwidth == 4:
        arr = np.frombuffer(raw, dtype=np.int32).astype(np.float32) / 2147483648.0
    elif sampwidth == 1:
        arr = (np.frombuffer(raw, dtype=np.uint8).astype(np.float32) - 128.0) / 128.0
    else:
        raise ValueError(f"不支援的 WAV sampwidth={sampwidth}")

    if n_channels > 1:
        arr = arr.reshape(-1, n_channels).mean(axis=1)
    return arr.astype(np.float32, copy=False), framerate


def _resample_to_16k(arr: np.ndarray, source_rate: int) -> np.ndarray:
    """確保送進 Whisper 的是 16kHz；前端通常已經做過，這裡保險再轉一次。"""
    if source_rate == _TARGET_SAMPLE_RATE:
        return arr
    from math import gcd
    from scipy.signal import resample_poly
    g = gcd(source_rate, _TARGET_SAMPLE_RATE)
    up = _TARGET_SAMPLE_RATE // g
    down = source_rate // g
    return resample_poly(arr, up, down).astype(np.float32, copy=False)


def _normalize_lang(lang: Optional[str]) -> Optional[str]:
    """
    把前端送來的 i18next 語言碼轉成 Whisper 接受的格式：
      'zh-TW' / 'zh-CN' → 'zh'
      'en-US'           → 'en'
      'ja-JP'           → 'ja'
    Whisper 不需要 region 後綴，傳兩個字母 ISO-639-1 即可。
    """
    if not lang:
        return None
    base = lang.split("-")[0].split("_")[0].lower()
    return base or None


def _run_whisper(arr: np.ndarray, sample_rate: int, language: Optional[str]) -> str:
    """同步推論（會被 run_in_threadpool 包起來）。"""
    pipe = _get_pipeline()
    generate_kwargs = {}
    if language:
        # Whisper 支援強制指定語系，可大幅提升非英文準確度
        generate_kwargs["language"] = language
        generate_kwargs["task"] = "transcribe"  # 不要翻成英文
    result = pipe(
        {"raw": arr, "sampling_rate": sample_rate},
        generate_kwargs=generate_kwargs or None,
    )
    if isinstance(result, dict):
        text = result.get("text", "")
    elif isinstance(result, list) and result:
        text = result[0].get("text", "") if isinstance(result[0], dict) else str(result[0])
    else:
        text = str(result or "")
    return text.strip()


@router.post("/transcribe")
async def transcribe_voice(
    current_user: CurrentUser,
    audio: UploadFile = File(..., description="WAV 16kHz mono PCM (前端已預處理)"),
    language: Optional[str] = Form(None, description="i18next 語言碼，例：zh-TW / en-US / ja-JP"),
):
    """
    語音轉文字。
    - 輸入：multipart/form-data，欄位 `audio` 為 WAV blob（前端轉好的 16kHz mono）
    - 輸出：`{ text: str, language: str | null, duration_ms: int }`
    - 限制：單檔 25MB / 5 分鐘
    """
    raw = await audio.read()
    if not raw:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="audio 檔案為空")
    if len(raw) > _MAX_AUDIO_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            detail=f"音訊大小超過 {_MAX_AUDIO_BYTES // 1024 // 1024}MB 上限")

    try:
        arr, sample_rate = _wav_bytes_to_float_array(raw)
    except Exception as e:
        logger.exception("[voice] WAV 解析失敗")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"無法解析 WAV: {e}")

    duration_ms = int(len(arr) / max(sample_rate, 1) * 1000)
    if duration_ms > _MAX_AUDIO_SECONDS * 1000:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            detail=f"音訊長度超過 {_MAX_AUDIO_SECONDS} 秒上限")

    try:
        arr = _resample_to_16k(arr, sample_rate)
        sample_rate = _TARGET_SAMPLE_RATE
    except Exception as e:
        logger.exception("[voice] 重採樣失敗")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"無法重採樣至 16kHz: {e}")

    norm_lang = _normalize_lang(language)
    t0 = time.perf_counter()
    try:
        text = await run_in_threadpool(_run_whisper, arr, sample_rate, norm_lang)
    except Exception as e:
        logger.exception("[voice] Whisper 推論失敗")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"語音轉文字失敗: {e}")
    elapsed_ms = int((time.perf_counter() - t0) * 1000)
    logger.info(
        f"[voice] user={current_user.email} audio={duration_ms}ms transcribe={elapsed_ms}ms lang={norm_lang} chars={len(text)}"
    )

    return {
        "text": text,
        "language": norm_lang,
        "duration_ms": duration_ms,
        "elapsed_ms": elapsed_ms,
    }
