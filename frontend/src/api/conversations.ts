/**
 * 對話 API
 */

import apiClient from './client'
import type { Conversation, Message } from '../types/chat'

export interface CreateConversationRequest {
    title?: string
    model?: string
    settings?: Record<string, unknown>
}

export interface SendMessageRequest {
    content: string
    useRag?: boolean
}

export const conversationsApi = {
    /**
     * 取得對話列表
     */
    list: async (page = 1, pageSize = 20): Promise<{ data: Conversation[]; total: number }> => {
        const response = await apiClient.get('/conversations', {
            params: { page, page_size: pageSize },
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
            title: data.title || '新對話',
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
    getMessages: async (conversationId: string): Promise<Message[]> => {
        const response = await apiClient.get(`/conversations/${conversationId}/messages`)
        return response.data.map(mapMessage)
    },

    /**
     * 發送訊息（非串流）
     */
    sendMessage: async (conversationId: string, data: SendMessageRequest): Promise<Message> => {
        const response = await apiClient.post(`/messages/${conversationId}`, {
            content: data.content,
            use_rag: data.useRag ?? true,
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
        rating: data.rating as number | undefined,
        createdAt: data.created_at as string,
    }
}
