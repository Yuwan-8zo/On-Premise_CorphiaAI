"""
對話服務

負責協調對話流程：
1. 接收使用者訊息
2. (可選) 執行 RAG 檢索
3. 組合 Prompt
4. 呼叫 LLM
5. 儲存紀錄
"""

import logging
from datetime import datetime, timezone
from typing import AsyncGenerator, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.conversation import Conversation
from app.models.message import Message, MessageRole
from app.services.llm_service import llm_service
from app.services.rag_service import rag_service

logger = logging.getLogger(__name__)


class ChatService:
    """對話服務"""
    
    async def process_message(
        self,
        db: AsyncSession,
        conversation_id: str,
        content: str,
        user_id: str,
        tenant_id: str,
        use_rag: bool = True,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> AsyncGenerator[str, None]:
        """
        處理使用者訊息並產生回應
        
        Args:
            db: 資料庫 Session
            conversation_id: 對話 ID
            content: 使用者訊息
            user_id: 使用者 ID
            tenant_id: 租戶 ID
            use_rag: 是否使用 RAG
            
        Yields:
            str: 串流回應內容
        """
        # 1. 儲存使用者訊息
        user_msg = Message(
            conversation_id=conversation_id,
            role=MessageRole.USER.value,
            content=content,
            tokens=len(content), # 簡單估算
        )
        db.add(user_msg)
        await db.commit()
        await db.refresh(user_msg)
        
        # 2. 準備上下文
        system_prompt = "你是 Corphia AI，一個專業的企業級 AI 助手。請用繁體中文回答。"
        context_messages = [
            {"role": "system", "content": system_prompt}
        ]
        
        sources = []
        
        # 3. RAG 檢索
        if use_rag:
            rag_results = await rag_service.search(
                query=content,
                tenant_id=tenant_id,
                n_results=3,
                threshold=0.3
            )
            
            if rag_results:
                context_text = "\n\n".join([
                    f"文件: {res['content']}" 
                    for res in rag_results
                ])
                
                rag_prompt = f"""
請參考以下內部文件回答使用者的問題。如果文件中沒有答案，請誠實告知。

參考文件：
{context_text}
"""
                context_messages.append({"role": "system", "content": rag_prompt})
                
                # 記錄來源引用
                for res in rag_results:
                    sources.append({
                        "documentId": res["metadata"].get("document_id"),
                        "chunkId": res["id"],
                        "content": res["content"][:100] + "...",
                        "score": res["score"]
                    })
        
        # 4. 取得歷史訊息 (最近 10 則)
        result = await db.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.desc())
            .limit(10)
        )
        history = list(reversed(result.scalars().all()))
        
        for msg in history:
            context_messages.append({
                "role": msg.role,
                "content": msg.content
            })
            
        # 5. 呼叫 LLM 並串流回應
        full_response = ""
        
        async for chunk in llm_service.chat_completion_stream(
            messages=context_messages,
            temperature=temperature,
            max_tokens=max_tokens
        ):
            full_response += chunk
            yield chunk
            
        # 6. 儲存 AI 回應
        ai_msg = Message(
            conversation_id=conversation_id,
            role=MessageRole.ASSISTANT.value,
            content=full_response,
            tokens=len(full_response), # 簡單估算
            sources=sources if sources else None
        )
        db.add(ai_msg)
        
        # 更新對話統計
        result = await db.execute(
            select(Conversation).where(Conversation.id == conversation_id)
        )
        conversation = result.scalar_one()
        conversation.message_count += 2  # user + assistant
        conversation.updated_at = datetime.now(timezone.utc)
        
        await db.commit()


# 單例
chat_service = ChatService()
