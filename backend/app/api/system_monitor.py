"""
系統健康監控 API (C4 差異化功能)

即時顯示 GPU/CPU 使用率、VRAM、tokens/sec、context 佔用比例。
提供前端模型健康監控面板所需的所有數據。
"""

import logging
import platform
import asyncio
from app.core.time_utils import utc_now_iso

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user, RequireAdmin
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/system", tags=["系統監控"])


async def _get_cpu_info() -> dict:
    """取得 CPU 使用資訊"""
    try:
        import psutil
        cpu_percent = await asyncio.to_thread(psutil.cpu_percent, interval=0.5)
        cpu_count = psutil.cpu_count(logical=True)
        memory = psutil.virtual_memory()
        return {
            "cpu_percent": cpu_percent,
            "cpu_cores": cpu_count,
            "memory_total_gb": round(memory.total / (1024 ** 3), 2),
            "memory_used_gb": round(memory.used / (1024 ** 3), 2),
            "memory_percent": memory.percent,
        }
    except ImportError:
        return {"error": "psutil 未安裝，無法取得 CPU 資訊"}
    except Exception as e:
        logger.error(f"取得 CPU 資訊失敗: {e}")
        return {"error": str(e)}


async def _get_gpu_info() -> dict:
    """取得 GPU / VRAM 使用資訊"""
    # 嘗試 NVIDIA GPU (nvidia-smi / pynvml)
    try:
        import pynvml
        await asyncio.to_thread(pynvml.nvmlInit)
        device_count = pynvml.nvmlDeviceGetCount()

        gpus = []
        for i in range(device_count):
            handle = pynvml.nvmlDeviceGetHandleByIndex(i)
            name = pynvml.nvmlDeviceGetName(handle)
            if isinstance(name, bytes):
                name = name.decode('utf-8')
            memory = pynvml.nvmlDeviceGetMemoryInfo(handle)
            utilization = pynvml.nvmlDeviceGetUtilizationRates(handle)

            gpus.append({
                "index": i,
                "name": name,
                "vram_total_mb": round(memory.total / (1024 ** 2)),
                "vram_used_mb": round(memory.used / (1024 ** 2)),
                "vram_free_mb": round(memory.free / (1024 ** 2)),
                "vram_percent": round(memory.used / memory.total * 100, 1),
                "gpu_utilization": utilization.gpu,
                "memory_utilization": utilization.memory,
            })

        pynvml.nvmlShutdown()
        return {"available": True, "type": "nvidia", "devices": gpus}

    except ImportError:
        pass
    except Exception as e:
        logger.debug(f"NVIDIA GPU 偵測失敗: {e}")

    # 沒有 GPU 或偵測失敗
    return {"available": False, "type": "none", "devices": []}


async def _get_llm_stats() -> dict:
    """取得 LLM 模型統計資訊"""
    from app.services.llm_service import get_llm_service
    from app.core.config import settings
    llm = get_llm_service()

    model_loaded = llm._initialized and (llm.client is not None or llm.use_llama_cpp)

    stats: dict = {
        "model_loaded": model_loaded,
        "model_path": llm.model if not llm.use_llama_cpp else "GGUF Model",
        "context_size": getattr(settings, "llama_context_size", 4096),
        "n_gpu_layers": getattr(settings, "llama_n_gpu_layers", 0),
    }

    # ── C4: 即時 tokens/sec 統計 ─────────────────────────
    try:
        stats["throughput"] = llm.get_throughput_stats()
    except Exception as e:
        logger.debug(f"throughput stats 無法取得: {e}")
        stats["throughput"] = {
            "last_tokens_per_sec": 0.0,
            "avg_tokens_per_sec": 0.0,
            "total_generations": 0,
            "total_tokens_generated": 0,
            "sample_size": 0,
        }

    return stats


@router.get("/health/detailed")
async def detailed_health(
    _ = RequireAdmin,
):
    """
    詳細系統健康狀態

    回傳 CPU / GPU / VRAM / LLM 模型的即時監控數據。
    需要管理員權限才能存取。
    """
    cpu_info, gpu_info, llm_stats = await asyncio.gather(
        _get_cpu_info(),
        _get_gpu_info(),
        _get_llm_stats(),
    )

    return {
        "timestamp": utc_now_iso(),
        "platform": {
            "system": platform.system(),
            "machine": platform.machine(),
            "python_version": platform.python_version(),
        },
        "cpu": cpu_info,
        "gpu": gpu_info,
        "llm": llm_stats,
    }


@router.get("/network/status")
async def network_status(
    _ = RequireAdmin,
):
    """
    網路連線狀態偵測 (A4 離線模式徽章)

    偵測本機對外網路狀態，前端可據此顯示
    「✅ 資料主權保證：完全離線運行」徽章。
    """
    is_online = False
    latency_ms: float | None = None

    try:
        import aiohttp
        import time

        start = time.monotonic()
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=3)) as session:
            async with session.head("https://www.google.com") as resp:
                if resp.status < 500:
                    is_online = True
                    latency_ms = round((time.monotonic() - start) * 1000, 1)
    except ImportError:
        # aiohttp 未安裝，改用 socket
        import socket
        try:
            socket.create_connection(("8.8.8.8", 53), timeout=2)
            is_online = True
        except OSError:
            is_online = False
    except Exception:
        is_online = False

    return {
        "is_online": is_online,
        "latency_ms": latency_ms,
        "data_sovereignty": not is_online,
        "message": "✅ 資料主權保證：完全離線運行" if not is_online else "⚠️ 偵測到外部網路連線",
    }
