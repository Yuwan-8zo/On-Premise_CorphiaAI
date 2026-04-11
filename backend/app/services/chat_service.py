"""
對話服務模組

處理對話邏輯和訊息管理
"""

import logging
from typing import Optional, AsyncGenerator
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.models.conversation import Conversation
from app.models.message import Message, MessageRole
from app.models.user import User
from app.services.llm_service import get_llm_service
from app.services.rag_service import get_rag_service

logger = logging.getLogger(__name__)


class ChatService:
    """對話服務"""
    
    # 系統提示
    DEFAULT_SYSTEM_PROMPT = """你是 Corphia AI，一個由 Corphia AI Platform 驅動的智慧助手。

你的特點：
- 友善、專業、樂於助人
- 回答準確、有條理
- 支援繁體中文、英文和日文
- 可以參考提供的資料來回答問題

回答規則：
1. 使用與使用者相同的語言回答
2. 如果有參考資料，優先使用資料中的資訊
3. 如果不確定，誠實說明
4. 必要時使用 Markdown 格式組織回答"""

    STRICT_RAG_SYSTEM_PROMPT = """你是一個專案專屬的 AI 知識助理。
- 友善、專業、樂於助人
- 支援繁體中文、英文和日文

回答規則（極度重要）：
1. 你**必須**且**只能**基於使用者提供的「參考資料」來回答問題。
2. 如果使用者的問題超出了參考資料的範圍，或者資料中沒有相關資訊，請直接回答：「很抱歉，根據目前專案資料夾中勾選的文獻，我找不到與此問題相關的資訊。」
3. 絕對不可以編造答案或使用你原本內建的外部知識來回答專業問題。
4. 回答請條理分明，必要時使用 Markdown 格式並標註來源所在。"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.llm_service = get_llm_service()
        self.rag_service = get_rag_service()
    
    async def create_conversation(
        self,
        user: User,
        title: str = "新對話",
        model: str = "default",
    ) -> Conversation:
        """
        建立新對話
        
        Args:
            user: 使用者
            title: 對話標題
            model: 使用的模型
            
        Returns:
            Conversation: 對話記錄
        """
        conversation = Conversation(
            tenant_id=user.tenant_id or "default",
            user_id=user.id,
            title=title,
            model=model,
        )
        
        self.db.add(conversation)
        await self.db.commit()
        await self.db.refresh(conversation)
        
        logger.info(f"建立對話: {conversation.id}")
        return conversation
    
    async def get_conversation(
        self,
        conversation_id: str,
        user_id: str,
    ) -> Optional[Conversation]:
        """
        取得對話
        
        Args:
            conversation_id: 對話 ID
            user_id: 使用者 ID
            
        Returns:
            Optional[Conversation]: 對話記錄
        """
        result = await self.db.execute(
            select(Conversation).where(
                Conversation.id == conversation_id,
                Conversation.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()
    
    async def get_messages(
        self,
        conversation_id: str,
        limit: int = 50,
    ) -> list[Message]:
        """
        取得對話訊息
        
        Args:
            conversation_id: 對話 ID
            limit: 最大數量
            
        Returns:
            list[Message]: 訊息列表
        """
        result = await self.db.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at)
            .limit(limit)
        )
        return list(result.scalars().all())
    
    async def send_message(
        self,
        conversation_id: str,
        content: str,
        use_rag: bool = True,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> Message:
        """
        發送訊息並取得回應（非串流）
        
        Args:
            conversation_id: 對話 ID
            content: 訊息內容
            use_rag: 是否使用 RAG
            temperature: 溫度參數
            max_tokens: 最大 Token 數
            
        Returns:
            Message: 助手回應訊息
        """
        # 儲存使用者訊息
        user_message = Message(
            conversation_id=conversation_id,
            role=MessageRole.USER.value,
            content=content,
        )
        self.db.add(user_message)
        
        # 取得對話歷史
        messages = await self.get_messages(conversation_id)
        
        # RAG 檢索
        context = ""
        sources = []
        if use_rag:
            result = await self.db.execute(
                select(Conversation).where(Conversation.id == conversation_id)
            )
            conversation = result.scalar_one_or_none()
            
            if conversation:
                folder_name = conversation.settings.get("folderName")
                document_ids = None
                
                if folder_name:
                    from app.models.document import Document
                    # 取得目前 tenant 的所有文件進行 Python 內存過濾，以避免不同資料庫的 JSON 語法差異
                    docs_result = await self.db.execute(
                        select(Document).where(Document.tenant_id == conversation.tenant_id)
                    )
                    documents = docs_result.scalars().all()
                    
                    document_ids = []
                    for doc in documents:
                        metadata = doc.doc_metadata or {}
                        if metadata.get("folderName") == folder_name:
                            # 預設為啟動，除非特別標明 isActive 為 False
                            if metadata.get("isActive", True):
                                document_ids.append(doc.id)
                
                search_results = await self.rag_service.search(
                    query=content,
                    tenant_id=conversation.tenant_id,
                    n_results=3,
                    document_ids=document_ids,
                )
                
                if search_results:
                    context = self.rag_service.build_context(search_results)
                    sources = [
                        {
                            "chunk_id": r["chunk_id"],
                            "content": r["content"][:200],
                            "score": r["score"],
                            "document_id": r["metadata"].get("document_id", ""),
                            "document_name": r["metadata"].get("filename", "未知文件"),
                        }
                        for r in search_results
                    ]
        
        # 建構 Prompt
        chat_history = [
            {"role": m.role, "content": m.content}
            for m in messages[-10:]  # 只取最近 10 則訊息
        ]
        chat_history.append({"role": "user", "content": content})
        
        system_prompt = self.STRICT_RAG_SYSTEM_PROMPT if (use_rag and 'folder_name' in locals() and folder_name) else self.DEFAULT_SYSTEM_PROMPT
        
        prompt = self.llm_service.build_chat_prompt(
            messages=chat_history,
            system_prompt=system_prompt,
            context=context if context else None,
        )
        
        # 生成回應
        response_text = await self.llm_service.generate(
            prompt=prompt,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        
        # 儲存助手訊息
        assistant_message = Message(
            conversation_id=conversation_id,
            role=MessageRole.ASSISTANT.value,
            content=response_text,
            sources=sources if sources else None,
        )
        self.db.add(assistant_message)
        
        # 更新對話
        await self.db.execute(
            update(Conversation)
            .where(Conversation.id == conversation_id)
            .values(
                message_count=Conversation.message_count + 2,
                updated_at=datetime.utcnow(),
            )
        )
        
        await self.db.commit()
        await self.db.refresh(assistant_message)
        
        return assistant_message
    
    async def send_message_stream(
        self,
        conversation_id: str,
        content: str,
        use_rag: bool = True,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> AsyncGenerator[dict, None]:
        """
        發送訊息並串流回應
        
        Args:
            conversation_id: 對話 ID
            content: 訊息內容
            use_rag: 是否使用 RAG
            temperature: 溫度參數
            max_tokens: 最大 Token 數
            
        Yields:
            dict: 串流回應
        """
        # 儲存使用者訊息
        user_message = Message(
            conversation_id=conversation_id,
            role=MessageRole.USER.value,
            content=content,
        )
        self.db.add(user_message)
        await self.db.commit()
        
        # 取得對話歷史
        messages = await self.get_messages(conversation_id)
        
        # RAG 檢索
        context = ""
        sources = []
        if use_rag:
            result = await self.db.execute(
                select(Conversation).where(Conversation.id == conversation_id)
            )
            conversation = result.scalar_one_or_none()
            
            if conversation:
                folder_name = conversation.settings.get("folderName")
                document_ids = None
                
                if folder_name:
                    from app.models.document import Document
                    # 取得目前 tenant 的所有文件進行 Python 內存過濾，以避免不同資料庫的 JSON 語法差異
                    docs_result = await self.db.execute(
                        select(Document).where(Document.tenant_id == conversation.tenant_id)
                    )
                    documents = docs_result.scalars().all()
                    
                    document_ids = []
                    for doc in documents:
                        metadata = doc.doc_metadata or {}
                        if metadata.get("folderName") == folder_name:
                            # 預設為啟動，除非特別標明 isActive 為 False
                            if metadata.get("isActive", True):
                                document_ids.append(doc.id)
                                
                search_results = await self.rag_service.search(
                    query=content,
                    tenant_id=conversation.tenant_id,
                    n_results=3,
                    document_ids=document_ids,
                )
                
                if search_results:
                    context = self.rag_service.build_context(search_results)
                    sources = [
                        {
                            "chunk_id": r["chunk_id"],
                            "content": r["content"][:200],
                            "score": r["score"],
                            "document_id": r["metadata"].get("document_id", ""),
                            "document_name": r["metadata"].get("filename", "未知文件"),
                        }
                        for r in search_results
                    ]
        
        # 建構 Prompt
        chat_history = [
            {"role": m.role, "content": m.content}
            for m in messages[-10:]
        ]
        chat_history.append({"role": "user", "content": content})
        
        system_prompt = self.STRICT_RAG_SYSTEM_PROMPT if (use_rag and 'folder_name' in locals() and folder_name) else self.DEFAULT_SYSTEM_PROMPT
        
        prompt = self.llm_service.build_chat_prompt(
            messages=chat_history,
            system_prompt=system_prompt,
            context=context if context else None,
        )
        
        # 先發送來源資訊
        if sources:
            yield {
                "type": "sources",
                "sources": sources,
            }
        
        # 串流生成回應
        full_response = ""
        message_id = None
        
        async for chunk in self.llm_service.generate_stream(
            prompt=prompt,
            temperature=temperature,
            max_tokens=max_tokens,
        ):
            full_response += chunk
            yield {
                "type": "stream",
                "content": chunk,
            }
        
        # 儲存助手訊息
        assistant_message = Message(
            conversation_id=conversation_id,
            role=MessageRole.ASSISTANT.value,
            content=full_response,
            sources=sources if sources else None,
        )
        self.db.add(assistant_message)
        
        # 更新對話
        await self.db.execute(
            update(Conversation)
            .where(Conversation.id == conversation_id)
            .values(
                message_count=Conversation.message_count + 2,
                updated_at=datetime.utcnow(),
            )
        )
        
        await self.db.commit()
        await self.db.refresh(assistant_message)
        
        # 發送完成訊息
        yield {
            "type": "done",
            "message_id": assistant_message.id,
        }
    
    async def auto_title(self, conversation_id: str) -> str:
        """
        自動生成對話標題
        
        Args:
            conversation_id: 對話 ID
            
        Returns:
            str: 生成的標題
        """
        messages = await self.get_messages(conversation_id, limit=2)
        
        if not messages:
            return "新對話"
        
        # 使用第一則使用者訊息
        first_user_msg = next(
            (m for m in messages if m.role == MessageRole.USER.value),
            None
        )
        
        if first_user_msg:
            # 簡單截取前 50 字元作為標題
            title = first_user_msg.content[:50]
            if len(first_user_msg.content) > 50:
                title += "..."
            
            # 更新標題
            await self.db.execute(
                update(Conversation)
                .where(Conversation.id == conversation_id)
                .values(title=title)
            )
            await self.db.commit()
            
            return title
        
        return "新對話"
