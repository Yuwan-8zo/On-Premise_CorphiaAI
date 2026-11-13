"""
WebSocket 對話 API
"""

import json
import logging
import asyncio
from contextlib import aclosing
from typing import Optional

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import authenticate_access_token
from app.core.database import get_db
from app.services.chat_service import ChatService, stopped_note
from app.services.message_guard import clamp_generation_params, screen_user_message
from app.services.model_preference import get_user_model
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
        "use_rag": true,  // 可選
        "web_search": false  // 可選，這一題要不要連對外搜尋（需要後端開啟功能）
    }
    
    接收訊息格式:
    - 來源: {"type": "sources", "sources": [...]}
    - 思考過程（只有會推理的模型才有）: {"type": "reasoning", "content": "..."}
    - 串流: {"type": "stream", "content": "..."}
    - 完成: {"type": "done", "message_id": "..."}
    - 錯誤: {"type": "error", "message": "..."}
    """
    # 驗證 Token：和一般 API 同一套規則（黑名單、帳號停用、強制踢出／改密碼後失效）
    if not token:
        await websocket.close(code=4001, reason="缺少認證 Token")
        return
    try:
        user = await authenticate_access_token(db, token)
    except HTTPException:
        await websocket.close(code=4001, reason="認證失敗")
        return

    user_id = user.id
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
        
        # 稽核紀錄要顯示「誰、從哪裡」
        audit_email = user.email
        audit_ip = websocket.client.host if websocket.client else None

        # 建立一個變數來追蹤當前的生成任務
        current_generation_task: Optional[asyncio.Task] = None

        # 單次生成最長時長（秒）；超過則自動中斷，避免 llama-cpp 卡死拖垮整條 WS。
        # 純 CPU 跑 7B 文件問答約 2.5 分鐘，若前面還有一題在排隊會更久，所以給 10 分鐘
        GENERATION_TIMEOUT_SEC = 600

        async def _security_gate(raw_text: str) -> Optional[str]:
            """安全閘道（個資遮罩 → 違禁詞 → 提示詞注入），規則在 services/message_guard；None＝已攔阻"""
            return await screen_user_message(
                db, raw_text,
                conversation_id=conversation_id,
                tenant_id=conversation.tenant_id,
                user_id=user_id,
                user_email=audit_email,
                ip_address=audit_ip,
                emit=websocket.send_json,
            )

        async def _quota_ok() -> bool:
            """每日訊息配額；用完就告訴前端並回 False"""
            quota = await check_user_quota(db, user_id)
            if quota.allowed:
                return True
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
            return False

        async def _generate_and_send(
            conv_id: str,
            text: str,
            r_flag: bool,
            temp: float,
            m_token: int,
            lang: str,
            resubmit_message_id: Optional[str] = None,
            web_search_flag: bool = False,
        ) -> None:
            """
            統一的串流生成與送訊邏輯，包含：
            - 總時長超時保護（asyncio.wait_for 圍起整個 stream 迴圈）
            - CancelledError 對應「使用者按停止」
            - TimeoutError 對應「生成過久自動終止」
            - 其他例外不再對外洩漏細節（對應 global_exception_handler 的策略）
            """

            # 每次回答前讀這個人最新選的模型（連線途中換模型也會生效；不影響其他人）
            chat_service.model_name = await get_user_model(db, user_id)

            async def _stream() -> None:
                # aclosing：連線中斷等任何原因提早結束時，立刻關閉生成流程，讓它把已寫出的部分存起來
                async with aclosing(chat_service.send_message_stream(
                    conversation_id=conv_id,
                    content=text,
                    use_rag=r_flag,
                    temperature=temp,
                    max_tokens=m_token,
                    language=lang,
                    resubmit_message_id=resubmit_message_id,
                    web_search=web_search_flag,
                )) as stream:
                    async for chunk in stream:
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
                # 已寫出的部分已經存起來（chat_service），前端收到 done 會重新讀取
                await websocket.send_json({"type": "done", "content": stopped_note(lang)})
            except asyncio.CancelledError:
                logger.info(f"生成任務已中斷: {connection_id}")
                await websocket.send_json({"type": "done", "content": stopped_note(lang)})
                raise  # 讓 task 正常結束
            except WebSocketDisconnect:
                # 使用者關掉頁面，不用回任何東西
                logger.info(f"生成中 WebSocket 已斷線: {connection_id}")
            except RuntimeError as e:
                # 使用者換對話／關分頁後，連線已關閉但生成還在送字：屬於正常斷線，不是錯誤
                if "websocket.close" in str(e) or "response already completed" in str(e):
                    logger.info(f"生成中 WebSocket 已關閉，停止送出: {connection_id}")
                else:
                    import uuid as _uuid
                    err_id = _uuid.uuid4().hex[:12]
                    logger.error(f"[ERROR_ID={err_id}] 生成發生錯誤: {e}", exc_info=True)
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

                if msg_type in ("message", "resubmit"):
                    # 送出新訊息與重新送出（編輯後再送）走同一套檢查；差別只在重新送出要帶原本那則的 ID
                    resubmit = msg_type == "resubmit"
                    content = str(data.get("content") or "").strip()
                    message_id = data.get("message_id") if resubmit else None
                    # 生成參數限制在合理範圍（前端送什麼都不會讓模型卡死或程式出錯）
                    params = clamp_generation_params(data)
                    use_rag, temperature = params["use_rag"], params["temperature"]
                    max_tokens, language = params["max_tokens"], params["language"]
                    web_search_flag = params["web_search"]

                    if not content or (resubmit and not message_id):
                        await websocket.send_json({
                            "type": "error",
                            "message": "訊息內容或ID不能為空" if resubmit else "訊息內容不能為空",
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

                    # 每日訊息配額
                    if not await _quota_ok():
                        continue

                    # 安全閘道（個資遮罩 → 違禁詞 → 提示詞注入）；DLP 攔阻時回傳 None
                    sanitized = await _security_gate(content)
                    if sanitized is None:
                        continue
                    content = sanitized

                    # 啟動非同步生成任務
                    current_generation_task = asyncio.create_task(
                        _generate_and_send(
                            conversation_id, content, use_rag,
                            temperature, max_tokens, language,
                            resubmit_message_id=message_id,
                            web_search_flag=web_search_flag,
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
