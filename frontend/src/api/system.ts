/**
 * 系統監控 API
 */

import apiClient from './client'

// Newer backend responses wrap the payload as { schema_version, data }.
// Accept both shapes so the admin panels keep working either way.
function unwrapEnvelope<T = unknown>(body: unknown): T {
    if (body && typeof body === 'object' && 'schema_version' in body && 'data' in body) {
        return (body as { data: T }).data
    }
    return body as T
}

export interface LanStatus {
    enabled: boolean
    lan_ips: string[]
    requires_restart: boolean
}

export interface RuntimeInfo {
    status: 'success' | 'error'
    data: {
        uptime_seconds: number
        boot_timestamp: number
        db_pool: {
            size: number
            checked_in: number
            checked_out: number
            overflow: number
        }
    }
}

export const systemApi = {
    /**
     * 取得區域網路 (LAN) 開關狀態
     */
    getLanStatus: async (): Promise<LanStatus> => {
        const response = await apiClient.get<LanStatus>('/system/lan/status')
        return response.data
    },

    /**
     * 切換區域網路 (LAN) 開關（立即生效）
     */
    toggleLan: async (enabled: boolean): Promise<LanStatus> => {
        const response = await apiClient.post<LanStatus>('/system/lan/toggle', { enabled })
        return response.data
    },

    /**
     * 取得詳細系統健康（CPU / GPU / VRAM / LLM 統計）
     */
    getHealthDetailed: async () => {
        const response = await apiClient.get('/system/health/detailed')
        return unwrapEnvelope(response.data)
    },

    /**
     * 取得網路連線狀態與資料主權標示
     */
    getNetworkStatus: async () => {
        const response = await apiClient.get('/system/network/status')
        return unwrapEnvelope(response.data)
    },

    /**
     * 取得後端執行時間資訊（uptime / db pool 狀態）
     */
    getRuntimeInfo: async (): Promise<RuntimeInfo['data'] | null> => {
        try {
            const response = await apiClient.get<RuntimeInfo>('/system/runtime-info')
            if (response.data?.status === 'success') return response.data.data
            return null
        } catch {
            return null
        }
    },
}
