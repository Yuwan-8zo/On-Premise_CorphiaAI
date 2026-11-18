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

/** 推論速度統計（目前模型） */
export type ModelThroughput = { last_tokens_per_sec?: number } & Record<string, unknown>

interface ModelIntegrityResponse {
    status: 'success' | 'error'
    data: {
        models: ModelIntegrityInfo[]
        throughput: ModelThroughput
    }
}

export interface DashboardSnapshot {
    security: SecuritySummary
    ai: {
        llm: string
        rag: string
    }
}

interface DashboardSnapshotResponse {
    status: 'success' | 'error'
    data: DashboardSnapshot
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

/** 資安閘道代號（順序＝訊息經過的順序） */
export type SecurityGateKey = 'pii' | 'dlp' | 'injection' | 'semantic' | 'llm_judge' | 'context' | 'output'

export interface SecurityGateHits {
    key: SecurityGateKey
    /** false＝這一關不寫稽核，沒有次數 */
    counted: boolean
    hits?: number
    previous?: number
    /** 每天幾次（舊到新） */
    daily?: number[]
    daily_previous?: number[]
}

export interface SecurityGatesConfig {
    enabled: Record<SecurityGateKey, boolean>
    semantic_block: number
    semantic_review: number
    semantic_margin: number
}

export interface SecurityGatesData extends SecurityGatesConfig {
    window_days: number
    gates: SecurityGateHits[]
    depends_on: Partial<Record<SecurityGateKey, SecurityGateKey>>
    messages: number
    messages_previous: number
    can_edit: boolean
}

export interface SemanticScoresData extends SecurityGatesConfig {
    /** [最像攻擊範例的相似度, 最像正常範例的相似度]，舊到新 */
    scores: Array<[number, number]>
    keep: number
}

export interface SecurityGatesUpdate {
    enabled?: Partial<Record<SecurityGateKey, boolean>>
    semantic_block?: number
    semantic_review?: number
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

    /** Overview 儀表板聚合（資安 + AI 就緒），減少多路輪詢 */
    getDashboardSnapshot: async (): Promise<DashboardSnapshot | null> => {
        const response = await apiClient.get<DashboardSnapshotResponse>('/admin/dashboard-snapshot')
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
    /** 資安閘道：開關、門檻、各關近 7 天命中次數（日期照瀏覽器所在時區分） */
    getSecurityGates: async (): Promise<SecurityGatesData | null> => {
        const response = await apiClient.get<{ status: string; data: SecurityGatesData }>('/admin/security/gates', {
            params: { tz_offset: -new Date().getTimezoneOffset() },
        })
        if (response.data?.status === 'success') return response.data.data
        return null
    },

    /** 改開關或語意檢查門檻（工程師）；回改完的設定 */
    updateSecurityGates: async (body: SecurityGatesUpdate): Promise<SecurityGatesConfig | null> => {
        const response = await apiClient.put<{ status: string; data: SecurityGatesConfig }>('/admin/security/gates', body)
        if (response.data?.status === 'success') return response.data.data
        return null
    },

    /** 最近各則的語意比對分數（門檻規劃器） */
    getSemanticScores: async (): Promise<SemanticScoresData | null> => {
        const response = await apiClient.get<{ status: string; data: SemanticScoresData }>('/admin/security/semantic-scores')
        if (response.data?.status === 'success') return response.data.data
        return null
    },

    forceLogout: async (userId: string): Promise<{ status: string } | null> => {
        try {
            const response = await apiClient.post(`/users/${userId}/force-logout`)
            return response.data
        } catch {
            return null
        }
    },
}
