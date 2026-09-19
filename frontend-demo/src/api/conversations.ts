/**
 * Mock Conversations API — 補齊所有 frontend 元件用到的方法
 */

import { DEMO_CONVERSATIONS } from '../demo/mockData'
import type { Conversation } from '@/types/chat'

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

let conversations: Conversation[] = [...DEMO_CONVERSATIONS]

export const conversationsApi = {
    list: async (_params?: unknown) => {
        await sleep(200)
        return { data: conversations, total: conversations.length }
    },

    /** SharePage 用 */
    get: async (id: string) => {
        await sleep(200)
        return conversations.find((c) => c.id === id) || conversations[0]
    },

    create: async (payload: { title: string; settings?: Record<string, unknown> }) => {
        await sleep(300)
        const conv: Conversation = {
            id: `demo-conv-${Date.now()}`,
            title: payload.title || '新對話',
            model: 'qwen2.5-7b-instruct-q4_k_m',
            messageCount: 0,
            totalTokens: 0,
            isPinned: false,
            isArchived: false,
            settings: payload.settings || {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }
        conversations = [conv, ...conversations]
        return conv
    },

    update: async (id: string, data: Partial<Conversation>) => {
        await sleep(200)
        conversations = conversations.map((c) =>
            c.id === id ? { ...c, ...data, updatedAt: new Date().toISOString() } : c
        )
        return conversations.find((c) => c.id === id) || conversations[0]
    },

    delete: async (id: string) => {
        await sleep(200)
        conversations = conversations.filter((c) => c.id !== id)
        return { success: true }
    },

    getMessages: async (_id: string, _params?: unknown) => {
        await sleep(300)
        return []
    },

    sendMessage: async (_id: string, _payload: unknown) => {
        await sleep(500)
        return {
            id: `msg-${Date.now()}`,
            role: 'assistant' as const,
            content: '',
            tokens: 0,
            createdAt: new Date().toISOString(),
        }
    },

    /** MessageBubble 用 — 更新訊息文字 */
    updateMessageText: async (_convId: string, _msgId: string, _text: string) => {
        await sleep(200)
        return { success: true }
    },

    verifyChain: async (_id: string) => {
        await sleep(600)
        return {
            valid: true,
            total_messages: 8,
            first_broken_index: null,  // useChatLogic 會讀這個
        }
    },

    /** Share page 用 */
    getSharedConversation: async (id: string) => {
        await sleep(300)
        return conversations.find((c) => c.id === id) || conversations[0]
    },
}
