/**
 * 對話 API
 */

import apiClient from './client'
import type {
    Conversation,
    ConversationListResponse,
    Message
} from '../types/chat'

export const conversationsApi = {
    /**
     * 取得對話列表
     */
    list: async (page: number = 1, pageSize: number = 20): Promise<ConversationListResponse> => {
        const response = await apiClient.get('/conversations', {
            params: { page, page_size: pageSize },
        })
        return response.data
    },

    /**
     * 建立新對話
     */
    create: async (title?: string, model?: string): Promise<Conversation> => {
        const response = await apiClient.post('/conversations', {
            title,
            model,
        })
        return response.data
    },

    /**
     * 取得對話詳情
     */
    get: async (id: string): Promise<Conversation> => {
        const response = await apiClient.get(`/conversations/${id}`)
        return response.data
    },

    /**
     * 更新對話
     */
    update: async (id: string, data: Partial<Conversation>): Promise<Conversation> => {
        const response = await apiClient.put(`/conversations/${id}`, data)
        return response.data
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
    getMessages: async (id: string): Promise<Message[]> => {
        const response = await apiClient.get(`/conversations/${id}/messages`)
        return response.data
    },
}
