"""
系統健康監控 API (C4 差異化功能)

即時顯示 GPU/CPU 使用率、VRAM、tokens/sec、context 佔用比例。
提供前端模型健康監控面板所需的所有數據。
"""

import logging
import platform
import asyncio
import time as time_module
import json
import socket
from pathlib import Path
from app.core.time_utils import utc_now_iso

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.deps import get_current_user, RequireAdmin
from app.core.database import get_db
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/system", tags=["系統監控"])

def _project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _runtime_dir() -> Path:
    return _project_root() / ".runtime"


def _lan_runtime_path() -> Path:
    return _runtime_dir() / "lan.json"


def _read_lan_enabled() -> bool:
    path = _lan_runtime_path()
    if not path.exists():
        return False
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return bool(data.get("lan_enabled"))
    except Exception:
        return False


def _write_lan_enabled(enabled: bool) -> None:
    _runtime_dir().mkdir(parents=True, exist_ok=True)
    payload = {"lan_enabled": bool(enabled), "updated_at": utc_now_iso()}
    _lan_runtime_path().write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _detect_lan_ips() -> list[str]:
    ips: set[str] = set()
    try:
        host = socket.gethostname()
        _name, _aliases, addrs = socket.gethostbyname_ex(host)
        for ip in addrs:
            if ip and not ip.startswith("127."):
                ips.add(ip)
    except Exception:
        pass

    # 盡量補足：有些環境 gethostbyname_ex 只回一個或回到錯的網卡
    try:
        for info in socket.getaddrinfo(host, None):
            ip = info[4][0]
            if ip and "." in ip and not ip.startswith("127."):
                ips.add(ip)
    except Exception:
        pass

    # 排序：家用／公司網段（192.168、10）在前，虛擬網卡常用的 172.16–31（WSL、Hyper-V）放後面
    def _rank(ip: str) -> tuple[int, str]:
        if ip.startswith("192.168."):
            return (0, ip)
        if ip.startswith("10."):
            return (1, ip)
        return (2, ip)

    return sorted(ips, key=_rank)


class LanToggleRequest(BaseModel):
    enabled: bool

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
    from app.services.model_manager import get_model_manager
    from app.core.config import settings
    llm = get_llm_service()
    manager = get_model_manager()

    model_loaded = llm._initialized and llm.use_llama_cpp

    stats: dict = {
        "model_loaded": model_loaded,
        "provider": "llama.cpp" if llm.use_llama_cpp else "simulation",
        "model_path": manager.current_model_path or "Simulation Mode",
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

    from app.schemas.system_monitor import SystemMonitorEnvelope

    return SystemMonitorEnvelope(
        data={
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
    )


@router.get("/network/status")
async def network_status(
    _ = RequireAdmin,
):
    """
    網路連線狀態偵測 (A4 離線模式徽章)

    偵測本機對外網路狀態，前端可據此顯示
    「資料主權保證：完全離線運行」徽章。
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

    from app.schemas.system_monitor import SystemMonitorEnvelope

    return SystemMonitorEnvelope(
        data={
            "is_online": is_online,
            "latency_ms": latency_ms,
            "data_sovereignty": not is_online,
            "message": "資料主權保證：完全離線運行" if not is_online else "偵測到外部網路連線",
        }
    )


@router.get("/lan/status", summary="取得區域網路 (LAN) 開關狀態")
async def get_lan_status(
    _ = RequireAdmin,
):
    # 切換立即生效：前端伺服器（frontend/vite-plugins/lanGate.ts）每個請求都讀 lan.json 決定放不放行
    return {
        "enabled": _read_lan_enabled(),
        "lan_ips": _detect_lan_ips(),
        "requires_restart": False,
    }


@router.post("/lan/toggle", summary="設定區域網路 (LAN) 開關（立即生效）")
async def toggle_lan(
    body: LanToggleRequest,
    current_user: User = Depends(get_current_user),
    db=Depends(get_db),
    _ = RequireAdmin,
):
    _ = db
    _write_lan_enabled(body.enabled)
    logger.info("[lan][admin=%s] set lan_enabled=%s", current_user.email, body.enabled)
    return {
        "enabled": bool(body.enabled),
        "lan_ips": _detect_lan_ips(),
        "requires_restart": False,
    }


# 模組級啟動時間 — 用 time.time() 在載入 module 時就抓
_BACKEND_BOOT_TIME = time_module.time()


@router.get("/runtime-info", summary="取得後端執行時間資訊")
async def get_runtime_info(
    _ = RequireAdmin,
):
    """
    返回後端的執行時間統計與資料庫連線池狀態。
    """
    uptime_seconds = int(time_module.time() - _BACKEND_BOOT_TIME)

    # PostgreSQL 連線池使用情況
    from app.core.database import engine
    pool = engine.pool
    pool_info = {
        "size": pool.size(),
        "checked_in": pool.checkedin(),
        "checked_out": pool.checkedout(),
        "overflow": pool.overflow(),
    }

    return {
        "status": "success",
        "data": {
            "uptime_seconds": uptime_seconds,
            "boot_timestamp": _BACKEND_BOOT_TIME,
            "db_pool": pool_info,
        }
    }
