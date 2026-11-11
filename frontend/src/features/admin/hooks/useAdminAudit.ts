/**
 * 後台「稽核」：
 *   - 分頁清單（每頁 15 筆，可搜尋、篩選、匯出 CSV／JSON）
 *   - 總覽圖表用的近 7 天紀錄（另外存，翻頁時不會弄亂總覽的統計）
 */
import { useCallback, useEffect, useState } from 'react'
import {
    exportAuditLogsCSV, exportAuditLogsJSON, getAuditLogs, type AuditLogItem, type AuditLogQuery,
} from '@/api/auditLogs'
import { downloadBlob, todayStamp } from '@/lib/download'

/** 本地日期 YYYY-MM-DD。後端資料庫存的是不帶時區的時間，送 toISOString()（帶 Z）會比較失敗回 500 */
function localDate(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function useAdminAudit() {
    const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([])
    const [auditTotal, setAuditTotal] = useState(0)
    const [auditPage, setAuditPage] = useState(1)
    const [auditTotalPages, setAuditTotalPages] = useState(0)
    const [isLoadingAudit, setIsLoadingAudit] = useState(false)
    const [auditFilter, setAuditFilter] = useState<AuditLogQuery>({ page: 1, page_size: 15 })
    const [auditSearchInput, setAuditSearchInput] = useState('')
    const [auditDrawer, setAuditDrawer] = useState<AuditLogItem | null>(null)
    const [auditSummary, setAuditSummary] = useState<AuditLogItem[]>([])

    const loadAuditLogs = useCallback(async (query: AuditLogQuery = auditFilter) => {
        setIsLoadingAudit(true)
        try {
            const data = await getAuditLogs(query)
            setAuditLogs(data.data)
            setAuditTotal(data.total)
            setAuditPage(data.page)
            setAuditTotalPages(data.total_pages)
        } catch (err) {
            console.error('Failed to load audit logs:', err)
        } finally {
            setIsLoadingAudit(false)
        }
    }, [auditFilter])

    /** 近 7 天全部紀錄（每頁上限 100 筆，逐頁抓，最多 2000 筆）給總覽的趨勢圖與分布圖 */
    const loadAuditSummary = useCallback(async () => {
        try {
            const since = new Date()
            since.setDate(since.getDate() - 7)
            const all: AuditLogItem[] = []
            for (let page = 1; page <= 20; page++) {
                const data = await getAuditLogs({ page, page_size: 100, start_date: localDate(since) })
                all.push(...data.data)
                if (page >= (data.total_pages || 1)) break
            }
            setAuditSummary(all)
        } catch (err) {
            console.error('Failed to load audit summary:', err)
        }
    }, [])

    useEffect(() => {
        loadAuditSummary()
    }, [loadAuditSummary])

    /** 改條件後回到第 1 頁重新查詢 */
    const applyFilter = (next: AuditLogQuery) => {
        setAuditFilter(next)
        loadAuditLogs(next)
    }
    const onSearch = () => applyFilter({ ...auditFilter, search: auditSearchInput || undefined, page: 1 })
    const onFilterChange = (key: keyof AuditLogQuery, value: string) => applyFilter({ ...auditFilter, [key]: value || undefined, page: 1 })
    const onPageChange = (page: number) => applyFilter({ ...auditFilter, page })

    const exportQuery = () => ({
        action: auditFilter.action,
        resource_type: auditFilter.resource_type,
        start_date: auditFilter.start_date,
        end_date: auditFilter.end_date,
    })
    const onExportCSV = async () => downloadBlob(await exportAuditLogsCSV(exportQuery()), `audit_logs_${todayStamp()}.csv`)
    const onExportJSON = async () => downloadBlob(await exportAuditLogsJSON(exportQuery()), `audit_logs_${todayStamp()}.json`)

    return {
        auditSummary,
        loadAuditLogs,
        sectionProps: {
            auditSearchInput, setAuditSearchInput,
            auditFilter, auditLogs, auditTotal, auditPage, auditTotalPages, isLoadingAudit,
            auditDrawer, setAuditDrawer,
            onSearch, onFilterChange, onPageChange, onExportCSV, onExportJSON,
        },
    }
}
