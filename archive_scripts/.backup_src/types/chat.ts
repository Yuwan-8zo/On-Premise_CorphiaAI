/**
<<<<<<< HEAD
 * Chat 相關型別定義
 */

=======
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
    documentId: string
    documentName: string
    chunkId: string
    content: string
    score: number
}

>>>>>>> 1432944 (feat(init): 建立 Corphia AI Platform v2.2 基礎架構)
export interface Message {
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    tokens: number
<<<<<<< HEAD
    createdAt: string
    sources?: Source[]
    rating?: number
}

export interface Source {
    id: string
    title: string
    content: string
    score: number
    documentId: string
}

export interface Conversation {
    id: string
    title: string
    model?: string
    messageCount?: number
    totalTokens?: number
    isPinned?: boolean
    isArchived?: boolean
    folderId?: string
    settings?: Record<string, unknown>
    createdAt: string
    updatedAt: string
=======
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
>>>>>>> 1432944 (feat(init): 建立 Corphia AI Platform v2.2 基礎架構)
}
