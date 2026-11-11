/**
 * 對話 Store (Zustand)
 */

import { create } from 'zustand'
import type { Conversation, Message, MessageSource } from '../types/chat'

interface SecurityWarning {
    type: 'pii' | 'injection' | 'dlp'
    message: string
    data: Record<string, unknown>
    timestamp: number
}

interface RAGDebugInfo {
    route: string
    context_length: number
    prompt_length: number
    chunks_count: number
}

interface ChatState {
    // 狀態
    conversations: Conversation[]
    currentConversation: Conversation | null
    messages: Message[]
    isStreaming: boolean
    isLoading: boolean
    /** A1/A2: 當前對話的安全警告 */
    securityWarnings: SecurityWarning[]
    /** C2: 最近一次 RAG 除錯資訊 */
    ragDebug: RAGDebugInfo | null
    /** 各對話被攔截的訊息（只存在這次開啟的頁面；資料庫不存，所以重新載入時要補回來） */
    blockedByConv: Record<string, Message[]>

    // 動作
    setConversations: (conversations: Conversation[]) => void
    addConversation: (conversation: Conversation) => void
    updateConversation: (id: string, data: Partial<Conversation>) => void
    deleteConversation: (id: string) => void
    setCurrentConversation: (conversation: Conversation | null) => void
    setMessages: (messages: Message[]) => void
    /** 用後端回來的訊息取代畫面，並把這個對話被攔截的訊息插回原位 */
    setServerMessages: (conversationId: string, messages: Message[]) => void
    /** 把最後一組「使用者訊息＋攔截通知」標成已攔截並記下來 */
    markLastExchangeBlocked: () => void
    addMessage: (message: Message) => void
    updateMessage: (id: string, data: Partial<Message>) => void
    setStreaming: (streaming: boolean) => void
    setLoading: (loading: boolean) => void
    appendToLastMessage: (content: string) => void
    setSourcesToLastMessage: (sources: MessageSource[]) => void
    clearMessages: () => void
    addSecurityWarning: (warning: SecurityWarning) => void
    clearSecurityWarnings: () => void
    setRAGDebug: (debug: RAGDebugInfo | null) => void
}

export const useChatStore = create<ChatState>()((set) => ({
    // 初始狀態
    conversations: [],
    currentConversation: null,
    messages: [],
    isStreaming: false,
    isLoading: false,
    securityWarnings: [],
    blockedByConv: {},
    ragDebug: null,

    // 設定對話列表
    setConversations: (conversations) => set({ conversations }),

    // 新增對話
    addConversation: (conversation) =>
        set((state) => ({
            conversations: [conversation, ...state.conversations],
        })),

    // 更新對話
    updateConversation: (id, data) =>
        set((state) => ({
            conversations: state.conversations.map((c) =>
                c.id === id ? { ...c, ...data } : c
            ),
            currentConversation:
                state.currentConversation?.id === id
                    ? { ...state.currentConversation, ...data }
                    : state.currentConversation,
        })),

    // 刪除對話
    // 刪除對話：刪的是目前這則時，連訊息一起清空 → 畫面回到首頁
    deleteConversation: (id) =>
        set((state) => {
            const isCurrent = state.currentConversation?.id === id
            return {
                conversations: state.conversations.filter((c) => c.id !== id),
                currentConversation: isCurrent ? null : state.currentConversation,
                messages: isCurrent ? [] : state.messages,
            }
        }),

    // 設定當前對話
    setCurrentConversation: (conversation) =>
        set({ currentConversation: conversation }),

    // 設定訊息列表
    setMessages: (messages) => set({ messages }),

    setServerMessages: (conversationId, messages) =>
        set((state) => {
            const blocked = state.blockedByConv[conversationId] || []
            if (blocked.length === 0) return { messages }
            // 依「前面有幾則一般訊息」把攔截訊息插回原位（不比較時間，各元件時鐘可能差幾秒）
            const merged: Message[] = []
            const at = (k: number) => blocked.filter((m) => (m.blockedAfter ?? Infinity) === k)
            messages.forEach((m, k) => {
                merged.push(...at(k))
                merged.push(m)
            })
            merged.push(...blocked.filter((m) => (m.blockedAfter ?? Infinity) >= messages.length))
            return { messages: merged }
        }),

    markLastExchangeBlocked: () =>
        set((state) => {
            const convId = state.currentConversation?.id
            const messages = [...state.messages]
            let ai = -1
            let ui = -1
            for (let i = messages.length - 1; i >= 0; i--) {
                if (ai < 0 && messages[i].role === 'assistant') ai = i
                else if (ai >= 0 && messages[i].role === 'user') { ui = i; break }
            }
            if (ai < 0) return {}
            const first = ui >= 0 ? ui : ai
            const after = messages.slice(0, first).filter((m) => !m.blocked).length
            const marked: Message[] = []
            for (const idx of [ui, ai]) {
                if (idx < 0) continue
                messages[idx] = { ...messages[idx], blocked: true, blockedAfter: after }
                marked.push(messages[idx])
            }
            if (!convId) return { messages }
            const prev = (state.blockedByConv[convId] || []).filter((m) => !marked.some((x) => x.id === m.id))
            return { messages, blockedByConv: { ...state.blockedByConv, [convId]: [...prev, ...marked] } }
        }),

    // 新增訊息
    addMessage: (message) =>
        set((state) => ({
            messages: [...state.messages, message],
        })),

    // 更新訊息
    updateMessage: (id, data) =>
        set((state) => ({
            messages: state.messages.map((m) =>
                m.id === id ? { ...m, ...data } : m
            ),
        })),

    // 設定串流狀態
    setStreaming: (streaming) => set({ isStreaming: streaming }),

    // 設定載入狀態
    setLoading: (loading) => set({ isLoading: loading }),

    // 追加內容到最後一則訊息 (串流用)
    appendToLastMessage: (content) =>
        set((state) => {
            const messages = [...state.messages]
            if (messages.length > 0) {
                const lastMessage = messages[messages.length - 1]
                messages[messages.length - 1] = {
                    ...lastMessage,
                    content: lastMessage.content + content,
                }
            }
            return { messages }
        }),

    // 設定最後一則訊息的來源引用 (串流用)
    setSourcesToLastMessage: (sources) =>
        set((state) => {
            const messages = [...state.messages]
            if (messages.length > 0) {
                const lastMessage = messages[messages.length - 1]
                messages[messages.length - 1] = {
                    ...lastMessage,
                    sources,
                }
            }
            return { messages }
        }),

    // 清除訊息
    clearMessages: () => set({ messages: [] }),

    // A1/A2: 新增安全警告
    addSecurityWarning: (warning) =>
        set((state) => ({
            securityWarnings: [...state.securityWarnings, warning],
        })),

    // 清除安全警告（切換對話時）
    clearSecurityWarnings: () => set({ securityWarnings: [] }),

    // C2: 設定 RAG 除錯資訊
    setRAGDebug: (debug) => set({ ragDebug: debug }),
}))
