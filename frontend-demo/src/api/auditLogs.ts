/** Mock Audit Logs API — 補齊 auditAggregations 需要的 ACTION_LABELS */
import { DEMO_AUDIT_LOGS } from '../demo/mockData'

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

export type AuditLogItem = (typeof DEMO_AUDIT_LOGS)[number] & { action?: string }
export interface AuditLogQuery { page?: number; limit?: number; event_type?: string; user_id?: string }

/** auditAggregations.ts 需要這個 export */
export const ACTION_LABELS: Record<string, string> = {
    USER_LOGIN: '使用者登入',
    USER_LOGOUT: '使用者登出',
    CHAT_QUERY: 'AI 問答',
    DOCUMENT_UPLOAD: '文件上傳',
    DOCUMENT_DELETE: '文件刪除',
    PII_MASKED: 'PII 遮罩',
    DLP_BLOCKED: 'DLP 阻擋',
    INJECTION_DETECTED: 'Injection 偵測',
    ADMIN_ACTION: '管理員操作',
}

/** AuditSection.tsx 需要這個 export */
export const RESOURCE_LABELS: Record<string, string> = {
    user: '使用者',
    conversation: '對話',
    document: '文件',
    model: '模型',
    system: '系統',
    audit: '稽核',
    tenant: '租戶',
    admin: '管理員',
}

/** 加入 action 欄位（與 event_type 相同），讓 auditAggregations 可以讀取 */
const LOGS_WITH_ACTION = DEMO_AUDIT_LOGS.map((l) => ({
    ...l,
    action: l.event_type,
}))

export async function getAuditLogs(_query?: AuditLogQuery) {
    await sleep(300)
    return { data: LOGS_WITH_ACTION, total: LOGS_WITH_ACTION.length }
}

export async function exportAuditLogsCSV(_query?: AuditLogQuery) {
    await sleep(200)
    const headers = ['時間', '使用者', '事件類型', '說明', '風險等級', 'IP']
    const rows = LOGS_WITH_ACTION.map((l) => [l.created_at, l.user_email, l.event_type, `"${l.description}"`, l.risk_level, l.ip_address])
    const csv = '\uFEFF' + [headers, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'audit_logs_demo.csv'; a.click()
    return blob
}

export async function exportAuditLogsJSON(_query?: AuditLogQuery) {
    await sleep(200)
    const blob = new Blob([JSON.stringify(LOGS_WITH_ACTION, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'audit_logs_demo.json'; a.click()
    return blob
}
