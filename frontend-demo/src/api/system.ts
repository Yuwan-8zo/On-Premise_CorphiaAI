/** Mock System API */
function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

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
}
