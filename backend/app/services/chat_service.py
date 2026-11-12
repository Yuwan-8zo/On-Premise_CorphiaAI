"""
對話服務模組

處理對話邏輯和訊息管理
"""

import asyncio
import logging
from typing import TypedDict, Optional, AsyncGenerator

from app.core.zh_convert import to_traditional
from app.core.config import settings
from app.core.time_utils import utc_now_naive

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func, or_
# QUALITY-01 修正：langgraph 改為懶惰 import（在使用點 import）
# 地端原則：本平台不提供網路搜尋，所有回答僅來自本地模型與企業內部文件，查詢不會送出內網
# 避免這些套件未安裝時阻斷整個模組載入，提升系統啟動可靠性

from app.models.conversation import Conversation
from app.models.message import Message, MessageRole
from app.models.user import User
from app.services.llm_service import get_llm_service
from app.services.rag_service import get_rag_service
# NOTE: PII masking 與 Prompt Injection 檢測已由上層 websocket.py 的 _security_gate() 統一處理
# 在 send_message_stream 中不再重複執行（見jBUG-07 修正）
from app.services.hash_chain_service import stamp_message
from app.models.user_memory import MemorySource
from app.services.audit_service import AuditAction, AuditResource, write_audit_log
from app.services.context_guard import GUARD_LINE, report_is_empty, screen_chunks, screen_text
from app.services import file_builder, generated_files
from app.services.memory_service import MemoryLimitError, add_memory, extract_remember, memory_block
from app.services.memory_service import is_enabled as memory_is_enabled

logger = logging.getLogger(__name__)

class AgentState(TypedDict, total=False):
    conversation_id: str
    tenant_id: str
    # 對話主人：專案資料夾是個人的，只能用他自己上傳到這個資料夾的文件
    user_id: Optional[str]
    folder_name: Optional[str]
    use_rag: bool
    query: str
    chat_history: list[dict]
    route: str
    context: str
    sources: list[dict]
    # 一般對話：這個人可以用的連接資料夾文件，以及路由時已經先搜好的結果（檢索那一步直接用，不重搜）
    folder_doc_ids: list[str]
    prefetched: list[dict]
    # 送模型前最後一關的報告（哪些文件片段被剔除、遮罩了幾個個資），見 services/context_guard
    screen: dict



def _to_traditional_deep(value):
    """把結構（dict／list）裡所有字串轉成正體中文"""
    if isinstance(value, str):
        return to_traditional(value)
    if isinstance(value, list):
        return [_to_traditional_deep(v) for v in value]
    if isinstance(value, dict):
        return {k: _to_traditional_deep(v) for k, v in value.items()}
    return value


def _clip_history(text: str, limit: int = 400) -> str:
    text = text or ""
    return text if len(text) <= limit else text[:limit] + "…"


# 中途停止的回答最後加一行標記，之後看就知道這段沒寫完（斜體＝小字註記）
STOPPED_NOTES = {
    "zh-TW": "（已停止）",
    "en-US": "(stopped)",
    "ja-JP": "（停止しました）",
}


def stopped_note(language: str) -> str:
    return "\n\n*" + STOPPED_NOTES.get(language, STOPPED_NOTES["zh-TW"]) + "*"


class ChatGenerationError(Exception):
    """無法產生回應（模型載入中、訊息不存在…）；code 給前端判斷用"""

    def __init__(self, message: str, code: Optional[str] = None):
        super().__init__(message)
        self.message = message
        self.code = code


