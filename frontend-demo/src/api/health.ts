/** Mock Health API — Demo 版 */

export type ServiceReadiness = 'loading' | 'ready' | 'unavailable' | 'error'

export interface HealthStatus {
    status: 'ok' | 'starting'
    version: string
    database: string
    llm: ServiceReadiness
    rag: ServiceReadiness
}

export async function fetchHealth(): Promise<HealthStatus> {
    return {
        status: 'ok',
        version: '1.0.0-demo',
        database: 'ready',
        llm: 'ready',
        rag: 'ready',
    }
}

export function isLlmReady(_health: HealthStatus | null): boolean {
    return true
}

export function isApiReady(_health: HealthStatus | null): boolean {
    return true
}

export const healthApi = {
    check: fetchHealth,
}
