/**
 * 對話 Store (Zustand)
 */

import { create } from 'zustand'
import type { Conversation, Message, MessageSource } from '../types/chat'

interface SecurityWarning {
    type: 'pii' | 'injection'
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

    // 動作
    setConversations: (conversations: Conversation[]) => void
    addConversation: (conversation: Conversation) => void
    updateConversation: (id: string, data: Partial<Conversation>) => void
    deleteConversation: (id: string) => void
    setCurrentConversation: (conversation: Conversation | null) => void
    setMessages: (messages: Message[]) => void
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
    deleteConversation: (id) =>
        set((state) => ({
            conversations: state.conversations.filter((c) => c.id !== id),
            currentConversation:
                state.currentConversation?.id === id ? null : state.currentConversation,
        })),

    // 設定當前對話
    setCurrentConversation: (conversation) =>
        set({ currentConversation: conversation }),

    // 設定訊息列表
    setMessages: (messages) => set({ messages }),

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
