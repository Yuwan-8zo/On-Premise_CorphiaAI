/**
 * 資料夾 API
 */

import apiClient from './client'

export interface FolderResponse {
    id: string
    name: string
}

export const foldersApi = {
    /**
     * 取得該使用者的所有資料夾
     */
    list: async (): Promise<FolderResponse[]> => {
        const response = await apiClient.get('/folders')
        return response.data
    },

    /**
     * 建立資料夾
     */
    create: async (name: string): Promise<FolderResponse> => {
        const response = await apiClient.post('/folders', { name })
        return response.data
    },

    /**
     * 刪除資料夾
     */
    delete: async (name: string): Promise<void> => {
        await apiClient.delete(`/folders/${encodeURIComponent(name)}`)
    },
}
