/**
 * 資料夾 API
 */

import apiClient from './client'

export interface FolderResponse {
    id: string
    name: string
    /** 專案的自訂指示（沒設定是 null） */
    instructions?: string | null
}

/** 專案自訂指示的長度上限（和後端 INSTRUCTIONS_MAX 一致） */
export const FOLDER_INSTRUCTIONS_MAX = 1000

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
     * 設定專案的自訂指示（空字串＝清除）
     */
    setInstructions: async (name: string, instructions: string): Promise<FolderResponse> => {
        const response = await apiClient.put(`/folders/${encodeURIComponent(name)}/instructions`, { instructions })
        return response.data
    },

    /**
     * 刪除資料夾
     */
    delete: async (name: string): Promise<void> => {
        await apiClient.delete(`/folders/${encodeURIComponent(name)}`)
    },
}
