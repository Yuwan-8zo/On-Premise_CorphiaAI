/**
 * 審計日誌 API
 */

import { apiClient } from './client'

// 審計日誌回應型別
export interface AuditLogItem {
    id: string
    user_id: string | null
    user_email: string | null
    tenant_id: string | null
    action: string
    resource_type: string
    resource_id: string | null
    description: string | null
    details: Record<string, unknown> | null
    ip_address: string | null
    user_agent: string | null
    created_at: string
}

export interface AuditLogListResponse {
    data: AuditLogItem[]
    total: number
    page: number
    page_size: number
    total_pages: number
}

// 查詢參數
export interface AuditLogQuery {
    page?: number
    page_size?: number
    action?: string
    resource_type?: string
    user_id?: string
    search?: string
    start_date?: string
    end_date?: string
}

/**
 * 取得審計日誌列表
 */
export async function getAuditLogs(params: AuditLogQuery = {}): Promise<AuditLogListResponse> {
    const response = await apiClient.get('/audit-logs', { params })
    return response.data
}

/**
 * 匯出審計日誌 (CSV)
 */
export async function exportAuditLogsCSV(params: Omit<AuditLogQuery, 'page' | 'page_size'> = {}): Promise<Blob> {
    const response = await apiClient.get('/audit-logs/export/csv', {
        params,
        responseType: 'blob',
    })
    return response.data
}

/**
 * 匯出審計日誌 (JSON)
 */
export async function exportAuditLogsJSON(params: Omit<AuditLogQuery, 'page' | 'page_size'> = {}): Promise<Blob> {
    const response = await apiClient.get('/audit-logs/export/json', {
        params,
        responseType: 'blob',
    })
    return response.data
}

/**
 * 操作類型對應的中文標籤
 */
export const ACTION_LABELS: Record<string, string> = {
    login_success: '登入成功',
    login_failed: '登入失敗',
    logout: '登出',
    register: '註冊',
    token_refresh: 'Token 刷新',
    user_create: '建立使用者',
    user_update: '更新使用者',
    user_delete: '停用使用者',
    user_activate: '啟用使用者',
    user_deactivate: '停用使用者',
    conversation_create: '建立對話',
    conversation_update: '更新對話',
    conversation_delete: '刪除對話',
    document_upload: '上傳文件',
    document_delete: '刪除文件',
    document_metadata_update: '更新文件設定',
    model_select: '選擇模型',
    model_refresh: '刷新模型',
}

/**
 * 資源類型對應的中文標籤
 */
export const RESOURCE_LABELS: Record<string, string> = {
    auth: '認證',
    user: '使用者',
    conversation: '對話',
    document: '文件',
    model: '模型',
}
