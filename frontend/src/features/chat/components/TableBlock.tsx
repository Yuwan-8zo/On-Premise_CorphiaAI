/**
 * AI 回答裡的表格：右上角「下載 CSV」「複製到 Excel」，有數字欄就在下方直接畫長條圖（不用另外要求）
 *
 *   表格內容從畫好的 <table> 讀（lib/tableData 的 readTable），所以 Markdown 裡怎麼寫都一樣
 *   AI 還在打字時表格會一直長：內容停止變動 SETTLE_MS 之後才畫圖，不會一邊打字一邊跳
 *   下載的 CSV 前面有 BOM，Excel 直接打開中文不會變亂碼；「複製到 Excel」是用 Tab 分欄的文字，貼上會自動分格
 */
import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/components/icons/MaterialIcon'
import Tooltip from '@/components/ui/Tooltip'
import { copyText } from '@/lib/clipboard'
import { downloadBlob, todayStamp } from '@/lib/download'
import { chartPlan, readTable, toCsv, toTsv, type TableData } from '@/lib/tableData'

const TableChart = lazy(() => import('./TableChart'))

/** 表格停止變動多久才畫圖 */
const SETTLE_MS = 600
const ICON = 16

const sameTable = (a: TableData | null, b: TableData) => a !== null && JSON.stringify(a) === JSON.stringify(b)

export default function TableBlock({ children }: Readonly<{ children: ReactNode }>) {
    const { t } = useTranslation()
    const tableRef = useRef<HTMLTableElement>(null)
    const [data, setData] = useState<TableData | null>(null)
    const [settled, setSettled] = useState<TableData | null>(null)

    // 表格內容（children）變了就重讀一次（只有真的不一樣才更新）
    useLayoutEffect(() => {
        const el = tableRef.current
        if (!el) return
        const next = readTable(el)
        setData((prev) => (sameTable(prev, next) ? prev : next))
    }, [children])

    useEffect(() => {
        if (!data) return
        const id = window.setTimeout(() => setSettled(data), SETTLE_MS)
        return () => window.clearTimeout(id)
    }, [data])

    const plan = settled ? chartPlan(settled) : null
    const ready = data !== null && data.rows.length > 0

    return (
        <div className="md-table-block my-4">
            {ready && (
                <div className="md-table-tools">
                    <Tooltip label={t('ui.table.csv')}>
                        <button
                            type="button"
                            className="icon-tap"
                            aria-label={t('ui.table.csv')}
                            onClick={() => downloadBlob(new Blob([toCsv(data)], { type: 'text/csv;charset=utf-8' }), `corphia-table-${todayStamp()}.csv`)}
                        >
                            <MaterialIcon name="download" size={ICON} aria-hidden />
                        </button>
                    </Tooltip>
                    <Tooltip label={t('ui.table.excel')}>
                        <button type="button" className="icon-tap" aria-label={t('ui.table.excel')} onClick={() => void copyText(toTsv(data))}>
                            <MaterialIcon name="content_copy" size={ICON} aria-hidden />
                        </button>
                    </Tooltip>
                </div>
            )}
            <div className="md-table glass-chip overflow-x-auto overflow-y-hidden scrollbar-none">
                <table ref={tableRef}>{children}</table>
            </div>
            {plan && settled && (
                <Suspense fallback={null}>
                    <TableChart plan={plan} head={settled.head} />
                </Suspense>
            )}
        </div>
    )
}
