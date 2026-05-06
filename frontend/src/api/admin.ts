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

export interface SecuritySummary {
    window_hours: number
    pii_detected: number
    prompt_injection_blocked: number
    dlp_hit: number
    login_failed: number
    account_locked: number
    token_revoked: number
}

interface SecuritySummaryResponse {
    status: 'success' | 'error'
    data: SecuritySummary
}

export interface UserLockoutStatus {
    user_id: string
    email: string
    current_attempts: number
    is_locked: boolean
    minutes_until_unlock: number | null
    failures_last_7d: number
}

interface UserLockoutResponse {
    status: 'success' | 'error'
    data: UserLockoutStatus[]
}

export interface ModelIntegrityInfo {
    name: string
    path: string
    filename: string
    size_bytes: number
    sha256: string | null
    is_active: boolean
    quantization: string | null
}

interface ModelIntegrityResponse {
    status: 'success' | 'error'
    data: {
        models: ModelIntegrityInfo[]
        throughput: Record<string, any>
    }
}

export interface TenantUsageStats {
    id: string
    name: string
    slug: string
    is_active: boolean
    users_count: number
    documents_count: number
    messages_24h: number
    security_events_24h: number
}

interface TenantUsageResponse {
    status: 'success' | 'error'
    data: TenantUsageStats[]
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

    /**
     * 取得近 24h 資安事件聚合（PII / Injection / DLP / 登入失敗等）
     */
    getSecuritySummary: async (): Promise<SecuritySummary | null> => {
        const response = await apiClient.get<SecuritySummaryResponse>('/admin/security-summary')
        if (response.data?.status === 'success') return response.data.data
        return null
    },

    /**
     * 取得每位使用者的鎖定與登入失敗摘要
     */
    getUserLockoutSummary: async (): Promise<UserLockoutStatus[] | null> => {
        const response = await apiClient.get<UserLockoutResponse>('/admin/user-lockout-summary')
        if (response.data?.status === 'success') return response.data.data
        return null
    },

    /**
     * 取得每個本機模型的完整性與效能資訊
     */
    getModelsIntegrity: async (): Promise<ModelIntegrityResponse['data'] | null> => {
        const response = await apiClient.get<ModelIntegrityResponse>('/admin/models/integrity')
        if (response.data?.status === 'success') return response.data.data
        return null
    },

    /**
     * 取得每個租戶的使用量總覽
     */
    getTenantsUsage: async (): Promise<TenantUsageStats[] | null> => {
        const response = await apiClient.get<TenantUsageResponse>('/admin/tenants/usage')
        if (response.data?.status === 'success') return response.data.data
        return null
    },

    /**
     * 強制登出指定使用者
     */
    forceLogout: async (userId: string): Promise<{ status: string } | null> => {
        try {
            const response = await apiClient.post(`/admin/force-logout/${userId}`)
            return response.data
        } catch {
            return null
        }
    },
}
