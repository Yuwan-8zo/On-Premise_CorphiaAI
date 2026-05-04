/**
 * 系統監控 API
 */

import apiClient from './client'

export interface NgrokInfo {
    active: boolean
    url: string | null
    api_url: string | null
    ws_url: string | null
    updated_at?: string | null
    source?: string
}

export const systemApi = {
    /**
     * 取得當前 ngrok 公網 URL
     */
    getNgrokUrl: async (): Promise<NgrokInfo> => {
        const response = await apiClient.get<NgrokInfo>('/system/ngrok-url')
        return response.data
    },

    /**
     * 啟動 ngrok 公開隧道（admin only）
     * 後端會 block 最多 ~20s 等 ngrok 取到 URL，所以呼叫端要設較長 timeout
     */
    startNgrok: async (): Promise<NgrokInfo> => {
        const response = await apiClient.post<NgrokInfo>(
            '/system/ngrok/start',
            null,
            { timeout: 30000 },
        )
        return response.data
    },

    /**
     * 關閉 ngrok 公開隧道（admin only）
     */
    stopNgrok: async (): Promise<NgrokInfo> => {
        const response = await apiClient.post<NgrokInfo>('/system/ngrok/stop')
        return response.data
    },

    /**
     * 取得詳細系統健康（CPU / GPU / VRAM / LLM 統計）
     */
    getHealthDetailed: async () => {
        const response = await apiClient.get('/system/health/detailed')
        return response.data
    },

    /**
     * 取得網路連線狀態與資料主權標示
     */
    getNetworkStatus: async () => {
        const response = await apiClient.get('/system/network/status')
        return response.data
    },
}
