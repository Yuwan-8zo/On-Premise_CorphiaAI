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
import { localDate } from '@/lib/dates'


export function useAdminAudit() {
    const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([])
    const [auditTotal, setAuditTotal] = useState(0)
    const [auditPage, setAuditPage] = useState(1)
    const [auditTotalPages, setAuditTotalPages] = useState(0)
    const [isLoadingAudit, setIsLoadingAudit] = useState(false)
    const [auditFilter, setAuditFilter] = useState<AuditLogQuery>({ page: 1, page_size: 15 })
    const [auditSearchInput, setAuditSearchInput] = useState('')
    const [auditDrawer, setAuditDrawer] = useState<AuditLogItem | null>(null)
    /** null＝還在載入（總覽顯示骨架，不顯示 0 或「沒有資料」） */
    const [auditSummary, setAuditSummary] = useState<AuditLogItem[] | null>(null)

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

    /** 近 7 天全部紀錄（每頁上限 100 筆，最多 2000 筆）給總覽的趨勢圖與分布圖：先抓第一頁知道總頁數，其餘同時抓 */
    const loadAuditSummary = useCallback(async () => {
        try {
            const since = new Date()
            since.setDate(since.getDate() - 7)
            const query = { page_size: 100, start_date: localDate(since) }
            const first = await getAuditLogs({ ...query, page: 1 })
            const pages = Math.min(first.total_pages || 1, 20)
            const rest = await Promise.all(
                Array.from({ length: pages - 1 }, (_, i) => getAuditLogs({ ...query, page: i + 2 })),
            )
            setAuditSummary([first, ...rest].flatMap((d) => d.data))
        } catch (err) {
            console.error('Failed to load audit summary:', err)
            setAuditSummary([])
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

    // 匯出和畫面上的清單同一組條件（含搜尋、操作者）
    const exportQuery = () => ({
        action: auditFilter.action,
        resource_type: auditFilter.resource_type,
        user_id: auditFilter.user_id,
        search: auditFilter.search,
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
