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
                pii_detected: 0,
                prompt_injection_blocked: 0,
                dlp_hit: 0,
                login_failed: 0,
            },
            ai: {
                llm: 'ready',
                rag: 'ready',
            },
        }
    },

    // ── Security summary（SecurityEventsPanel 自行 polling 用）
    getSecuritySummary: async () => {
        await sleep(300)
        return {
            pii_detected: 0,
            prompt_injection_blocked: 0,
            dlp_hit: 0,
            login_failed: 0,
        }
    },

    // ── Models integrity（ModelsSection 用）────────────────
    getModelsIntegrity: async () => {
        await sleep(400)
        return {
            models: [
                { name: 'qwen2.5-7b-instruct-q4_k_m', status: 'ok', hash_valid: true, last_checked: new Date().toISOString(), sha256: 'a3f8d2c1b4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1', filename: 'qwen2.5-7b-instruct-q4_k_m.gguf', size_bytes: 4723000000 },
                { name: 'qwen2.5-3b-instruct-q4_k_m', status: 'ok', hash_valid: true, last_checked: new Date().toISOString(), sha256: 'b4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5', filename: 'qwen2.5-3b-instruct-q4_k_m.gguf', size_bytes: 2100000000 },
                { name: 'qwen2.5-14b-instruct-q4_k_m', status: 'ok', hash_valid: true, last_checked: new Date().toISOString(), sha256: 'c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6', filename: 'qwen2.5-14b-instruct-q4_k_m.gguf', size_bytes: 9400000000 },
            ],
            throughput: { last_tokens_per_sec: 9.62, total_generations: 24 },
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
            failures_last_7d: 0,
            minutes_until_unlock: null,
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
    failures_last_7d: number; minutes_until_unlock: number | null
}

export interface ModelIntegrityInfo {
    name: string; status: string; hash_valid: boolean; last_checked: string
    sha256?: string; filename?: string; size_bytes?: number
}

export interface SecuritySummary {
    pii_detected: number; prompt_injection_blocked: number
    dlp_hit: number; login_failed: number
}
