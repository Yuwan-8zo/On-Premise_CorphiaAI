/** Mock System API — 補齊 SystemSection 需要的方法 */
function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

export interface RuntimeInfo {
    python_version: string
    platform: string
    cpu_count: number
    total_memory_gb: number
    used_memory_gb: number
    gpu_available: boolean
    cuda_version: string | null
    torch_version: string | null
}

export const systemApi = {
    getStatus: async () => {
        await sleep(200)
        return { status: 'healthy', llm_ready: true, vector_db_ready: true, version: '1.0.0-demo' }
    },

    getResources: async () => {
        await sleep(200)
        return { cpu_percent: 38.5, memory_percent: 62.1, disk_percent: 44.8 }
    },

    getConfig: async () => {
        await sleep(200)
        return { max_tokens: 2048, temperature: 0.7, model: 'qwen2.5-7b-instruct-q4_k_m' }
    },

    // LLMHealthPanel + SystemResourcePanel 用
    getHealthDetailed: async () => {
        await sleep(300)
        return {
            llm: {
                model_loaded: true,
                provider: 'ollama',
                model_path: 'qwen2.5-7b-instruct-q4_k_m',
                throughput: {
                    last_tokens_per_sec: 9.62,
                    total_generations: 24,
                },
            },
            cpu: {
                cpu_percent: 38.5,
                cpu_cores: 8,
                memory_total_gb: 16.0,
                memory_used_gb: 9.94,
                memory_percent: 62.1,
            },
        }
    },

    getLanStatus: async () => {
        await sleep(200)
        return { enabled: false, lan_ips: [] as string[] }
    },

    toggleLan: async (enabled: boolean) => {
        await sleep(400)
        return {
            enabled,
            lan_ips: enabled ? ['192.168.1.100', '192.168.1.101'] : [],
        }
    },

    getRuntimeInfo: async (): Promise<RuntimeInfo> => {
        await sleep(300)
        return {
            python_version: '3.11.9',
            platform: 'Windows-11',
            cpu_count: 8,
            total_memory_gb: 16.0,
            used_memory_gb: 9.94,
            gpu_available: false,
            cuda_version: null,
            torch_version: null,
        }
    },
}
