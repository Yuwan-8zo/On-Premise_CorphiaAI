/** Mock Audit Logs API */
import { DEMO_AUDIT_LOGS } from '../demo/mockData'

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

export type AuditLogItem = (typeof DEMO_AUDIT_LOGS)[number]
export interface AuditLogQuery { page?: number; limit?: number; event_type?: string; user_id?: string }

export async function getAuditLogs(_query?: AuditLogQuery) {
    await sleep(300)
    return { data: DEMO_AUDIT_LOGS, total: DEMO_AUDIT_LOGS.length }
}

export async function exportAuditLogsCSV(_query?: AuditLogQuery) {
    await sleep(200)
    const headers = ['時間', '使用者', '事件類型', '說明', '風險等級', 'IP']
    const rows = DEMO_AUDIT_LOGS.map((l) => [l.created_at, l.user_email, l.event_type, l.description, l.risk_level, l.ip_address])
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'audit_logs_demo.csv'; a.click()
    return blob
}

export async function exportAuditLogsJSON(_query?: AuditLogQuery) {
    await sleep(200)
    const json = JSON.stringify(DEMO_AUDIT_LOGS, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'audit_logs_demo.json'; a.click()
    return blob
}
