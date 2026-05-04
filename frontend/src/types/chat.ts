/**
 * 對話相關類型定義
 */

export interface Conversation {
    id: string
    title: string
    model: string
    messageCount: number
    totalTokens: number
    isPinned: boolean
    isArchived: boolean
    folderId?: string
    settings: Record<string, unknown>
    createdAt: string
    updatedAt: string
}

export interface MessageSource {
    document_id: string
    document_name: string
    chunk_id: string
    content: string
    score: number
}

/**
 * 語音訊息附件。
 * - url 通常為 ObjectURL（blob:）或上傳後的後端 URL
 * - mimeType 通常為 audio/webm 或 audio/mp4
 * - transcript 若瀏覽器支援 Web Speech API，可選擇性附上轉錄文字
 */
export interface MessageAudio {
    url: string
    mimeType: string
    durationMs: number
    transcript?: string
    /** 後端正在轉錄；前端可顯示 loading 狀態，等轉錄完再清掉 */
    pending?: boolean
    /** 轉錄階段失敗的訊息（讓 UI 可顯示「轉錄失敗」狀態） */
    error?: string
}

export interface Message {
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    tokens: number
    sources?: MessageSource[]
    rating?: number
    content_hash?: string
    prev_hash?: string
    /** 語音訊息附件（若此訊息為語音訊息） */
    audio?: MessageAudio
    createdAt: string
}

export interface ChatRequest {
    message: string
    useRag?: boolean
    temperature?: number
    maxTokens?: number
}

export interface ChatStreamResponse {
    type: 'stream' | 'done' | 'error'
    content?: string
    messageId?: string
    sources?: MessageSource[]
    usage?: {
        promptTokens: number
        completionTokens: number
    }
    error?: string
}
