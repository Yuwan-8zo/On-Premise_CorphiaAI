/** Mock Voice API — Demo 版（直接回傳假轉錄文字） */
function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

export const voiceApi = {
    transcribe: async (_blob: Blob, _opts?: { language?: string }) => {
        await sleep(1200)
        return { text: '（Demo 模式：語音已轉錄完成）' }
    },
}