class ChatService:
    """對話服務"""

    # 系統提示
    # 提示詞保持精簡：純 CPU 筆電讀入提示詞很慢（7B 每秒約 12 個 token），
    # 每多 100 個 token 就多等約 8 秒。簡體字由 zh_convert 在輸出時自動轉正體，不必在這裡列舉。
    DEFAULT_SYSTEM_PROMPT = """你是 Corphia AI，企業內部的智慧助手，友善、專業，回答準確且有條理。
1. 有參考資料時，優先使用資料中的資訊。
2. 不確定時誠實說明。
3. 必要時使用 Markdown 條列。"""

    STRICT_RAG_SYSTEM_PROMPT = """你是 Corphia AI，專案資料夾的知識助理。
1. 只能根據「參考資料」回答，不可編造，也不可使用外部知識。
2. 參考資料中沒有答案時，直接回答：「很抱歉，根據目前專案資料夾中勾選的文獻，我找不到與此問題相關的資訊。」
3. 回答條理分明，必要時使用 Markdown 條列。"""

    # 語言指令對照表
    LANGUAGE_DIRECTIVES: dict[str, str] = {
        "zh-TW": (
            "請全程使用台灣正體中文回答，不可使用簡體字；"
            "除了專有名詞與技術名稱（例如 DLP、JWT、Prompt Injection）之外，不要夾雜英文單字。"
        ),
        "en-US": "[IMPORTANT] You MUST reply entirely in English. Regardless of the language the user writes in, all your responses must be in English.",
        "ja-JP": "『重要』あなたは必ず日本語で回答してください。ユーザーがどの言語で質問しても、すべての返答は日本語でなければなりません。",
    }

    def __init__(self, db: AsyncSession, model_name: Optional[str] = None):
        self.db = db
        # 這個人自己選的模型（services/model_preference）；None＝系統預設
        self.model_name = model_name
        self.llm_service = get_llm_service()
        self.rag_service = get_rag_service()
        self.agent_graph = self._build_agent_graph()
        # 這一題「送模型前最後一關」的報告（_prepare_prompt 填）
        self.screen_report: dict = {}

    def _build_agent_graph(self):
        # QUALITY-01 修正：在方法內部懶惰 import langgraph，避免模組載入失敗
        from langgraph.graph import StateGraph, START, END
        workflow = StateGraph(AgentState)

        workflow.add_node("router", self._router_node)
        workflow.add_node("rag", self._rag_node)
        workflow.add_node("chat_prep", self._chat_prep_node)

        workflow.add_edge(START, "router")

        def route_condition(state: AgentState):
            return state.get("route", "chat_prep")

        workflow.add_conditional_edges(
            "router",
            route_condition,
            {
                "rag": "rag",
                "chat": "chat_prep"
            }
        )

        workflow.add_edge("rag", END)
        workflow.add_edge("chat_prep", END)

        return workflow.compile()

    async def _router_node(self, state: AgentState) -> dict:
        use_rag = state.get("use_rag", True)
        folder_name = state.get("folder_name")

        if use_rag and folder_name:
            # 專案綁定，強制內部 RAG 減少外部幻覺
            return {"route": "rag"}

        if not use_rag:
            # 一般對話：有可以用的連接資料夾（後台「資料夾」）就先在裡面找相關段落；
            # 找到就帶著參考資料回答（附來源），沒找到就一般聊天。只用向量檢索（毫秒級），不多一次 LLM 判斷
            folder_docs = await self._folder_doc_ids(state.get("user_id"))
            if folder_docs:
                hits = await self.rag_service.hybrid_search(
                    db=self.db,
                    query=state.get("query", ""),
                    tenant_id=state.get("tenant_id"),
                    n_results=settings.rag_top_k,
                    document_ids=folder_docs,
                    similarity_threshold=settings.rag_similarity_threshold,
                )
                if hits:
                    return {"route": "rag", "folder_doc_ids": folder_docs, "prefetched": hits}
            return {"route": "chat"}

        schema = {
            "type": "object",
            "properties": {
                "route": {
                    "type": "string",
                    "enum": ["rag", "chat"]
                }
            },
            "required": ["route"]
        }

        prompt_text = f"分析最後一則訊息以決定路徑：\n'rag': 從專案資料夾內部文獻中尋找答案\n'chat': 一般問答\n\n使用者最新訊息：「{state.get('query')}」"
        system_prompt = "你是一個分類系統。請務必唯一輸出符合 schema 的 JSON。"

        prompt = self.llm_service.build_chat_prompt(
            messages=[{"role": "user", "content": prompt_text}],
            system_prompt=system_prompt
        )

        try:
            # The answer is only {"route": "rag|chat"}; a small cap keeps this step fast on CPU.
            decision = await self.llm_service.generate_structured(prompt, schema, max_tokens=24, model_name=self.model_name)
            route = decision.get("route", "chat")
            if route not in ["rag", "chat"]:
                route = "chat"
        except Exception as e:
            logger.error(f"Router Decision Error: {e}")
            route = "rag" if use_rag else "chat"

        return {"route": route}

    async def _folder_doc_ids(self, user_id: Optional[str]) -> list[str]:
        """對話主人可以用的連接資料夾文件（權限規則在 folder_access）"""
        if not user_id:
            return []
        from app.models.user import User
        from app.services.folder_access import folder_document_ids

        user = await self.db.get(User, user_id)
        return await folder_document_ids(self.db, user) if user else []

    async def _rag_node(self, state: AgentState) -> dict:
        context = ""
        sources = []
        folder_name = state.get("folder_name")
        # 一般對話用連接資料夾：範圍是路由時算好的那些文件
        document_ids = state.get("folder_doc_ids") or None

        if folder_name:
            # FIX: 原本拉整個 tenant 的所有 Document 進記憶體 + Python loop 過濾
            # （tenant 有 10k 文件就裝 10k 物件）。改用 PostgreSQL JSONB operator
            # 在 SQL 層直接過濾 doc_metadata->>'folderName' 與 'isActive'，
            # 並只 SELECT id 欄位省記憶體。
            from app.models.document import Document
            docs_result = await self.db.execute(
                select(Document.id)
                .where(Document.tenant_id == state.get("tenant_id"))
                # 資料夾是個人的：別人剛好取了同名資料夾，他的文件也不能混進來
                .where(Document.uploaded_by == state.get("user_id"))
                .where(Document.doc_metadata["folderName"].astext == folder_name)
                # isActive 預設 True：欄位不存在或為 'true' 都算啟用
                .where(
                    or_(
                        Document.doc_metadata["isActive"].astext == "true",
                        Document.doc_metadata["isActive"].astext.is_(None),
                    )
                )
            )
            document_ids = [row[0] for row in docs_result.all()]

        # C1: 使用 Hybrid Search（向量 + 關鍵字 re-rank），
        # 提高中文專有名詞與代號（例如 SOP 編號、人名）的命中率。
        # 路由時已經搜過（一般對話用連接資料夾）就直接用
        search_results = state.get("prefetched") or await self.rag_service.hybrid_search(
            db=self.db,
            query=state.get("query", ""),
            tenant_id=state.get("tenant_id"),
            n_results=settings.rag_top_k,
            document_ids=document_ids,
            similarity_threshold=settings.rag_similarity_threshold,
        )

        # ─────────────────────────────────────────────────────────────
        # FIX: 「每個檔案至少貢獻一個 chunk」覆蓋保證（安全版）
        # ─────────────────────────────────────────────────────────────
        # Bug 場景：勾 5 個檔案，top-K=5 chunks 可能全部來自單一檔案，
        # 前端顯示「參考來源 (1)」 → 體感「AI 只讀了 1 個檔案」。
        #
        # 補丁設計：
        #   1) 用 search()（純向量）而不是 hybrid_search()，省掉 keyword
        #      regex pass，每個 missing doc 只多打一次 SQL，毫秒級。
        #   2) 上限 3 個 missing（之前 10 容易把 backend 拖到 timeout）。
        #   3) try/except 包整個 block：補搜失敗也不影響主流程，至少
        #      讓 LLM 拿到主搜尋的結果回答。
        #   4) asyncio.wait_for 個別 timeout 1.5s，單個慢不拖整體。
        # ─────────────────────────────────────────────────────────────
        if document_ids and len(document_ids) > 1:
            try:
                import asyncio
                covered_doc_ids: set[str] = {
                    r["metadata"].get("document_id")
                    for r in search_results
                    if r.get("metadata", {}).get("document_id")
                }
                missing_doc_ids = [d for d in document_ids if d not in covered_doc_ids]

                # 補搜共用同一個 query embedding，避免每個 missing doc 都重新 encode
                # （SentenceTransformer.encode() 是 CPU 密集型，3 個 doc 重複算就是 3x 成本）
                shared_embedding = None
                if missing_doc_ids:
                    try:
                        shared_embedding = await asyncio.wait_for(
                            self.rag_service.get_embedding(state.get("query", "")),
                            timeout=2.0,
                        )
                    except (asyncio.TimeoutError, Exception) as e:
                        logger.warning(f"per-doc fallback embedding 計算失敗: {e}")

                # FIX: 拿掉 [:3] 上限 + 改用 asyncio.gather 平行跑。
                # 原本串行 + 上限 3 → 勾 5 個檔只補到 4 個，使用者抱怨「只讀 3 個」。
                # 平行後：總耗時 ≈ 單個 timeout（1.5s），不是 N × 1.5s。
                # 50 個是 sanity guard，正常使用情境不會碰到。
                async def _fetch_one(doc_id: str) -> list:
                    try:
                        return await asyncio.wait_for(
                            self.rag_service.search(
                                db=self.db,
                                query=state.get("query", ""),
                                tenant_id=state.get("tenant_id"),
                                n_results=1,
                                document_ids=[doc_id],
                                similarity_threshold=0.0,
                                precomputed_embedding=shared_embedding,
                            ),
                            timeout=1.5,
                        )
                    except asyncio.TimeoutError:
                        logger.warning(f"per-doc fallback timeout for {doc_id}, skipped")
                        return []
                    except Exception as e:
                        logger.warning(f"per-doc fallback failed for {doc_id}: {e}")
                        return []

                fallback_results = await asyncio.gather(
                    *[_fetch_one(did) for did in missing_doc_ids[:50]]
                )
                for extra in fallback_results:
                    search_results.extend(extra)
            except Exception as e:
                logger.error(f"per-doc coverage 補搜整段失敗（已 fallback 主搜尋結果）: {e}")

        if search_results:
            # FIX: 去重 by chunk_id（hybrid_search 主搜 + per-doc fallback 可能命中同一個 chunk）
            # 同個 chunk 重複丟給 LLM 會浪費 context，前端 sources 列表也會出現重複條目
            seen_chunk_ids: set[str] = set()
            unique_results = []
            for r in search_results:
                cid = r.get("chunk_id")
                if cid and cid not in seen_chunk_ids:
                    seen_chunk_ids.add(cid)
                    unique_results.append(r)
            search_results = unique_results

            # 送模型前最後一關：藏指令或含違禁詞的片段不送、個資遮罩（來源預覽也用遮罩後的內容）
            search_results, screen = screen_chunks(search_results)

            context = self.rag_service.build_context(search_results) if search_results else ""
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
            return {"context": context, "sources": sources, "screen": screen}
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
            tenant_id=user.effective_tenant_id,
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
            limit: 最大數量（會被強制 clamp 在 1-200 之間，避免外部呼叫者
                   不小心傳 10000+ 把整段對話載入記憶體爆爛）

        Returns:
            list[Message]: 訊息列表
        """
        # 防呆：clamp 到合理範圍。下界 1（避免 limit<=0 變成「全部」），
        # 上界 200（一般 LLM context 已經吃不下這麼多訊息了）。
        limit = max(1, min(int(limit or 0) or 50, 200))
        result = await self.db.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def _prepare_prompt(
        self,
        conversation_id: str,
        content: str,
        use_rag: bool,
        language: str,
        extra_system: str = "",
    ) -> tuple[str, str, list, str]:
        """
        extra_system：這一題額外加在系統提示後面的說明（例如「請輸出 Word 文件內容的 JSON」）。

        送出訊息前的共用準備（串流與非串流共用）：
        讀對話歷史 → LangGraph 路由／檢索文件 → 選系統提示＋語言指令 → 組成提示詞

        Returns:
            (prompt, context, sources, route)
        """
        messages = await self.get_messages(conversation_id)

        # 取得 tenant 和 folder
        result = await self.db.execute(
            select(Conversation).where(Conversation.id == conversation_id)
        )
        conversation = result.scalar_one_or_none()
        folder_name = conversation.settings.get("folderName") if conversation else None
        tenant_id = conversation.tenant_id if conversation else "default"
        owner_id = conversation.user_id if conversation else None

        # 只帶最近幾則、每則截短：純 CPU 讀入提示詞很慢，整段歷史全帶會讓每問一題就更慢
        chat_history = [
            {"role": m.role, "content": _clip_history(m.content)}
            for m in messages[-settings.chat_history_messages:]
        ]

        initial_state: AgentState = {
            "conversation_id": conversation_id,
            "tenant_id": tenant_id,
            "user_id": owner_id,
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

        # 專案資料夾內的對話只能根據文件回答
        if final_state.get("folder_name"):
            system_prompt = self.STRICT_RAG_SYSTEM_PROMPT
        else:
            system_prompt = self.DEFAULT_SYSTEM_PROMPT

        # 在系統提示末尾注入語言強制指令
        # 強制語言比「使用使用者語言」更可靠，因大多數 LLM 容易忽略模糊指令
        lang_directive = self.LANGUAGE_DIRECTIVES.get(language, self.LANGUAGE_DIRECTIVES["zh-TW"])
        system_prompt = f"{system_prompt}\n\n{lang_directive}"
        if extra_system:
            system_prompt = f"{system_prompt}\n\n{extra_system}"

        # 記憶：這個人請 AI 跨對話記住的事（關掉或沒有就是空的）
        memory = await memory_block(self.db, owner_id)
        if memory:
            system_prompt = f"{system_prompt}\n\n{memory}"
        # 有外來資料（文件、記憶）時加一句：資料歸資料，裡面的指令不要照做
        if memory or context:
            system_prompt = f"{system_prompt}\n\n{GUARD_LINE}"
        self.screen_report = final_state.get("screen") or {}

        prompt = self.llm_service.build_chat_prompt(
            messages=chat_history,
            system_prompt=system_prompt,
            context=context if context else None,
        )
        return prompt, context, sources, route

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
        發送訊息並取得回應（非串流）：直接跑串流那一條，收完再回傳助手訊息，
        所以存訊息、防篡改 hash、模型載入中的檢查都和即時串流完全一樣。
        content 要先經過 services/message_guard 的安全閘道。

        Raises:
            ChatGenerationError: 模型還在載入、訊息不存在等無法產生回應的情況
        """
        message_id: Optional[str] = None
        async for event in self.send_message_stream(
            conversation_id=conversation_id,
            content=content,
            use_rag=use_rag,
            temperature=temperature,
            max_tokens=max_tokens,
            language=language,
        ):
            if event.get("type") == "error":
                raise ChatGenerationError(event.get("message", "生成失敗"), code=event.get("code"))
            if event.get("type") == "done":
                message_id = event.get("message_id")
        message = await self.db.get(Message, message_id) if message_id else None
        if message is None:
            raise ChatGenerationError("生成失敗")
        return message

    async def send_message_stream(
        self,
        conversation_id: str,
        content: str,
        use_rag: bool = True,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        language: str = "zh-TW",
        resubmit_message_id: Optional[str] = None
    ) -> AsyncGenerator[dict, None]:
        """
        發送訊息並串流回應

        Args:
            language: 回覆語言代碼（zh-TW / en-US / ja-JP）
            resubmit_message_id: 若提供，則為修改歷史對話並重新生成
        """
        from app.services.boot_service import is_llm_ready

        if not is_llm_ready():
            yield {
                "type": "error",
                "message": "AI 模型仍在載入中，請稍候再試",
                "code": "LLM_LOADING",
            }
            return

        if resubmit_message_id:
            from sqlalchemy import delete
            # 尋找並更新使用者訊息
            result = await self.db.execute(select(Message).where(Message.id == resubmit_message_id))
            user_message = result.scalar_one_or_none()
            # 只能重送「這個對話裡的使用者訊息」：否則會改寫別的對話的紀錄，
            # 並用那則訊息的時間去刪除這個對話後面的訊息
            if (
                not user_message
                or user_message.conversation_id != conversation_id
                or user_message.role != MessageRole.USER.value
            ):
                # NOTE: 訊息不存在（可能是 temp ID）或不屬於此對話，返回錯誤避免改錯資料
                yield {"type": "error", "message": "訊息不存在，無法重新生成"}
                return
            user_message.content = content
            # 截斷後續所有訊息
            await self.db.execute(
                delete(Message).where(
                    Message.conversation_id == conversation_id,
                    Message.created_at > user_message.created_at
                )
            )
            await self.db.commit()
        else:
            # 儲存新使用者訊息
            user_message = Message(
                conversation_id=conversation_id,
                role=MessageRole.USER.value,
                content=content,
            )
            self.db.add(user_message)
            await self.db.commit()
            await self.db.refresh(user_message)
            # B2: 對使用者訊息蓋上 hash stamp
            await stamp_message(self.db, user_message, conversation_id)
            await self.db.commit()

        # ── A1/A2 安全閘道由上層 websocket.py 的 _security_gate() 統一處理 ────────
        # BUG-07 修正：此處不再重複執行 PII masking / Prompt Injection 偵測，
        # 避免對已遮罩的文字再次遮罩，以及重複發送 warning 事件給前端。
        # 直接使用 content（外部已完成安全處理的版本）作為 safe_content。
        safe_content = content

        # 記憶：這句話是在交代「記住……」就先存起來（這一題的回答就用得到）
        async for event in self._remember(conversation_id, safe_content):
            yield event

        # 使用者要的是一份檔案（Word／Excel／簡報）嗎：是的話這一題改走「產出檔案」
        file_kind = file_builder.detect_file_request(safe_content) if settings.enable_file_generation else None

        prompt, context, sources, route = await self._prepare_prompt(
            conversation_id, safe_content, use_rag, language,
            extra_system=file_builder.INSTRUCTIONS[file_kind] if file_kind else "",
        )

        # 送模型前最後一關：有文件片段被剔除或遮罩 → 寫稽核、告訴使用者
        if not report_is_empty(self.screen_report):
            yield await self._report_screen(conversation_id)

        if file_kind:
            async for event in self._make_file(conversation_id, file_kind, prompt, sources, language):
                yield event
            return

        # ── C2: 先發送來源資訊 + RAG 除錯資料 ──────────────────────
        if sources:
            yield {
                "type": "sources",
                "sources": sources,
                "debug": {
                    "route": route,
                    "context_length": len(context),
                    "prompt_length": len(prompt),
                    "chunks_count": len(sources),
                },
            }

        # 串流生成回應
        full_response = ""
        try:
            async for chunk in self.llm_service.generate_stream(
                model_name=self.model_name,
                prompt=prompt,
                temperature=temperature,
                max_tokens=max_tokens,
            ):
                if language == "zh-TW":
                    chunk = to_traditional(chunk)
                full_response += chunk
                yield {
                    "type": "stream",
                    "content": chunk,
                }
        except (asyncio.CancelledError, GeneratorExit):
            # 中途停止（使用者按停止、生成逾時、連線中斷）：已經寫出來的部分存起來，
            # 重新整理或之後再打開對話都還看得到；一個字都還沒寫就不存
            if full_response.strip():
                # shield：存檔途中又收到取消也要存完
                await asyncio.shield(
                    self._save_assistant_message(
                        conversation_id, full_response + stopped_note(language), sources
                    )
                )
            raise

        assistant_message = await self._save_assistant_message(conversation_id, full_response, sources)
        yield {
            "type": "done",
            "message_id": assistant_message.id,
        }

    # 產出檔案後回給使用者的話（三種語言；{name} 檔名、{items} 大綱）
    FILE_REPLY = {
        "zh-TW": ("已經做好了：**{name}**", "內容大綱：", "可以在下方下載。內容由 AI 產生，數字、人名、日期請核對後再使用；需要調整再跟我說。", "這次沒有成功做出檔案：內容可能太長或太複雜。請把範圍說得小一點（例如指定幾個章節、幾張投影片）再試一次。"),
        "en-US": ("Done: **{name}**", "Outline:", "You can download it below. The content is AI-generated, so please check numbers, names and dates before using it. Tell me if you want changes.", "I could not produce the file this time. The content may be too long or complex. Please narrow the scope (for example, the number of sections or slides) and try again."),
        "ja-JP": ("できました：**{name}**", "内容の概要：", "下からダウンロードできます。内容は AI が生成したものです。数値・人名・日付は確認してからご利用ください。修正があれば教えてください。", "今回はファイルを作成できませんでした。内容が長すぎるか複雑すぎる可能性があります。範囲を絞って（章やスライドの数を指定するなど）もう一度お試しください。"),
    }

    async def _make_file(self, conversation_id: str, kind: str, prompt, sources: list, language: str) -> AsyncGenerator[dict, None]:
        """
        產出檔案：模型用限定格式寫內容（JSON）→ 程式排版成檔案 → 存檔、掛在這則回答下面。
        事件：file_progress（開始做，前端顯示「正在製作…」）→ stream（回答文字）→ attachments（檔案卡片）→ done
        """
        done_text, outline_text, hint_text, failed_text = self.FILE_REPLY.get(language, self.FILE_REPLY["zh-TW"])
        yield {"type": "file_progress", "kind": kind}

        spec = await self.llm_service.generate_structured(
            prompt, file_builder.SCHEMAS[kind], max_tokens=settings.file_max_tokens, temperature=0.4, model_name=self.model_name,
        )
        if language == "zh-TW":
            spec = _to_traditional_deep(spec)

        if not file_builder.spec_is_usable(kind, spec):
            # 內容被長度上限切斷或格式壞掉：照實說，不交一份空殼檔案
            yield {"type": "stream", "content": failed_text}
            message = await self._save_assistant_message(conversation_id, failed_text, sources)
            yield {"type": "done", "message_id": message.id}
            return

        data = await asyncio.to_thread(file_builder.build_file, kind, spec)
        filename = file_builder.safe_filename(spec.get("title") or "", kind)
        lines = [done_text.format(name=filename)]
        items = file_builder.outline(kind, spec)
        if items:
            lines += ["", outline_text] + [f"- {x}" for x in items]
        lines += ["", hint_text]
        reply = "\n".join(lines)

        yield {"type": "stream", "content": reply}
        message = await self._save_assistant_message(conversation_id, reply, sources)
        user_id, tenant_id = await self._conversation_owner(conversation_id)
        row = await generated_files.save_file(
            self.db, user_id=user_id, tenant_id=tenant_id, conversation_id=conversation_id,
            message_id=message.id, kind=kind, title=spec.get("title") or "", data=data,
        )
        try:
            await write_audit_log(
                db=self.db, action=AuditAction.FILE_CREATE, resource_type=AuditResource.FILE, resource_id=row.id,
                user_id=user_id, tenant_id=tenant_id, description=f"AI 產出檔案：{row.filename}",
                details={"kind": kind, "size": row.size, "conversation_id": conversation_id},
            )
        except Exception as e:  # 稽核失敗不能擋住主流程
            logger.warning("產出檔案寫稽核失敗: %s", e)
        yield {"type": "attachments", "message_id": message.id, "attachments": [generated_files.to_attachment(row)]}
        yield {"type": "done", "message_id": message.id}

    async def _conversation_owner(self, conversation_id: str) -> tuple[Optional[str], Optional[str]]:
        row = (await self.db.execute(
            select(Conversation.user_id, Conversation.tenant_id).where(Conversation.id == conversation_id)
        )).first()
        return (row[0], row[1]) if row else (None, None)

    async def _remember(self, conversation_id: str, content: str) -> AsyncGenerator[dict, None]:
        """
        使用者說「記住……」：過安全檢查後存成記憶，回一個事件給前端（memory_saved／memory_rejected）。
        不是在交代記憶、或記憶功能關掉了，就什麼都不做。
        """
        body = extract_remember(content)
        if not body:
            return
        user_id, tenant_id = await self._conversation_owner(conversation_id)
        if not user_id or not await memory_is_enabled(self.db, user_id):
            return
        clean, reason = screen_text(body)
        try:
            if clean is None:
                await write_audit_log(
                    db=self.db, action=AuditAction.MEMORY_REJECTED, resource_type=AuditResource.MEMORY,
                    resource_id=conversation_id, user_id=user_id, tenant_id=tenant_id,
                    description="記憶內容未通過安全檢查，沒有儲存", details={"reason": reason},
                )
                yield {"type": "memory_rejected", "reason": reason}
                return
            row, created = await add_memory(self.db, user_id, clean, MemorySource.CHAT, conversation_id)
            if created:
                await write_audit_log(
                    db=self.db, action=AuditAction.MEMORY_CREATE, resource_type=AuditResource.MEMORY,
                    resource_id=row.id, user_id=user_id, tenant_id=tenant_id,
                    description="在對話裡請 AI 記住一件事", details={"source": MemorySource.CHAT, "length": len(row.content)},
                )
            yield {"type": "memory_saved", "id": row.id, "content": row.content, "created": created}
        except MemoryLimitError:
            yield {"type": "memory_rejected", "reason": "limit"}
        except Exception as e:  # 記憶存不成不能擋住回答
            logger.warning("儲存記憶失敗: %s", e)

    async def _report_screen(self, conversation_id: str) -> dict:
        """文件片段被剔除／遮罩：寫一筆稽核，回給前端的提示事件"""
        report = self.screen_report
        counts = {"injection": len(report.get("injection", [])), "dlp": len(report.get("dlp", [])), "pii": int(report.get("pii", 0))}
        try:
            user_id, tenant_id = await self._conversation_owner(conversation_id)
            await write_audit_log(
                db=self.db, action=AuditAction.CONTEXT_FILTERED, resource_type=AuditResource.DOCUMENT,
                resource_id=conversation_id, user_id=user_id, tenant_id=tenant_id,
                description=f"文件內容送模型前已過濾：可疑指令 {counts['injection']} 段、違禁詞 {counts['dlp']} 段、個資遮罩 {counts['pii']} 個",
                details={**counts, "injection_documents": sorted(set(report.get("injection", [])))[:20], "dlp_documents": sorted(set(report.get("dlp", [])))[:20]},
            )
        except Exception as e:  # 稽核失敗不能擋住主流程
            logger.warning("最後一關寫稽核失敗: %s", e)
        return {"type": "context_filtered", **counts}

    async def _save_assistant_message(
        self, conversation_id: str, content: str, sources: Optional[list]
    ) -> Message:
        """存助手訊息：蓋防竄改 hash、更新對話的訊息數與更新時間（完整回答和中途停止共用）"""
        assistant_message = Message(
            conversation_id=conversation_id,
            role=MessageRole.ASSISTANT.value,
            content=content,
            sources=sources if sources else None,
        )
        self.db.add(assistant_message)
        await self.db.commit()
        await self.db.refresh(assistant_message)
        # B2: 對助手訊息蓋上 hash stamp
        await stamp_message(self.db, assistant_message, conversation_id)
        await self.db.commit()

        # 依據實際 DB 訊息數量更新對話統計（resubmit 後新增數可能不是 +2）
        msg_count_result = await self.db.execute(
            select(func.count(Message.id)).where(Message.conversation_id == conversation_id)
        )
        actual_count = msg_count_result.scalar_one_or_none() or 0
        await self.db.execute(
            update(Conversation)
            .where(Conversation.id == conversation_id)
            .values(
                message_count=actual_count,
                updated_at=utc_now_naive(),
            )
        )
        await self.db.commit()
        return assistant_message
