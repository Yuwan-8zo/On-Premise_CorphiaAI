/**
 * 連接資料夾（後台「資料夾」分頁）：把伺服器上的資料夾接給 AI 讀，後端見 backend/app/api/connected_folders.py
 */
import apiClient from './client'

export type FolderWriteMode = 'read_only' | 'output' | 'approve'
export type FolderStatus = 'pending' | 'scanning' | 'ready' | 'error'
export type FolderRole = 'user' | 'admin' | 'engineer'

/** 自動更新間隔（分鐘），和後端 SCAN_INTERVALS 一致 */
export const SCAN_INTERVALS = [5, 10, 30, 60, 360, 1440] as const

export interface ConnectedFolderInput {
    name: string
    path: string
    description?: string
    allowed_roles: FolderRole[]
    write_mode: FolderWriteMode
    include_subfolders: boolean
    scan_interval_min: number
    is_enabled: boolean
}

export interface ConnectedFolder extends ConnectedFolderInput {
    id: string
    tenant_id: string
    status: FolderStatus
    file_count: number
    total_bytes: number
    last_scan_at: string | null
    error_message: string | null
    created_at: string
    updated_at: string
    /** 建立索引的進度 */
    indexed_count: number
    failed_count: number
    waiting_count: number
    /** 正在掃描或排隊等著掃 */
    scanning: boolean
}

export interface FolderCheck {
    ok: boolean
    message?: string | null
    path?: string | null
    file_count: number
    total_bytes: number
    by_type: Record<string, number>
    unsupported_count: number
    skipped_sensitive: number
    samples: string[]
    truncated: boolean
}

export interface BrowseResult {
    path: string | null
    parent: string | null
    dirs: { name: string; path: string }[]
}

const BASE = '/connected-folders'

export const connectedFoldersApi = {
    list: async (): Promise<ConnectedFolder[]> => (await apiClient.get(BASE)).data,
    check: async (path: string, include_subfolders: boolean): Promise<FolderCheck> => (await apiClient.post(`${BASE}/check`, { path, include_subfolders })).data,
    browse: async (path?: string | null): Promise<BrowseResult> => (await apiClient.get(`${BASE}/browse`, { params: path ? { path } : {} })).data,
    create: async (data: ConnectedFolderInput): Promise<ConnectedFolder> => (await apiClient.post(BASE, data)).data,
    update: async (id: string, data: Partial<ConnectedFolderInput>): Promise<ConnectedFolder> => (await apiClient.put(`${BASE}/${id}`, data)).data,
    /** 立即更新：重新比對檔案、建立索引 */
    scan: async (id: string): Promise<ConnectedFolder> => (await apiClient.post(`${BASE}/${id}/scan`)).data,
    remove: async (id: string): Promise<void> => {
        await apiClient.delete(`${BASE}/${id}`)
    },
}
