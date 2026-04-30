/**
 * 系統管理 API
 */

import apiClient from './client'

export interface AdminStats {
    totalUsers: number
    totalConversations: number
    totalDocuments: number
    totalMessages: number
}

interface AdminStatsResponse {
    status: 'success' | 'error'
    data: AdminStats
}

export const adminApi = {
    /**
     * 取得系統使用統計（使用者、對話、文件、訊息總數）
     */
    getStats: async (): Promise<AdminStats | null> => {
        const response = await apiClient.get<AdminStatsResponse>('/admin/stats')
        if (response.data?.status === 'success') return response.data.data
        return null
    },
}
