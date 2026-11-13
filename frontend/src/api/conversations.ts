/**
 * 對話 API
 */

import apiClient from './client'
import type { Conversation, Message } from '../types/chat'
import { DEFAULT_CONVERSATION_TITLE } from '@/lib/conversationTitle'

export interface CreateConversationRequest {
    title?: string
    model?: string
    settings?: Record<string, unknown>
}

export interface SendMessageRequest {
    content: string
    useRag?: boolean
    webSearch?: boolean
}

export const conversationsApi = {
    /**
     * 取得對話列表
     */
    list: async (page = 1, pageSize = 20, search?: string): Promise<{ data: Conversation[]; total: number }> => {
        const response = await apiClient.get('/conversations', {
            // search：找標題或訊息內容裡有這段字的對話
            params: { page, page_size: pageSize, ...(search ? { search } : {}) },
        })
        return {
            data: response.data.data.map(mapConversation),
            total: response.data.total,
        }
    },

    /**
     * 建立新對話
     */
    create: async (data: CreateConversationRequest = {}): Promise<Conversation> => {
        const response = await apiClient.post('/conversations', {
            title: data.title || DEFAULT_CONVERSATION_TITLE,
            model: data.model || 'default',
            settings: data.settings || {},
        })
        return mapConversation(response.data)
    },

    /**
     * 取得單一對話
     */
    get: async (id: string): Promise<Conversation> => {
        const response = await apiClient.get(`/conversations/${id}`)
        return mapConversation(response.data)
    },

    /**
     * 更新對話
     */
    update: async (id: string, data: Partial<CreateConversationRequest>): Promise<Conversation> => {
        const response = await apiClient.put(`/conversations/${id}`, data)
        return mapConversation(response.data)
    },

    /**
     * 刪除對話
     */
    delete: async (id: string): Promise<void> => {
        await apiClient.delete(`/conversations/${id}`)
    },

    /**
     * 取得對話訊息
     */
    getMessages: async (conversationId: string, options?: { beforeId?: string }): Promise<Message[]> => {
        const response = await apiClient.get(`/conversations/${conversationId}/messages`, {
            params: { before_id: options?.beforeId }
        })
        return response.data.map(mapMessage)
    },

    /**
     * 發送訊息（非串流）
     */
    sendMessage: async (conversationId: string, data: SendMessageRequest): Promise<Message> => {
        const response = await apiClient.post(`/messages/${conversationId}`, {
            content: data.content,
            use_rag: data.useRag ?? true,
            web_search: data.webSearch ?? false,
        })
        return mapMessage(response.data)
    },

    /**
     * 更新訊息內容
     */
    updateMessageText: async (messageId: string, content: string): Promise<Message> => {
        const response = await apiClient.put(`/messages/${messageId}`, {
            content,
        })
        return mapMessage(response.data)
    },

    /**
     * 驗證對話完整性
     */
    /**
     * 開啟分享（同租戶的人拿到連結可以唯讀觀看）
     */
    share: async (conversationId: string): Promise<void> => {
        await apiClient.post(`/conversations/${conversationId}/share`)
    },

    /**
     * 關閉分享
     */
    unshare: async (conversationId: string): Promise<void> => {
        await apiClient.delete(`/conversations/${conversationId}/share`)
    },

    /**
     * 分享頁：唯讀讀取對話與全部訊息（主人，或已分享且同租戶的人）
     */
    getShared: async (conversationId: string): Promise<{ conversation: Conversation; messages: Message[]; ownerName: string; isOwner: boolean }> => {
        const response = await apiClient.get(`/conversations/${conversationId}/shared`)
        return {
            conversation: mapConversation(response.data.conversation),
            messages: response.data.messages.map(mapMessage),
            ownerName: response.data.owner_name,
            isOwner: response.data.is_owner,
        }
    },

    verifyChain: async (conversationId: string): Promise<{ valid: boolean; total_messages: number; first_broken_index: number | null }> => {
        const response = await apiClient.get(`/conversations/${conversationId}/verify-chain`)
        return response.data
    },
}

// 轉換函數
function mapConversation(data: Record<string, unknown>): Conversation {
    return {
        id: data.id as string,
        title: data.title as string,
        model: data.model as string,
        messageCount: data.message_count as number,
        totalTokens: data.total_tokens as number,
        isPinned: data.is_pinned as boolean,
        isArchived: data.is_archived as boolean,
        folderId: data.folder_id as string | undefined,
        settings: (data.settings as Record<string, unknown>) || {},
        createdAt: data.created_at as string,
        updatedAt: data.updated_at as string,
    }
}

function mapMessage(data: Record<string, unknown>): Message {
    return {
        id: data.id as string,
        role: data.role as 'user' | 'assistant' | 'system',
        content: data.content as string,
        tokens: data.tokens as number,
        sources: data.sources as Message['sources'],
        attachments: (data.attachments as Message['attachments']) ?? undefined,
        rating: data.rating as number | undefined,
        content_hash: data.content_hash as string | undefined,
        prev_hash: data.prev_hash as string | undefined,
        reasoning: (data.reasoning as string | null) ?? undefined,
        webSearch: (data.web_search as Message['webSearch'] | null) ?? undefined,
        createdAt: data.created_at as string,
    }
}
