/**
 * 記憶（設定 › 記憶）：跨對話記住使用者交代的事，後端見 backend/app/api/memories.py
 */
import apiClient from './client'

export type MemorySource = 'manual' | 'chat'

export interface MemoryItem {
    id: string
    content: string
    source: MemorySource
    created_at: string
}

/** 回答風格：預設／精簡／詳細／正式 */
export const REPLY_STYLES = ['default', 'concise', 'detailed', 'formal'] as const
export type ReplyStyle = (typeof REPLY_STYLES)[number]

export interface MemoryList {
    enabled: boolean
    style: ReplyStyle
    items: MemoryItem[]
    max_items: number
    max_chars: number
}

export const memoriesApi = {
    list: async (): Promise<MemoryList> => (await apiClient.get('/memories')).data,
    create: async (content: string): Promise<MemoryItem> => (await apiClient.post('/memories', { content })).data,
    update: async (id: string, content: string): Promise<MemoryItem> => (await apiClient.put(`/memories/${id}`, { content })).data,
    remove: async (id: string): Promise<void> => { await apiClient.delete(`/memories/${id}`) },
    clear: async (): Promise<void> => { await apiClient.delete('/memories') },
    setEnabled: async (enabled: boolean): Promise<void> => { await apiClient.put('/memories/settings', { enabled }) },
    setStyle: async (style: ReplyStyle): Promise<void> => { await apiClient.put('/memories/settings', { style }) },
}
