import apiClient from './client'

export type ServiceReadiness = 'loading' | 'ready' | 'unavailable' | 'error'

export interface HealthStatus {
    status: 'ok' | 'starting'
    version: string
    database: string
    llm: ServiceReadiness
    rag: ServiceReadiness
    /** 每個模型的載入狀態（pending / loading / ready / error / not_preloaded） */
    models?: Array<{ name: string; state: string; is_current: boolean; size_gb: number }>
}

export async function fetchHealth(): Promise<HealthStatus> {
    const { data } = await apiClient.get<HealthStatus>('/health')
    return data
}

export function isLlmReady(health: HealthStatus | null): boolean {
    return health?.llm === 'ready'
}

export function isApiReady(health: HealthStatus | null): boolean {
    return health?.status === 'ok'
}
