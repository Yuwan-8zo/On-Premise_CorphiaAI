"""
WebSocket 對話 API
"""

import json
import logging
import asyncio
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token
from app.services.chat_service import ChatService

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
        while True:
            try:
                # 接收訊息
                data = await websocket.receive_json()
                
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
                    
                    # 避免重複發送請求
                    if current_generation_task and not current_generation_task.done():
                        await websocket.send_json({
                            "type": "error",
                            "message": "前一個請求正在處理中，請先停止"
                        })
                        continue
                    
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
        logger.error(f"WebSocket 錯誤: {e}")
        try:
            await websocket.send_json({
                "type": "error",
                "message": str(e)
            })
        except Exception as send_err:
            logger.warning(f"WebSocket 無法送出錯誤訊息: {send_err}")
    finally:
        manager.disconnect(connection_id)
