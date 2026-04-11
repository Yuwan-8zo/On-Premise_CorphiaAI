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

export interface Message {
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    tokens: number
    sources?: MessageSource[]
    rating?: number
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
