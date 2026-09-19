/** Mock Admin API — 補齊 frontend 所有元件呼叫到的方法 */
import { DEMO_STATS, DEMO_USERS } from '../demo/mockData'

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

export const adminApi = {
    // ── 基本統計 ────────────────────────────────────────────
    getStats: async () => { await sleep(400); return DEMO_STATS },

    getSystemInfo: async () => {
        await sleep(300)
        return { cpu_percent: 38.5, memory_percent: 62.1, disk_percent: 44.8, uptime_seconds: 86400 }
    },

    getLLMHealth: async () => {
        await sleep(300)
        return { status: 'healthy', model: 'qwen2.5-7b-instruct-q4_k_m', uptime: 86400 }
    },

    // ── Dashboard snapshot（OverviewSection 用）────────────
    getDashboardSnapshot: async () => {
        await sleep(400)
        return {
            stats: DEMO_STATS,
            security: {
                pii_masked_count: 1,
                dlp_blocked_count: 1,
                injection_detected_count: 1,
                high_risk_count: 2,
            },
            ai: {
                total_tokens: 792,
                avg_tokens_per_session: 264,
                model: 'qwen2.5-7b-instruct-q4_k_m',
                speed_toks: 9.62,
            },
        }
    },

    // ── Models integrity（ModelsSection 用）────────────────
    getModelsIntegrity: async () => {
        await sleep(400)
        return {
            models: [
                { name: 'qwen2.5-7b-instruct-q4_k_m', status: 'ok', hash_valid: true, last_checked: new Date().toISOString() },
            ],
            throughput: { 'qwen2.5-7b-instruct-q4_k_m': 9.62 },
        }
    },

    // ── Tenants usage（TenantsSection 用）──────────────────
    getTenantsUsage: async () => {
        await sleep(300)
        return [
            { tenant_id: 'tenant-001', name: 'Corp Demo', user_count: 3, conversation_count: 2, document_count: 1, total_tokens: 792 },
        ]
    },

    // ── User lockout summary（UsersSection 用）─────────────
    getUserLockoutSummary: async () => {
        await sleep(300)
        return DEMO_USERS.map((u) => ({
            user_id: u.id,
            email: u.email,
            is_locked: false,
            failed_attempts: 0,
            locked_until: null,
        }))
    },
}

// ── 型別 (export 給各 section import) ─────────────────────
export interface TenantUsageStats {
    tenant_id: string; name: string; user_count: number
    conversation_count: number; document_count: number; total_tokens: number
}

export interface UserLockoutStatus {
    user_id: string; email: string; is_locked: boolean
    failed_attempts: number; locked_until: string | null
}

export interface ModelIntegrityInfo {
    name: string; status: string; hash_valid: boolean; last_checked: string
}
