"""
對話服務模組

處理對話邏輯和訊息管理
"""

import logging
from typing import Optional, AsyncGenerator
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from langgraph.graph import StateGraph, START, END
from typing import TypedDict, Optional, Any, AsyncGenerator

from duckduckgo_search import DDGS
import asyncio

from app.models.conversation import Conversation
from app.models.message import Message, MessageRole
from app.models.user import User
from app.services.llm_service import get_llm_service
from app.services.rag_service import get_rag_service

logger = logging.getLogger(__name__)

class AgentState(TypedDict, total=False):
    conversation_id: str
    tenant_id: str
    folder_name: Optional[str]
    use_rag: bool
    query: str
    chat_history: list[dict]
    route: str
    context: str
    sources: list[dict]



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
1. 必須使用系統指定的回覆語言回答，不能自行判斷
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
4. 回答請條理分明，必要時使用 Markdown 格式並標註來源所在。
5. 必須使用系統指定的回覆語言回答，不能自行判斷。"""

    # 語言指令對照表
    LANGUAGE_DIRECTIVES: dict[str, str] = {
        "zh-TW": "【重要】你必須完全使用繁體中文回答。不論使用者用什麼語言提問，你的所有回覆都必須是繁體中文。",
        "en-US": "[IMPORTANT] You MUST reply entirely in English. Regardless of the language the user writes in, all your responses must be in English.",
        "ja-JP": "【重要】あなたは必ず日本語で回答してください。ユーザーがどの言語で質問しても、すべての返答は日本語でなければなりません。",
    }
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.llm_service = get_llm_service()
        self.rag_service = get_rag_service()
        self.agent_graph = self._build_agent_graph()
        
    def _build_agent_graph(self):
        workflow = StateGraph(AgentState)
        
        workflow.add_node("router", self._router_node)
        workflow.add_node("rag", self._rag_node)
        workflow.add_node("web_search", self._web_search_node)
        workflow.add_node("chat_prep", self._chat_prep_node)
        
        workflow.add_edge(START, "router")
        
        def route_condition(state: AgentState):
            return state.get("route", "chat_prep")
            
        workflow.add_conditional_edges(
            "router",
            route_condition,
            {
                "rag": "rag",
                "web_search": "web_search",
                "chat": "chat_prep"
            }
        )
        
        workflow.add_edge("rag", END)
        workflow.add_edge("web_search", END)
        workflow.add_edge("chat_prep", END)
        
        return workflow.compile()
        
    async def _router_node(self, state: AgentState) -> dict:
        use_rag = state.get("use_rag", True)
        folder_name = state.get("folder_name")
        
        if use_rag and folder_name:
            # 專案綁定，強制內部 RAG 減少外部幻覺
            return {"route": "rag"}
            
        schema = {
            "type": "object",
            "properties": {
                "route": {
                    "type": "string",
                    "enum": ["rag", "web_search", "chat"]
                }
            },
            "required": ["route"]
        }
        
        prompt_text = f"分析最後一則訊息以決定路徑：\n'rag': 從專案資料夾內部文獻中尋找答案\n'web_search': 需要上網搜尋最新即時資訊\n'chat': 一般問答\n\n使用者最新訊息：「{state.get('query')}」"
        system_prompt = "你是一個分類系統。請務必唯一輸出符合 schema 的 JSON。"
        
        prompt = self.llm_service.build_chat_prompt(
            messages=[{"role": "user", "content": prompt_text}],
            system_prompt=system_prompt
        )
        
        try:
            decision = await self.llm_service.generate_structured(prompt, schema)
            route = decision.get("route", "chat")
            if route not in ["rag", "web_search", "chat"]:
                route = "chat"
        except Exception as e:
            logger.error(f"Router Decision Error: {e}")
            route = "rag" if use_rag else "chat"
            
        return {"route": route}

    async def _rag_node(self, state: AgentState) -> dict:
        context = ""
        sources = []
        folder_name = state.get("folder_name")
        document_ids = None
        
        if folder_name:
            from app.models.document import Document
            docs_result = await self.db.execute(
                select(Document).where(Document.tenant_id == state.get("tenant_id"))
            )
            documents = docs_result.scalars().all()
            
            document_ids = []
            for doc in documents:
                metadata = doc.doc_metadata or {}
                if metadata.get("folderName") == folder_name and metadata.get("isActive", True):
                    document_ids.append(doc.id)
                    
        search_results = await self.rag_service.search(
            query=state.get("query", ""),
            tenant_id=state.get("tenant_id"),
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
        return {"context": context, "sources": sources}

    async def _web_search_node(self, state: AgentState) -> dict:
        context = ""
        sources = []
        try:
            # DuckDuckGo 搜尋 (以 thread 非同步執行避免阻塞)
            def _sync_search():
                with DDGS() as ddgs:
                    return list(ddgs.text(state.get("query"), max_results=3))
            
            results = await asyncio.to_thread(_sync_search)
            
            for idx, r in enumerate(results):
                context += f"【來源 {idx+1}】 {r.get('title')}\n{r.get('body')}\n\n"
                sources.append({
                    "chunk_id": f"web_{idx}",
                    "content": r.get('body', '')[:200],
                    "score": 0.9,
                    "document_id": r.get('href', ''),
                    "document_name": f"網頁：{r.get('title')}"
                })
        except Exception as e:
            logger.error(f"Web Search Error: {e}")
            
        return {"context": context, "sources": sources}

    async def _chat_prep_node(self, state: AgentState) -> dict:
        return {"context": "", "sources": []}

    
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
        language: str = "zh-TW",
    ) -> Message:
        """
        發送訊息並取得回應（非串流）

        Args:
            language: 回覆語言代碼（zh-TW / en-US / ja-JP）
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
        
        # 取得 tenant 和 folder
        result = await self.db.execute(
            select(Conversation).where(Conversation.id == conversation_id)
        )
        conversation = result.scalar_one_or_none()
        folder_name = conversation.settings.get("folderName") if conversation else None
        tenant_id = conversation.tenant_id if conversation else "default"
        
        chat_history = [
            {"role": m.role, "content": m.content}
            for m in messages[-10:]
        ]
        
        # 執行 LangGraph 路由
        initial_state: AgentState = {
            "conversation_id": conversation_id,
            "tenant_id": tenant_id,
            "folder_name": folder_name,
            "use_rag": use_rag,
            "query": content,
            "chat_history": chat_history,
            "route": "",
            "context": "",
            "sources": []
        }
        
        final_state = await self.agent_graph.ainvoke(initial_state)
        
        context = final_state.get("context", "")
        sources = final_state.get("sources", [])
        route = final_state.get("route", "chat")
        
        chat_history.append({"role": "user", "content": content})
        
        if final_state.get("folder_name"):
            system_prompt = self.STRICT_RAG_SYSTEM_PROMPT
        elif route == "web_search":
            system_prompt = "你是具備網路搜尋能力的 AI，請根據以下提供的網頁檢索內容，綜合回答問題。必須使用系統指定的回覆語言。"
        else:
            system_prompt = self.DEFAULT_SYSTEM_PROMPT

        # 在系統提示末尾注入語言強制指令
        lang_directive = self.LANGUAGE_DIRECTIVES.get(language, self.LANGUAGE_DIRECTIVES["zh-TW"])
        system_prompt = f"{system_prompt}\n\n{lang_directive}"
            
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
        language: str = "zh-TW",
    ) -> AsyncGenerator[dict, None]:
        """
        發送訊息並串流回應

        Args:
            language: 回覆語言代碼（zh-TW / en-US / ja-JP）
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
        
        # 取得 tenant 和 folder
        result = await self.db.execute(
            select(Conversation).where(Conversation.id == conversation_id)
        )
        conversation = result.scalar_one_or_none()
        folder_name = conversation.settings.get("folderName") if conversation else None
        tenant_id = conversation.tenant_id if conversation else "default"
        
        chat_history = [
            {"role": m.role, "content": m.content}
            for m in messages[-10:]
        ]
        
        # 執行 LangGraph 路由
        initial_state: AgentState = {
            "conversation_id": conversation_id,
            "tenant_id": tenant_id,
            "folder_name": folder_name,
            "use_rag": use_rag,
            "query": content,
            "chat_history": chat_history,
            "route": "",
            "context": "",
            "sources": []
        }
        
        final_state = await self.agent_graph.ainvoke(initial_state)
        
        context = final_state.get("context", "")
        sources = final_state.get("sources", [])
        route = final_state.get("route", "chat")
        
        chat_history.append({"role": "user", "content": content})
        
        if final_state.get("folder_name"):
            system_prompt = self.STRICT_RAG_SYSTEM_PROMPT
        elif route == "web_search":
            system_prompt = "你是具備網路搜尋能力的 AI，請根據以下提供的網頁檢索內容，綜合客觀地回答問題。必須使用系統指定的回覆語言。"
        else:
            system_prompt = self.DEFAULT_SYSTEM_PROMPT

        # 在系統提示末尾注入語言強制指令
        # 強制語言比「使用使用者語言」更可靠，因大多數 LLM 容易忽略模糊指令
        lang_directive = self.LANGUAGE_DIRECTIVES.get(language, self.LANGUAGE_DIRECTIVES["zh-TW"])
        system_prompt = f"{system_prompt}\n\n{lang_directive}"
            
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
