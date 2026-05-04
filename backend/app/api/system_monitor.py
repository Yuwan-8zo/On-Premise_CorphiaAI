"""
系統健康監控 API (C4 差異化功能)

即時顯示 GPU/CPU 使用率、VRAM、tokens/sec、context 佔用比例。
提供前端模型健康監控面板所需的所有數據。
"""

import logging
import platform
import asyncio
from app.core.time_utils import utc_now_iso

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, RequireAdmin
from app.core.database import get_db
from app.models.user import User
from app.services.ngrok_service import (
    find_ngrok_binary,
    get_ngrok_state,
    start_ngrok_tunnel,
    stop_ngrok_and_clear_runtime,
)
from app.services.audit_service import (
    AuditAction,
    AuditResource,
    write_audit_log,
    get_client_ip,
    get_user_agent,
)

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


@router.get("/ngrok-url")
async def get_ngrok_url(
    _ = RequireAdmin,
):
    """
    取得當前 ngrok 公開網址

    即時查詢本機 ngrok API（port 4040~4042），回傳目前運作中的 HTTPS 通道。
    若 ngrok 未啟動則回傳 active: false。
    """
    return get_ngrok_state().to_dict()


@router.post("/ngrok/start")
async def start_ngrok(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _ = RequireAdmin,
):
    """
    啟動 ngrok 公開隧道（admin 用）

    流程：
      1. 找 ngrok 執行檔 — 沒裝就回 503
      2. 殺掉舊 process（避免 4040 端口被佔）
      3. 起新 ngrok http <FRONTEND_PORT>，poll 直到拿到 https URL（或超時）
      4. 寫 .runtime/ngrok.json + frontend/.env.local
      5. 寫 audit log（記錄誰在何時何處把公開連結打開）

    SECURITY: 這個端點把 backend / frontend 暴露到公網，必須記錄到 audit log，
    答辯 / 合規稽核時可回答「公開連結被誰、什麼時間、從哪台機器打開」。
    """
    if not find_ngrok_binary():
        # 503 Service Unavailable — 缺工具，前端會顯示「未安裝」提示
        from fastapi import HTTPException
        raise HTTPException(
            status_code=503,
            detail="ngrok 執行檔未找到（需安裝後重啟）",
        )

    # 在 thread pool 跑 — start_ngrok_tunnel 內含 sleep(1) + 多次 poll，會阻塞最多 ~20s
    # FIX: 包 wait_for 作為硬上限，ngrok 卡住時 API 不會永遠掛著
    try:
        process, state = await asyncio.wait_for(
            asyncio.to_thread(start_ngrok_tunnel),
            timeout=25.0,
        )
    except asyncio.TimeoutError:
        from fastapi import HTTPException
        # 失敗也寫 audit log（管理員嘗試開但失敗了，這也是有價值的紀錄）
        await write_audit_log(
            db=db,
            action=AuditAction.NGROK_START,
            resource_type=AuditResource.SYSTEM,
            user_id=current_user.id,
            user_email=current_user.email,
            tenant_id=current_user.tenant_id or "default",
            description="嘗試啟動 ngrok 公開隧道但超時失敗",
            details={"result": "timeout", "timeout_sec": 25},
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
        )
        raise HTTPException(
            status_code=504,
            detail="ngrok 啟動超過 25 秒未回應，已放棄。請檢查 authtoken 設定或網路。",
        )

    if not state.active:
        from fastapi import HTTPException
        await write_audit_log(
            db=db,
            action=AuditAction.NGROK_START,
            resource_type=AuditResource.SYSTEM,
            user_id=current_user.id,
            user_email=current_user.email,
            tenant_id=current_user.tenant_id or "default",
            description="嘗試啟動 ngrok 公開隧道但未取得 URL",
            details={"result": "no_url", "source": state.source if hasattr(state, "source") else None},
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
        )
        raise HTTPException(
            status_code=502,
            detail="ngrok 已啟動但取不到公開 URL（可能 authtoken 未設定）",
        )

    # 成功：寫入 audit log，紀錄公開 URL（合規稽核需要）
    await write_audit_log(
        db=db,
        action=AuditAction.NGROK_START,
        resource_type=AuditResource.SYSTEM,
        user_id=current_user.id,
        user_email=current_user.email,
        tenant_id=current_user.tenant_id or "default",
        description=f"啟動 ngrok 公開隧道：{state.url or '<unknown>'}",
        details={
            "result": "success",
            "public_url": state.url,
            "api_url": state.api_url,
        },
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    logger.info(
        "[ngrok][admin=%s] tunnel started: %s",
        current_user.email, state.url,
    )

    return state.to_dict()


@router.post("/ngrok/stop")
async def stop_ngrok(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _ = RequireAdmin,
):
    """
    關閉 ngrok 公開隧道（admin 用）

    用 taskkill / pkill 殺掉所有 ngrok process，
    然後把 runtime 狀態寫成 inactive，這樣前端下次查詢就拿到 active: false。

    一樣寫 audit log，記錄「誰在何時關閉公開連結」。
    """
    state = await asyncio.to_thread(stop_ngrok_and_clear_runtime)

    await write_audit_log(
        db=db,
        action=AuditAction.NGROK_STOP,
        resource_type=AuditResource.SYSTEM,
        user_id=current_user.id,
        user_email=current_user.email,
        tenant_id=current_user.tenant_id or "default",
        description="關閉 ngrok 公開隧道",
        details={"result": "success"},
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    logger.info("[ngrok][admin=%s] tunnel stopped", current_user.email)

    return state.to_dict()
