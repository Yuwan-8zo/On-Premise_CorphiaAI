/**
 * websocket.types.ts — 共用型別定義（從原版 websocket.ts 摘出）
 */

export interface WebSocketMessage {
    type: 'message' | 'ping' | 'stop' | 'resubmit'
    content?: string
    message_id?: string
    use_rag?: boolean
    temperature?: number
    max_tokens?: number
    language?: string
}

export interface StreamResponse {
    type: 'stream' | 'done' | 'error' | 'sources' | 'pong' | 'pii_warning' | 'injection_warning' | 'dlp_block'
    content?: string
    messageId?: string
    sources?: Array<{
        chunkId: string
        content: string
        score: number
        distance?: number
        document_id?: string
        document_name?: string
        metadata: Record<string, unknown>
    }>
    message?: string
    code?: string
    error_id?: string
    mask_map?: Array<{
        original_preview: string
        masked: string
        type: string
        label: string
    }>
    risk_level?: string
    matched_patterns?: string[]
    matched_terms_count?: number
    debug?: {
        route: string
        context_length: number
        prompt_length: number
        chunks_count: number
    }
}
