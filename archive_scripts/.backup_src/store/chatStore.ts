/**
<<<<<<< HEAD
 * Chat Store (Zustand)
 *
 * 管理對話狀態：對話列表、當前對話、訊息、串流狀態
 */

import { create } from 'zustand'
import type { Message, Conversation } from '../types/chat'
=======
 * 對話 Store (Zustand)
 */

import { create } from 'zustand'
import type { Conversation, Message } from '../types/chat'
>>>>>>> 1432944 (feat(init): 建立 Corphia AI Platform v2.2 基礎架構)

interface ChatState {
    // 狀態
    conversations: Conversation[]
    currentConversation: Conversation | null
    messages: Message[]
    isStreaming: boolean
<<<<<<< HEAD

    // 對話操作
    setConversations: (conversations: Conversation[]) => void
    addConversation: (conversation: Conversation) => void
    setCurrentConversation: (conversation: Conversation | null) => void
    removeConversation: (id: string) => void

    // 訊息操作
    setMessages: (messages: Message[]) => void
    addMessage: (message: Message) => void
    appendToLastMessage: (content: string) => void
    clearMessages: () => void

    // 串流狀態
    setStreaming: (streaming: boolean) => void
=======
    isLoading: boolean

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
    clearMessages: () => void
>>>>>>> 1432944 (feat(init): 建立 Corphia AI Platform v2.2 基礎架構)
}

export const useChatStore = create<ChatState>()((set) => ({
    // 初始狀態
    conversations: [],
    currentConversation: null,
    messages: [],
    isStreaming: false,
<<<<<<< HEAD
=======
    isLoading: false,
>>>>>>> 1432944 (feat(init): 建立 Corphia AI Platform v2.2 基礎架構)

    // 設定對話列表
    setConversations: (conversations) => set({ conversations }),

<<<<<<< HEAD
    // 新增對話到列表
=======
    // 新增對話
>>>>>>> 1432944 (feat(init): 建立 Corphia AI Platform v2.2 基礎架構)
    addConversation: (conversation) =>
        set((state) => ({
            conversations: [conversation, ...state.conversations],
        })),

<<<<<<< HEAD
=======
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

>>>>>>> 1432944 (feat(init): 建立 Corphia AI Platform v2.2 基礎架構)
    // 設定當前對話
    setCurrentConversation: (conversation) =>
        set({ currentConversation: conversation }),

<<<<<<< HEAD
    // 移除對話
    removeConversation: (id) =>
        set((state) => ({
            conversations: state.conversations.filter((c) => c.id !== id),
            currentConversation:
                state.currentConversation?.id === id
                    ? null
                    : state.currentConversation,
        })),

    // 設定訊息列表
    setMessages: (messages) => set({ messages }),

    // 新增單一訊息
=======
    // 設定訊息列表
    setMessages: (messages) => set({ messages }),

    // 新增訊息
>>>>>>> 1432944 (feat(init): 建立 Corphia AI Platform v2.2 基礎架構)
    addMessage: (message) =>
        set((state) => ({
            messages: [...state.messages, message],
        })),

<<<<<<< HEAD
    // 串流接收時，附加內容到最後一條助手訊息
    appendToLastMessage: (content) =>
        set((state) => {
            const messages = [...state.messages]
            if (messages.length === 0) return { messages }
            const last = messages[messages.length - 1]
            messages[messages.length - 1] = {
                ...last,
                content: last.content + content,
=======
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
>>>>>>> 1432944 (feat(init): 建立 Corphia AI Platform v2.2 基礎架構)
            }
            return { messages }
        }),

<<<<<<< HEAD
    // 清空訊息
    clearMessages: () => set({ messages: [] }),

    // 設定串流狀態
    setStreaming: (isStreaming) => set({ isStreaming }),
=======
    // 清除訊息
    clearMessages: () => set({ messages: [] }),
>>>>>>> 1432944 (feat(init): 建立 Corphia AI Platform v2.2 基礎架構)
}))
