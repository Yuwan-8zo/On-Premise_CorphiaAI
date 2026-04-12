"""
WebSocket 對話 API
"""

import json
import logging
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
                    
                    if not content:
                        await websocket.send_json({
                            "type": "error",
                            "message": "訊息內容不能為空"
                        })
                        continue
                    
                    # 串流回應
                    async for chunk in chat_service.send_message_stream(
                        conversation_id=conversation_id,
                        content=content,
                        use_rag=use_rag,
                        temperature=temperature,
                        max_tokens=max_tokens,
                    ):
                        await websocket.send_json(chunk)
                
                elif msg_type == "ping":
                    await websocket.send_json({"type": "pong"})
                
                elif msg_type == "stop":
                    # TODO: 實作停止生成
                    logger.info(f"收到停止請求: {connection_id}")
                
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
        except:
            pass
    finally:
        manager.disconnect(connection_id)
