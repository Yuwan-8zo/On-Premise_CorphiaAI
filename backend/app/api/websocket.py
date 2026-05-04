"""
WebSocket 對話 API
"""

import json
import logging
import asyncio
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import decode_token
from app.services.chat_service import ChatService
from app.services.pii_masking_service import mask_pii
from app.services.prompt_guard_service import check_prompt_injection
from app.services.dlp_service import check_dlp
from app.services.quota_service import check_user_quota

logger = logging.getLogger(__name__)

router = APIRouter()


class ConnectionManager:
    """WebSocket 連接管理器"""
    
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}
    
    async def connect(self, websocket: WebSocket, connection_id: str):
        await websocket.accept()
        self.active_connections[connection_id] = websocket
        logger.info(f"WebSocket 連接: {connection_id}")
    
    def disconnect(self, connection_id: str):
        if connection_id in self.active_connections:
            del self.active_connections[connection_id]
            logger.info(f"WebSocket 斷開: {connection_id}")
    
    async def send_json(self, connection_id: str, data: dict):
        if connection_id in self.active_connections:
            await self.active_connections[connection_id].send_json(data)


manager = ConnectionManager()


@router.websocket("/ws/chat/{conversation_id}")
async def websocket_chat(
    websocket: WebSocket,
    conversation_id: str,
    token: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    WebSocket 對話端點
    
    連接: ws://host/ws/chat/{conversation_id}?token={jwt_token}
    
    發送訊息格式:
    {
        "type": "message",
        "content": "訊息內容",
        "use_rag": true  // 可選
    }
    
    接收訊息格式:
    - 來源: {"type": "sources", "sources": [...]}
    - 串流: {"type": "stream", "content": "..."}
    - 完成: {"type": "done", "message_id": "..."}
    - 錯誤: {"type": "error", "message": "..."}
    """
    # 驗證 Token
    if not token:
        await websocket.close(code=4001, reason="缺少認證 Token")
        return
    
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        await websocket.close(code=4001, reason="無效的認證 Token")
        return
    
    # 檢查 Token 是否已被撤銷（黑名單機制）
    jti = payload.get("jti")
    if jti:
        from app.services.token_service import is_token_blacklisted
        is_blacklisted = await is_token_blacklisted(db, jti)
        if is_blacklisted:
            await websocket.close(code=4001, reason="Token 已被撤銷")
            return
    
    user_id = payload.get("sub")
    connection_id = f"{user_id}_{conversation_id}"
    
    # 接受連接
    await manager.connect(websocket, connection_id)
    
    try:
        chat_service = ChatService(db)
        
        # 驗證對話存取權限
        conversation = await chat_service.get_conversation(conversation_id, user_id)
        if not conversation:
            await websocket.send_json({
                "type": "error",
                "message": "對話不存在或無存取權限"
            })
            await websocket.close(code=4004, reason="對話不存在")
            return
        
        # 建立一個變數來追蹤當前的生成任務
        current_generation_task: Optional[asyncio.Task] = None

        # 單次生成最長時長（秒）；超過則自動中斷，避免 llama-cpp 卡死拖垮整條 WS
        GENERATION_TIMEOUT_SEC = 300

        async def _security_gate(raw_text: str) -> Optional[str]:
            """
            安全閘道：DLP → Injection → PII。

            - DLP 命中 → 送 dlp_block 事件 + 回傳 None（呼叫端應 continue 不送 LLM）
            - Injection 命中 → 送 injection_warning，但不阻斷（僅提醒 + 使用 sanitized_text）
            - PII 命中 → 送 pii_warning + 使用 masked_text 餵給 LLM

            回傳：要送進 LLM 的（可能已淨化／遮罩過的）文字；若為 None 表示已攔阻。
            """
            processed = raw_text

            # A3: DLP — 命中就攔阻，不送模型
            dlp_result = check_dlp(processed)
            if dlp_result["blocked"]:
                await websocket.send_json({
                    "type": "dlp_block",
                    "message": dlp_result["reason"],
                    "matched_terms_count": len(dlp_result["matched_terms"]),
                })
                return None

            # A2: Prompt Injection — 警告 + 淨化（仍允許繼續生成）
            if settings.enable_prompt_injection_guard:
                guard_result = check_prompt_injection(processed)
                if guard_result["is_suspicious"]:
                    await websocket.send_json({
                        "type": "injection_warning",
                        "message": "偵測到可疑的 Prompt Injection 模式，已自動淨化。",
                        "risk_level": guard_result["risk_level"],
                        "matched_patterns": guard_result["matched_patterns"],
                    })
                    processed = guard_result["sanitized_text"]

            # A1: PII Masking — 遮罩後再送模型
            if settings.enable_pii_masking:
                mask_result = mask_pii(processed)
                if mask_result["has_pii"]:
                    # 只回傳遮罩版的對照表，避免洩漏原值
                    await websocket.send_json({
                        "type": "pii_warning",
                        "message": f"已自動遮罩 {len(mask_result['mask_map'])} 項敏感資訊。",
                        "mask_map": [
                            {
                                "original_preview": m["original_preview"],
                                "masked": m["masked"],
                                "type": m["type"],
                                "label": m["label"],
                            }
                            for m in mask_result["mask_map"]
                        ],
                    })
                    processed = mask_result["masked_text"]

            return processed

        async def _generate_and_send(
            conv_id: str,
            text: str,
            r_flag: bool,
            temp: float,
            m_token: int,
            lang: str,
            resubmit_message_id: Optional[str] = None,
        ) -> None:
            """
            統一的串流生成與送訊邏輯，包含：
            - 總時長超時保護（asyncio.wait_for 圍起整個 stream 迴圈）
            - CancelledError 對應「使用者按停止」
            - TimeoutError 對應「生成過久自動終止」
            - 其他例外不再對外洩漏細節（對應 global_exception_handler 的策略）
            """

            async def _stream() -> None:
                async for chunk in chat_service.send_message_stream(
                    conversation_id=conv_id,
                    content=text,
                    use_rag=r_flag,
                    temperature=temp,
                    max_tokens=m_token,
                    language=lang,
                    resubmit_message_id=resubmit_message_id,
                ):
                    await websocket.send_json(chunk)

            try:
                await asyncio.wait_for(_stream(), timeout=GENERATION_TIMEOUT_SEC)
            except asyncio.TimeoutError:
                logger.warning(
                    f"生成逾時（> {GENERATION_TIMEOUT_SEC}s），自動中斷: {connection_id}"
                )
                await websocket.send_json({
                    "type": "error",
                    "code": "GENERATION_TIMEOUT",
                    "message": f"生成時間超過 {GENERATION_TIMEOUT_SEC} 秒，已自動停止。",
                })
                await websocket.send_json({"type": "done", "content": "\n[逾時已停止]"})
            except asyncio.CancelledError:
                logger.info(f"生成任務已中斷: {connection_id}")
                await websocket.send_json({"type": "done", "content": "\n[已停止生成]"})
                raise  # 讓 task 正常結束
            except WebSocketDisconnect:
                # 使用者關掉頁面，不用回任何東西
                logger.info(f"生成中 WebSocket 已斷線: {connection_id}")
            except Exception as e:
                import uuid as _uuid
                err_id = _uuid.uuid4().hex[:12]
                logger.error(f"[ERROR_ID={err_id}] 生成發生錯誤: {e}", exc_info=True)
                try:
                    await websocket.send_json({
                        "type": "error",
                        "code": "GENERATION_FAILED",
                        "message": "生成失敗，請稍後再試。",
                        "error_id": err_id,
                    })
                except Exception:
                    pass

        # 訊息處理迴圈
        # WebSocket 單則訊息上限（防 DoS via huge payload）
        # FastAPI / starlette 預設沒有 receive_json 大小上限，攻擊者可一次送 100MB
        # JSON 直接吃爆記憶體。實際聊天訊息應該 < 10KB，給 1MB 緩衝寬鬆但有界。
        WS_MAX_MESSAGE_BYTES = 1 * 1024 * 1024
        # 單則 content 字數上限（即使 JSON 包裝小，content 字串本身也要限）
        WS_MAX_CONTENT_CHARS = 32_000

        while True:
            try:
                # 改用 receive_text 先檢查大小，再 parse JSON，避免 parse 完才發現超大
                raw = await websocket.receive_text()
                if len(raw.encode("utf-8")) > WS_MAX_MESSAGE_BYTES:
                    await websocket.send_json({
                        "type": "error",
                        "code": "MESSAGE_TOO_LARGE",
                        "message": f"訊息超過 {WS_MAX_MESSAGE_BYTES // 1024}KB 上限",
                    })
                    continue
                try:
                    import json as _json
                    data = _json.loads(raw)
                except (ValueError, TypeError):
                    await websocket.send_json({
                        "type": "error",
                        "message": "無效的 JSON 格式",
                    })
                    continue

                msg_type = data.get("type")

                if msg_type == "message":
                    content = data.get("content", "").strip()
                    use_rag = data.get("use_rag", True)
                    temperature = data.get("temperature", 0.7)
                    max_tokens = data.get("max_tokens", 2048)
                    language = data.get("language", "zh-TW")

                    if not content:
                        await websocket.send_json({
                            "type": "error",
                            "message": "訊息內容不能為空"
                        })
                        continue

                    # 內容字串長度上限（即使整體 JSON 不大，極長字串也會吃 LLM context）
                    if len(content) > WS_MAX_CONTENT_CHARS:
                        await websocket.send_json({
                            "type": "error",
                            "code": "CONTENT_TOO_LONG",
                            "message": f"訊息內容超過 {WS_MAX_CONTENT_CHARS} 字上限",
                        })
                        continue
                    
                    # 避免重複發送請求
                    if current_generation_task and not current_generation_task.done():
                        await websocket.send_json({
                            "type": "error",
                            "message": "前一個請求正在處理中，請先停止"
                        })
                        continue

                    # B1: 每日訊息配額前置檢查
                    quota = await check_user_quota(db, user_id)
                    if not quota.allowed:
                        await websocket.send_json({
                            "type": "error",
                            "code": "QUOTA_EXCEEDED",
                            "message": quota.message,
                            "quota": {
                                "daily_limit": quota.daily_limit,
                                "used_today": quota.used_today,
                                "remaining": quota.remaining,
                            },
                        })
                        continue

                    # Phase 2 安全閘道（DLP → Injection → PII）
                    sanitized = await _security_gate(content)
                    if sanitized is None:
                        # DLP 已攔阻
                        continue
                    content = sanitized

                    # 啟動非同步生成任務
                    current_generation_task = asyncio.create_task(
                        _generate_and_send(conversation_id, content, use_rag, temperature, max_tokens, language)
                    )
                
                elif msg_type == "resubmit":
                    content = data.get("content", "").strip()
                    message_id = data.get("message_id")
                    use_rag = data.get("use_rag", True)
                    temperature = data.get("temperature", 0.7)
                    max_tokens = data.get("max_tokens", 2048)
                    language = data.get("language", "zh-TW")

                    if not content or not message_id:
                        await websocket.send_json({
                            "type": "error",
                            "message": "訊息內容或ID不能為空"
                        })
                        continue

                    if current_generation_task and not current_generation_task.done():
                        await websocket.send_json({
                            "type": "error",
                            "message": "前一個請求正在處理中，請先停止"
                        })
                        continue

                    # B1: 每日訊息配額前置檢查
                    quota = await check_user_quota(db, user_id)
                    if not quota.allowed:
                        await websocket.send_json({
                            "type": "error",
                            "code": "QUOTA_EXCEEDED",
                            "message": quota.message,
                            "quota": {
                                "daily_limit": quota.daily_limit,
                                "used_today": quota.used_today,
                                "remaining": quota.remaining,
                            },
                        })
                        continue

                    # Phase 2 安全閘道（DLP → Injection → PII）
                    sanitized = await _security_gate(content)
                    if sanitized is None:
                        continue
                    content = sanitized

                    # 共用統一的 _generate_and_send，差別只在 resubmit_message_id
                    current_generation_task = asyncio.create_task(
                        _generate_and_send(
                            conversation_id, content, use_rag,
                            temperature, max_tokens, language,
                            resubmit_message_id=message_id,
                        )
                    )
                
                elif msg_type == "ping":
                    await websocket.send_json({"type": "pong"})
                
                elif msg_type == "stop":
                    logger.info(f"收到停止請求: {connection_id}")
                    if current_generation_task and not current_generation_task.done():
                        current_generation_task.cancel()
                        # 給一點時間讓 Cancellation Propagate
                        await asyncio.sleep(0.1)
                
                else:
                    await websocket.send_json({
                        "type": "error",
                        "message": f"未知的訊息類型: {msg_type}"
                    })
                    
            except json.JSONDecodeError:
                await websocket.send_json({
                    "type": "error",
                    "message": "無效的 JSON 格式"
                })
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket 斷開連接: {connection_id}")
    except Exception as e:
        import uuid as _uuid
        err_id = _uuid.uuid4().hex[:12]
        logger.error(f"[ERROR_ID={err_id}] WebSocket 錯誤: {e}", exc_info=True)
        try:
            # 不對外洩漏 exception 訊息；只給 error_id 方便維運排查
            await websocket.send_json({
                "type": "error",
                "code": "INTERNAL_ERROR",
                "message": "連線發生錯誤，請回報給系統管理員",
                "error_id": err_id,
            })
        except Exception as send_err:
            logger.warning(f"WebSocket 無法送出錯誤訊息: {send_err}")
    finally:
        manager.disconnect(connection_id)
