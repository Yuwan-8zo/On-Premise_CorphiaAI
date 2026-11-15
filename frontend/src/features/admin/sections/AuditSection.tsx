/**
 * Admin > Audit tab
 * -----------------
 * Layout:
 *   1. Filter bar — search input + action select + resource select + CSV/JSON export
 *   2. Audit log table — sticky header (title row + column row in one container,
 *      so they stay aligned during scroll); rows are clickable to open drawer
 *   3. Detail drawer — slides in from the right with full audit log details
 *
 * Sticky header trick:
 *   The Panel has `overflow-hidden`, so the sticky `<div>` inside is clipped to
 *   the panel's rounded corners — preserving pill shape even when scrolled past.
 *   Column header is rendered as a 5-column grid (NOT a real <thead>) so it
 *   stays aligned with the body's `colgroup` while remaining sticky.
 */

import StyledSelect from '@/components/ui/StyledSelect'
import SearchField from '@/components/ui/SearchField'
import { useScrollFade } from '@/lib/useScrollFade'
import { useMediaQuery, MQ_DESKTOP } from '@/lib/useMediaQuery'
import {
    ChevronLeft,
    ChevronRight,
    Download,
    Shield,
    X,
} from '@/components/snow/icons'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from '@/lib/gsapMotion'
import { spring } from '@/lib/motionPresets'
import { SkelText } from '@/components/ui/Skeleton'

import {
    AUDIT_ACTIONS,
    AUDIT_RESOURCES,
    type AuditLogItem,
    type AuditLogQuery,
} from '@/api/auditLogs'
import {
    Panel,
    SectionHeader,
    ActionButton,
    tableBodyClass,
    tableEmptyCellClass,
} from '@/features/admin/components/AdminPrimitives'
import AuditChainCheck from '@/features/admin/components/AuditChainCheck'
import { formatDate } from '@/features/admin/utils/formatDate'
import { auditActionLabel, auditResourceLabel } from '@/features/admin/utils/auditLabels'

// 依操作代碼的動詞決定標籤顏色（收到的是代碼，不是翻譯後的文字）
function getActionPillClass(action: string): string {
    const a = (action || '').toLowerCase()
    if (/(delete|disable|fail|revoke|deactivate)/.test(a)) {
        return 'tag-red'
    }
    if (/(login_success|token_refresh|activate|enable)/.test(a)) {
        return 'tag-green'
    }
    if (/(create|update|register)/.test(a)) {
        return 'tag-accent'
    }
    return ''
}

// 嚴重度分級：區分 critical / warning / info
function getSeverityClass(action: string): string {
    const CRITICAL_ACTIONS = ['pii_detected', 'prompt_injection_blocked', 'dlp_hit', 'account_locked']
    const WARNING_ACTIONS = ['login_failed', 'token_revoke', 'ngrok_start']

    if (CRITICAL_ACTIONS.includes(action)) {
        return 'border-l-4 border-l-red-500 bg-[color-mix(in_srgb,var(--sys-red)_10%,transparent)]'
    }
    if (WARNING_ACTIONS.includes(action)) {
        return 'border-l-4 border-l-amber-500 bg-[color-mix(in_srgb,var(--sys-orange)_10%,transparent)]'
    }
    return ''
}

export interface AuditSectionProps {
    auditSearchInput: string
    setAuditSearchInput: (value: string) => void
    auditFilter: AuditLogQuery
    auditLogs: AuditLogItem[]
    auditTotal: number
    auditPage: number
    auditTotalPages: number
    isLoadingAudit: boolean
    auditDrawer: AuditLogItem | null
    setAuditDrawer: (log: AuditLogItem | null) => void
    onSearch: () => void
    /** 清空搜尋字並重新查詢全部 */
    onClearSearch: () => void
    onFilterChange: (key: 'action' | 'resource_type', value: string) => void
    onPageChange: (page: number) => void
    onExportCSV: () => void
    onExportJSON: () => void
}

