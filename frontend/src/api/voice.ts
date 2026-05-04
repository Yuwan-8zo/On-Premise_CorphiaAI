/**
 * Voice API：呼叫後端 Whisper STT。
 *
 * 流程：
 *   1. 前端錄音得到 webm/opus Blob
 *   2. 用 audioToWav.ts 轉成 16kHz mono WAV
 *   3. 透過此檔的 transcribe() 上傳，後端跑 Whisper 回傳文字
 */

import { apiClient } from './client'

export interface TranscribeResponse {
    text: string
    language: string | null
    duration_ms: number
    elapsed_ms: number
}

export interface TranscribeOptions {
    /** i18next 語言碼（zh-TW / en-US / ja-JP），會在後端被歸一化成 Whisper 接受的兩字碼 */
    language?: string
    /** AbortController.signal，使用者取消時可中斷上傳 */
    signal?: AbortSignal
}

export const voiceApi = {
    async transcribe(wavBlob: Blob, options: TranscribeOptions = {}): Promise<TranscribeResponse> {
        const form = new FormData()
        form.append('audio', wavBlob, 'recording.wav')
        if (options.language) form.append('language', options.language)

        const { data } = await apiClient.post<TranscribeResponse>('/voice/transcribe', form, {
            // axios 會自動為 FormData 設置 multipart boundary，讓它覆蓋預設 JSON header
            headers: { 'Content-Type': 'multipart/form-data' },
            // 第一次推論可能要下載模型 + 跑 inference，給足夠 timeout
            timeout: 5 * 60 * 1000,
            signal: options.signal,
        })
        return data
    },
}
