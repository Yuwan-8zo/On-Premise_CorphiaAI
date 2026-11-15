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

/** /system/health/detailed 的內容（後台「LLM 即時狀態」「系統資源」共用） */
export interface HealthDetailed {
    llm?: {
        model_loaded: boolean
        provider: string
        model_path: string
        throughput?: { last_tokens_per_sec: number; total_generations: number }
    }
    /** 後端把 CPU 與記憶體都放在 cpu 這一塊 */
    cpu?: {
        cpu_percent: number
        cpu_cores: number
        memory_total_gb: number
        memory_used_gb: number
        memory_percent: number
    }
}

export interface LanStatus {
    enabled: boolean
    lan_ips: string[]
    requires_restart: boolean
    /** 區網裝置要開的完整網址（主機模式才有；開發模式是空的，照目前頁面的網址組） */
    lan_urls?: string[]
    /** 區網連線有沒有加密 */
    encrypted?: boolean
    /** 主機發證憑證的指紋（有加密才有） */
    ca_fingerprint?: string
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
     * 關閉主機服務（後端、AI 模型、資料庫）。只有在主機本機登入的管理員可以用；其他裝置會被拒絕
     */
    shutdownHost: async (): Promise<void> => {
        await apiClient.post('/system/shutdown')
    },

    /**
     * 取得詳細系統健康（CPU / GPU / VRAM / LLM 統計）
     */
    getHealthDetailed: async (): Promise<HealthDetailed> => {
        const response = await apiClient.get('/system/health/detailed')
        return unwrapEnvelope(response.data) as HealthDetailed
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
