"""
WebSocket å°è©± API
"""

import json
import logging
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from database.connection import get_db
from app.core.security import decode_token
from app.services.chat_service import ChatService

logger = logging.getLogger(__name__)

router = APIRouter()


class ConnectionManager:
    """WebSocket ??¥ç®¡ç???""
    
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}
    
    async def connect(self, websocket: WebSocket, connection_id: str):
        await websocket.accept()
        self.active_connections[connection_id] = websocket
        logger.info(f"WebSocket ??¥: {connection_id}")
    
    def disconnect(self, connection_id: str):
        if connection_id in self.active_connections:
            del self.active_connections[connection_id]
            logger.info(f"WebSocket ?·é?: {connection_id}")
    
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
    WebSocket å°è©±ç«¯é?
    
    ??¥: ws://host/ws/chat/{conversation_id}?token={jwt_token}
    
    ?¼é€è??¯æ ¼å¼?
    {
        "type": "message",
        "content": "è¨Šæ¯?§å®¹",
        "use_rag": true  // ?¯é¸
    }
    
    ?¥æ”¶è¨Šæ¯?¼å?:
    - ä¾†æ?: {"type": "sources", "sources": [...]}
    - ä¸²æ?: {"type": "stream", "content": "..."}
    - å®Œæ?: {"type": "done", "message_id": "..."}
    - ?¯èª¤: {"type": "error", "message": "..."}
    """
    # é©—è? Token
    if not token:
        await websocket.close(code=4001, reason="ç¼ºå?èªè? Token")
        return
    
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        await websocket.close(code=4001, reason="?¡æ??„è?è­?Token")
        return
    
    user_id = payload.get("sub")
    connection_id = f"{user_id}_{conversation_id}"
    
    # ?¥å???¥
    await manager.connect(websocket, connection_id)
    
    try:
        chat_service = ChatService(db)
        
        # é©—è?å°è©±å­˜å?æ¬Šé?
        conversation = await chat_service.get_conversation(conversation_id, user_id)
        if not conversation:
            await websocket.send_json({
                "type": "error",
                "message": "å°è©±ä¸å??¨æ??¡å??–æ???
            })
            await websocket.close(code=4004, reason="å°è©±ä¸å???)
            return
        
        # è¨Šæ¯?•ç?è¿´å?
        while True:
            try:
                # ?¥æ”¶è¨Šæ¯
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
                            "message": "è¨Šæ¯?§å®¹ä¸èƒ½?ºç©º"
                        })
                        continue
                    
                    # ä¸²æ??æ?
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
                    # TODO: å¯¦ä??œæ­¢?Ÿæ?
                    logger.info(f"?¶åˆ°?œæ­¢è«‹æ?: {connection_id}")
                
                else:
                    await websocket.send_json({
                        "type": "error",
                        "message": f"?ªçŸ¥?„è??¯é??? {msg_type}"
                    })
                    
            except json.JSONDecodeError:
                await websocket.send_json({
                    "type": "error",
                    "message": "?¡æ???JSON ?¼å?"
                })
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket ?·é???¥: {connection_id}")
    except Exception as e:
        logger.error(f"WebSocket ?¯èª¤: {e}")
        try:
            await websocket.send_json({
                "type": "error",
                "message": str(e)
            })
        except:
            pass
    finally:
        manager.disconnect(connection_id)
