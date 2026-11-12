/**
 * 審計日誌 API
 */

import { apiClient } from './client'
import { dayEndISO, dayStartISO } from '@/lib/dates'

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
 * 篩選日期（畫面上是本地日期）轉成確切的起訖時間：起日從本地 00:00、迄日含整天。
 * 只送日期的話，後端會當成 UTC，台灣差 8 小時。
 */
function toServerRange<T extends { start_date?: string; end_date?: string }>(params: T): T {
    return {
        ...params,
        start_date: params.start_date ? dayStartISO(params.start_date) : undefined,
        end_date: params.end_date ? dayEndISO(params.end_date) : undefined,
    }
}

/**
 * 取得審計日誌列表
 */
export async function getAuditLogs(params: AuditLogQuery = {}): Promise<AuditLogListResponse> {
    const response = await apiClient.get('/audit-logs', { params: toServerRange(params) })
    return response.data
}

/**
 * 匯出審計日誌 (CSV)
 */
export async function exportAuditLogsCSV(params: Omit<AuditLogQuery, 'page' | 'page_size'> = {}): Promise<Blob> {
    const response = await apiClient.get('/audit-logs/export/csv', {
        params: toServerRange(params),
        responseType: 'blob',
    })
    return response.data
}

/**
 * 匯出審計日誌 (JSON)
 */
export async function exportAuditLogsJSON(params: Omit<AuditLogQuery, 'page' | 'page_size'> = {}): Promise<Blob> {
    const response = await apiClient.get('/audit-logs/export/json', {
        params: toServerRange(params),
        responseType: 'blob',
    })
    return response.data
}

/** 稽核的操作代碼（顯示文字在 i18n 的 admin.audit.actionTypes） */
export const AUDIT_ACTIONS = [
    'login_success',
    'login_failed',
    'logout',
    'register',
    'token_refresh',
    'user_create',
    'user_update',
    'user_delete',
    'user_activate',
    'user_deactivate',
    'conversation_create',
    'conversation_update',
    'conversation_delete',
    'document_upload',
    'document_delete',
    'document_metadata_update',
    'model_select',
    'model_refresh',
    'token_revoke',
    'user_force_logout',
    'password_change_success',
    'password_change_failed',
    'account_locked',
    'pii_detected',
    'prompt_injection_blocked',
    'dlp_hit',
    'tenant_create',
    'tenant_update',
    'tenant_delete',
    'memory_create',
    'memory_update',
    'memory_delete',
    'memory_clear',
    'memory_rejected',
    'context_filtered',
    'file_create',
    'file_download',
    'office_read',
    'office_write',
    'file_open',
] as const

/** 稽核的資源代碼（顯示文字在 i18n 的 admin.audit.resourceTypes） */
export const AUDIT_RESOURCES = ['auth', 'user', 'conversation', 'document', 'model', 'memory', 'file', 'desktop', 'system'] as const