export default function AuditSection({
    auditSearchInput,
    setAuditSearchInput,
    auditFilter,
    auditLogs,
    auditTotal,
    auditPage,
    auditTotalPages,
    isLoadingAudit,
    auditDrawer,
    setAuditDrawer,
    onSearch,
    onClearSearch,
    onFilterChange,
    onPageChange,
    onExportCSV,
    onExportJSON,
}: AuditSectionProps) {
    const { t } = useTranslation()
    const drawerScrollRef = useScrollFade()
    // 手機版：聚焦時右邊長出取消 ×（收鍵盤、清空）；桌機有滑鼠就不需要
    const desktop = useMediaQuery(MQ_DESKTOP)

    return (
        <>
            {/* 整頁填滿內容區、不捲動：篩選卡固定在上，稽核大卡片吃剩下的高度，表格在卡片「裡面」捲動
                (外層內容區捲動時，卡片會被它直直切掉，底部和捲上去的上緣都失去圓角) */}
            <div className="flex h-full min-h-0 flex-col gap-[var(--space)]">
                {/* Filter bar */}
                <Panel className="p-[var(--space)] shrink-0">
                    {/* 篩選列（Apple）：搜尋欄＋兩個下拉選單＋動作鈕排成一列，窄螢幕自動換行；不在欄位上方放標題 */}
                    {/* 搜尋欄和右邊的膠囊鈕同高（--sz-40），整列對齊；下拉選單 140～180 之間伸縮，窄一點的螢幕也排得下一列、搜尋欄放得下提示字 */}
                    <div className="flex flex-wrap items-center gap-[var(--space)] [--search-h:var(--sz-40)]">
                        <SearchField
                            className="flex-1 min-w-[var(--sz-200)]"
                            value={auditSearchInput}
                            onChange={setAuditSearchInput}
                            onSubmit={onSearch}
                            onClear={onClearSearch}
                            cancelable={!desktop}
                            placeholder={t('admin.audit.searchPlaceholder')}
                        />
                        <div className="w-full sm:w-auto sm:flex-[1_1_var(--sz-140)] sm:max-w-[var(--sz-180)]">
                            <StyledSelect
                                value={auditFilter.action || ''}
                                onChange={(v) => onFilterChange('action', v)}
                                options={[
                                    { value: '', label: t('admin.audit.allActions') },
                                    ...AUDIT_ACTIONS.map((a) => ({ value: a, label: auditActionLabel(t, a) })),
                                ]}
                            />
                        </div>
                        <div className="w-full sm:w-auto sm:flex-[1_1_var(--sz-140)] sm:max-w-[var(--sz-180)]">
                            <StyledSelect
                                value={auditFilter.resource_type || ''}
                                onChange={(v) => onFilterChange('resource_type', v)}
                                options={[
                                    { value: '', label: t('admin.audit.allResources') },
                                    ...AUDIT_RESOURCES.map((r) => ({ value: r, label: auditResourceLabel(t, r) })),
                                ]}
                            />
                        </div>
                        <div className="flex gap-2">
                            {/* 資安事件篩選：和匯出鈕同尺寸的膠囊，選取時改紅色 */}
                            <button
                                type="button"
                                aria-pressed={!!(auditFilter.action?.includes('pii_detected') || auditFilter.action?.includes('login_failed'))}
                                onClick={() => {
                                    const securityActions = ['pii_detected', 'prompt_injection_blocked', 'dlp_hit', 'login_failed', 'account_locked', 'token_revoke', 'ngrok_start']
                                    onFilterChange('action', auditFilter.action === securityActions.join(',') ? '' : securityActions.join(','))
                                }}
                                className={`btn !h-[var(--sz-40)] !px-[var(--sp-18)] !text-[length:var(--fs-14)] whitespace-nowrap ${
                                    auditFilter.action?.includes('pii_detected') || auditFilter.action?.includes('login_failed')
                                        ? 'btn-danger-solid'
                                        : 'btn-secondary'
                                }`}
                            >
                                <Shield className="h-4 w-4" />
                                {t('admin.audit.securityEventsOnly', '只看資安事件')}
                            </button>
                            <ActionButton variant="secondary" onClick={onExportCSV}>
                                <Download className="h-4 w-4" />
                                CSV
                            </ActionButton>
                            <ActionButton variant="secondary" onClick={onExportJSON}>
                                <Download className="h-4 w-4" />
                                JSON
                            </ActionButton>
                            <AuditChainCheck />
                        </div>
                    </div>
                </Panel>

                {/* 稽核表：卡片本身裁切成圓角（overflow-hidden），標題與欄名固定在卡片上方，只有表格列在卡片內捲動 */}
                <Panel className="admin-fill flex-1">
                    <div className="shrink-0">
                        <SectionHeader
                            title={t('admin.audit.title')}
                            eyebrow={isLoadingAudit && !auditTotal ? <SkelText>{`0,000 ${t('admin.audit.events')}`}</SkelText> : `${auditTotal.toLocaleString()} ${t('admin.audit.events')}`}
                            action={
                                <div className="flex items-center gap-2">
                                    <ActionButton
                                        variant="secondary"
                                        disabled={auditPage <= 1}
                                        onClick={() => onPageChange(auditPage - 1)}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </ActionButton>
                                    <span className="text-sm text-text-secondary">
                                        {auditPage} / {auditTotalPages || 1}
                                    </span>
                                    <ActionButton
                                        variant="secondary"
                                        disabled={auditPage >= auditTotalPages}
                                        onClick={() => onPageChange(auditPage + 1)}
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </ActionButton>
                                </div>
                            }
                        />
                        {/* Column header row — same grid template as the tbody rows
                            手機板僅顯示 時間 + 操作；resource / user / ip 在 sm+ 才出現
                            點任一列仍可開 drawer 看完整資料 */}
                        <div className="grid grid-cols-[var(--sz-110)_minmax(0,1fr)] sm:grid-cols-[var(--audit-time)_var(--audit-action)_var(--audit-res)_minmax(0,1fr)_var(--audit-ip)] border-b border-[var(--paper-line)] text-left text-[length:var(--fs-13)] font-semibold text-text-secondary">
                            <div className="px-3 sm:px-5 py-2.5">{t('admin.audit.table.time')}</div>
                            <div className="px-3 sm:px-5 py-2.5">{t('admin.audit.table.action')}</div>
                            <div className="hidden sm:block px-5 py-2.5">{t('admin.audit.table.resource')}</div>
                            <div className="hidden sm:block px-5 py-2.5">{t('admin.audit.table.user')}</div>
                            <div className="hidden sm:block px-5 py-2.5">{t('admin.audit.table.ip')}</div>
                        </div>
                    </div>
                    {/* 表格列：在卡片裡捲動（卡片的 overflow-hidden 負責四個圓角） */}
                    <div className="admin-fill-body">
                        <table className="w-full table-fixed">
                            <colgroup>
                                <col className="w-[var(--sz-110)] sm:w-[var(--audit-time)]" />
                                <col className="sm:w-[var(--audit-action)]" />
                                <col className="hidden sm:table-column sm:w-[var(--audit-res)]" />
                                <col className="hidden sm:table-column" />
                                <col className="hidden sm:table-column sm:w-[var(--audit-ip)]" />
                            </colgroup>
                            <thead className="hidden">
                                <tr>
                                    <th>{t('admin.audit.table.time')}</th>
                                    <th>{t('admin.audit.table.action')}</th>
                                    <th>{t('admin.audit.table.resource')}</th>
                                    <th>{t('admin.audit.table.user')}</th>
                                    <th>{t('admin.audit.table.ip')}</th>
                                </tr>
                            </thead>
                            <tbody className={tableBodyClass}>
                                {isLoadingAudit ? (
                                    // 和下面的資料列同一組儲存格與字級，列高一樣（操作欄是標籤膠囊）
                                    Array.from({ length: 10 }, (_, i) => (
                                        <tr key={i} aria-hidden>
                                            <td className="px-3 sm:px-5 py-2 text-[length:var(--fs-11)] sm:text-sm whitespace-nowrap"><SkelText>{formatDate(new Date().toISOString())}</SkelText></td>
                                            <td className="px-3 sm:px-5 py-2"><span className="tag"><SkelText>{i % 2 ? '0000' : '000000'}</SkelText></span></td>
                                            <td className="hidden sm:table-cell px-5 py-2 text-sm"><SkelText>00</SkelText></td>
                                            <td className="hidden sm:table-cell max-w-[var(--sz-180)] truncate px-5 py-2 text-sm"><SkelText>user@example.com</SkelText></td>
                                            <td className="hidden sm:table-cell px-5 py-2 tabular-nums text-xs"><SkelText>127.0.0.1</SkelText></td>
                                        </tr>
                                    ))
                                ) : auditLogs.length === 0 ? (
                                    <tr>
                                        <td className={tableEmptyCellClass} colSpan={5}>
                                            {t('admin.audit.noEvents')}
                                        </td>
                                    </tr>
                                ) : (
                                    auditLogs.map((log) => (
                                        <tr
                                            key={log.id}
                                            className={`transition cursor-pointer ${getSeverityClass(log.action)}  `}
                                            onClick={() => setAuditDrawer(log)}
                                        >
                                            <td className="px-3 sm:px-5 py-2 text-[length:var(--fs-11)] sm:text-sm text-text-secondary whitespace-nowrap">
                                                {formatDate(log.created_at)}
                                            </td>
                                            <td className="px-3 sm:px-5 py-2">
                                                <span
                                                    className={`tag ${getActionPillClass(log.action)}`}
                                                >
                                                    {auditActionLabel(t, log.action)}
                                                </span>
                                            </td>
                                            <td className="hidden sm:table-cell px-5 py-2 text-sm text-text-primary">
                                                {auditResourceLabel(t, log.resource_type)}
                                            </td>
                                            <td className="hidden sm:table-cell max-w-[var(--sz-180)] truncate px-5 py-2 text-sm text-text-secondary">
                                                {log.user_email || log.user_id || '-'}
                                            </td>
                                            <td className="hidden sm:table-cell px-5 py-2 tabular-nums text-xs text-text-secondary">
                                                {log.ip_address || '-'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Panel>
            </div>

            {/* Detail drawer — slides in from the right when a row is clicked */}
            <AnimatePresence>
                {auditDrawer && (
                    <>
                        <motion.div
                            key="audit-drawer-backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/20 dark:bg-black/45 z-40"
                            onClick={() => setAuditDrawer(null)}
                        />
                        <motion.aside
                            key="audit-drawer"
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={spring}
                            className="fixed top-0 right-0 bottom-0 w-full sm:w-[var(--sz-480)] paper !rounded-none sm:!rounded-l-[var(--r-25)] z-50 flex flex-col overflow-hidden"
                            role="dialog"
                            aria-label="audit detail"
                        >
                            <div className="shrink-0 px-[var(--sp-26)] py-4 flex items-center justify-between">
                                <div>
                                    <p className="text-[length:var(--fs-12)] font-bold text-accent">
                                        {t('admin.audit.detailEyebrow', '稽核細節')}
                                    </p>
                                    <h3 className="mt-0.5 text-base font-semibold text-text-primary">
                                        {auditActionLabel(t, auditDrawer.action)}
                                    </h3>
                                </div>
                                <button
                                    onClick={() => setAuditDrawer(null)}
                                    className="btn-icon !w-10 !h-10 text-text-secondary"
                                    aria-label={t('common.close', '關閉')}
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                            {/* 抽屜本身不捲、這層捲（玻璃光邊才不會跟著內容捲走） */}
                            <div ref={drawerScrollRef} className="glass-scroll flex-1 min-h-0">
                            <dl className="px-5 py-4 space-y-3 text-sm">
                                {(
                                    [
                                        [t('admin.audit.table.time'), formatDate(auditDrawer.created_at)],
                                        [t('admin.audit.table.action'), auditActionLabel(t, auditDrawer.action)],
                                        [
                                            t('admin.audit.table.resource'),
                                            auditResourceLabel(t, auditDrawer.resource_type) +
                                                (auditDrawer.resource_id ? ` · ${auditDrawer.resource_id}` : ''),
                                        ],
                                        [t('admin.audit.table.user'), auditDrawer.user_email || auditDrawer.user_id || '-'],
                                        [t('admin.audit.table.ip'), auditDrawer.ip_address || '-'],
                                        [t('admin.audit.detailDescription', '描述'), auditDrawer.description || '-'],
                                        [t('admin.audit.detailUserAgent', 'User Agent'), auditDrawer.user_agent || '-'],
                                    ] as Array<[string, string]>
                                ).map(([label, value]) => (
                                    <div key={label} className="grid grid-cols-[120px_1fr] gap-3">
                                        <dt className="text-text-muted">{label}</dt>
                                        <dd className="text-text-primary break-all">{value}</dd>
                                    </div>
                                ))}
                            </dl>
                            {auditDrawer.details && Object.keys(auditDrawer.details).length > 0 && (
                                <div className="px-5 pb-6">
                                    <p className="text-xs font-bold text-text-secondary mb-2">
                                        {t('admin.audit.detailPayload', 'Payload')}
                                    </p>
                                    <pre className="p-4 rounded-[var(--r-14)] snow-well text-[length:var(--fs-12)] text-text-primary overflow-x-auto">
                                        {JSON.stringify(auditDrawer.details, null, 2)}
                                    </pre>
                                </div>
                            )}
                            </div>
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>
        </>
    )
}
