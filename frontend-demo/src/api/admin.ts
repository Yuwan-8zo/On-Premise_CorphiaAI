/** Mock Admin API */
import { DEMO_STATS } from '../demo/mockData'

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

export const adminApi = {
    getStats: async () => { await sleep(400); return DEMO_STATS },
    getSystemInfo: async () => {
        await sleep(300)
        return { cpu_percent: 38.5, memory_percent: 62.1, disk_percent: 44.8, uptime_seconds: 86400 }
    },
    getLLMHealth: async () => {
        await sleep(300)
        return { status: 'healthy', model: 'qwen2.5-7b-instruct-q4_k_m', uptime: 86400 }
    },
}
