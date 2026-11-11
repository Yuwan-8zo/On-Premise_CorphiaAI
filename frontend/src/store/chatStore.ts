/**
 * 對話 Store (Zustand)
 *
 * 多工：每個對話各自有訊息與「生成中」狀態，可以同時進行、在背景繼續跑
 *   - messages＝畫面上這個對話的訊息；threads＝切到背景、還在生成的對話的訊息
 *   - streamingIds＝哪些對話正在生成；isStreaming＝畫面上這個對話是否在生成（跟著切換）
 *   - 背景收到的字用 appendToThread(convId) 寫進該對話自己的訊息，切回來時接著顯示
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
    /** 切到背景、還在生成的對話的訊息（畫面上的對話只放在 messages） */
    threads: Record<string, Message[]>
    /** 正在生成的對話 */
    streamingIds: Record<string, boolean>

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
    /** 設定「畫面上這個對話」是否在生成 */
    setStreaming: (streaming: boolean) => void
    /** 設定指定對話是否在生成（背景對話也可以） */
    setStreamingFor: (conversationId: string, streaming: boolean) => void
    /** 把字接到指定對話的最後一則訊息（畫面上或背景都可以） */
    appendToThread: (conversationId: string, content: string) => void
    /** 設定指定對話最後一則訊息的來源引用 */
    setSourcesForThread: (conversationId: string, sources: MessageSource[]) => void
    /** 改寫指定對話的訊息（畫面上或背景都可以） */
    updateThread: (conversationId: string, fn: (messages: Message[]) => Message[]) => void
    setLoading: (loading: boolean) => void
    appendToLastMessage: (content: string) => void
    setSourcesToLastMessage: (sources: MessageSource[]) => void
    clearMessages: () => void
    addSecurityWarning: (warning: SecurityWarning) => void
    clearSecurityWarnings: () => void
    setRAGDebug: (debug: RAGDebugInfo | null) => void
}

/** 對指定對話的訊息做修改：畫面上的改 messages，背景的改 threads */
const onThread = (state: ChatState, convId: string, fn: (messages: Message[]) => Message[]): Partial<ChatState> =>
    state.currentConversation?.id === convId
        ? { messages: fn(state.messages) }
        : state.threads[convId]
            ? { threads: { ...state.threads, [convId]: fn(state.threads[convId]) } }
            : {}

const appendLast = (content: string) => (messages: Message[]) => {
    if (messages.length === 0) return messages
    const out = [...messages]
    const last = out[out.length - 1]
    out[out.length - 1] = { ...last, content: last.content + content }
    return out
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
    threads: {},
    streamingIds: {},
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
            const threads = { ...state.threads }
            delete threads[id]
            const streamingIds = { ...state.streamingIds }
            delete streamingIds[id]
            return {
                conversations: state.conversations.filter((c) => c.id !== id),
                currentConversation: isCurrent ? null : state.currentConversation,
                messages: isCurrent ? [] : state.messages,
                isStreaming: isCurrent ? false : state.isStreaming,
                threads,
                streamingIds,
            }
        }),

    // 設定當前對話
    // 切換對話：還在生成的舊對話把訊息收到背景（threads），切到背景中的對話就把它的訊息拿回畫面
    setCurrentConversation: (conversation) =>
        set((state) => {
            const prev = state.currentConversation?.id
            const next = conversation?.id
            if (prev === next) return { currentConversation: conversation }
            const threads = { ...state.threads }
            if (prev && state.streamingIds[prev]) threads[prev] = state.messages
            const restored = next ? threads[next] : undefined
            if (next) delete threads[next]
            return {
                currentConversation: conversation,
                threads,
                messages: restored ?? [],
                isStreaming: Boolean(next && state.streamingIds[next]),
            }
        }),

    // 設定訊息列表
    setMessages: (messages) => set({ messages }),

    setServerMessages: (conversationId, messages) =>
        set((state) => {
            if (state.currentConversation?.id !== conversationId) return {} // 已經切到別的對話
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
    setStreaming: (streaming) =>
        set((state) => {
            const id = state.currentConversation?.id
            return { isStreaming: streaming, streamingIds: id ? { ...state.streamingIds, [id]: streaming } : state.streamingIds }
        }),

    setStreamingFor: (conversationId, streaming) =>
        set((state) => {
            const streamingIds = { ...state.streamingIds, [conversationId]: streaming }
            if (!streaming) delete streamingIds[conversationId]
            const isCurrent = state.currentConversation?.id === conversationId
            // 背景對話生成完：丟掉暫存，下次點開從後端重新載入完整紀錄
            const threads = { ...state.threads }
            if (!streaming && !isCurrent) delete threads[conversationId]
            return { streamingIds, threads, ...(isCurrent ? { isStreaming: streaming } : {}) }
        }),

    appendToThread: (conversationId, content) => set((state) => onThread(state, conversationId, appendLast(content))),

    setSourcesForThread: (conversationId, sources) =>
        set((state) =>
            onThread(state, conversationId, (messages) => {
                if (messages.length === 0) return messages
                const out = [...messages]
                out[out.length - 1] = { ...out[out.length - 1], sources }
                return out
            }),
        ),

    updateThread: (conversationId, fn) => set((state) => onThread(state, conversationId, fn)),

    // 設定載入狀態
    setLoading: (loading) => set({ isLoading: loading }),

    // 追加內容到最後一則訊息 (串流用)
    appendToLastMessage: (content) => set((state) => ({ messages: appendLast(content)(state.messages) })),

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
