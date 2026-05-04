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

import {
    ChevronLeft,
    ChevronRight,
    Download,
    Search,
    X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from '@/lib/gsapMotion'
import { spring } from '@/lib/motionPresets'

import {
    ACTION_LABELS,
    RESOURCE_LABELS,
    type AuditLogItem,
    type AuditLogQuery,
} from '@/api/auditLogs'
import {
    Panel,
    SectionHeader,
    ActionButton,
    Field,
    inputClass,
    selectClass,
    formatDate,
} from '@/features/admin/components/AdminPrimitives'

// Pure helper — colors the action pill based on the verb.
// Lifted to module scope so it doesn't need to live on the component.
function getActionPillClass(action: string): string {
    const a = (action || '').toLowerCase()
    if (/(delete|disable|fail|revoke|deactivate|刪除|停用|失敗|撤銷)/.test(a)) {
        return 'border-red-500/30 bg-red-500/10 text-red-500'
    }
    if (/(login_success|token_refresh|activate|enable|登入成功|啟用|刷新)/.test(a)) {
        return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
    }
    if (/(create|update|register|建立|更新|註冊|新增)/.test(a)) {
        return 'border-sky-500/30 bg-sky-500/10 text-sky-500'
    }
    return 'border-border-subtle bg-bg-surface text-text-primary'
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
    onFilterChange,
    onPageChange,
    onExportCSV,
    onExportJSON,
}: AuditSectionProps) {
    const { t } = useTranslation()

    return (
        <>
            <div className="space-y-5">
                {/* Filter bar */}
                <Panel className="p-5">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
                        <Field label={t('common.search')}>
                            <div className="flex gap-2">
                                <input
                                    className={inputClass}
                                    value={auditSearchInput}
                                    onChange={(event) => setAuditSearchInput(event.target.value)}
                                    onKeyDown={(event) => event.key === 'Enter' && onSearch()}
                                    placeholder={t('admin.audit.searchPlaceholder')}
                                />
                                <ActionButton onClick={onSearch}>
                                    <Search className="h-4 w-4" />
                                    {t('common.search')}
                                </ActionButton>
                            </div>
                        </Field>
                        <Field label={t('admin.audit.action')}>
                            <select
                                className={selectClass}
                                value={auditFilter.action || ''}
                                onChange={(event) => onFilterChange('action', event.target.value)}
                            >
                                <option value="">{t('admin.audit.allActions')}</option>
                                <option value="login_success">{t('admin.audit.actionTypes.login_success')}</option>
                                <option value="login_failed">{t('admin.audit.actionTypes.login_failed')}</option>
                                <option value="user_update">{t('admin.audit.actionTypes.user_update')}</option>
                                <option value="document_upload">{t('admin.audit.actionTypes.document_upload')}</option>
                                <option value="document_delete">{t('admin.audit.actionTypes.document_delete')}</option>
                            </select>
                        </Field>
                        <Field label={t('admin.audit.resource')}>
                            <select
                                className={selectClass}
                                value={auditFilter.resource_type || ''}
                                onChange={(event) => onFilterChange('resource_type', event.target.value)}
                            >
                                <option value="">{t('admin.audit.allResources')}</option>
                                <option value="auth">{t('admin.audit.resourceTypes.auth')}</option>
                                <option value="user">{t('admin.audit.resourceTypes.user')}</option>
                                <option value="conversation">{t('admin.audit.resourceTypes.conversation')}</option>
                                <option value="document">{t('admin.audit.resourceTypes.document')}</option>
                                <option value="model">{t('admin.audit.resourceTypes.model')}</option>
                            </select>
                        </Field>
                        <div className="flex gap-2">
                            <ActionButton variant="secondary" onClick={onExportCSV}>
                                <Download className="h-4 w-4" />
                                CSV
                            </ActionButton>
                            <ActionButton variant="secondary" onClick={onExportJSON}>
                                <Download className="h-4 w-4" />
                                JSON
                            </ActionButton>
                        </div>
                    </div>
                </Panel>

                {/*
                  Audit log table.
                  Sticky header 修法：
                    - 不能在 Panel 上加 overflow-hidden —— `overflow:hidden` 會把
                      Panel 變成 sticky 的 scrolling-box，但 Panel 自己不滾，
                      導致 sticky 的「scroll ancestor」是不會動的容器，
                      sticky 跟著 Panel 一起被外層 scroll 拉上去 → 沒有黏住的效果。
                    - 改成不設 overflow，sticky 就會找到真正會滾的祖先（AdminPage
                      的 overflow-y-auto 內容區），可以正常黏在 viewport 頂端。
                    - 圓角靠 SectionHeader 上方 + 表格底端的 rounded class 各自處理；
                      因為內容（table）不會超出 Panel 邊界，不需要 overflow:hidden 截切。
                */}
                <Panel>
                    <div className="sticky top-0 z-20 bg-bg-base rounded-t-cv-lg">
                        <SectionHeader
                            title={t('admin.audit.title')}
                            eyebrow={`${auditTotal.toLocaleString()} ${t('admin.audit.events')}`}
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
                        <div className="grid grid-cols-[110px_minmax(0,1fr)] sm:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)_140px] border-b border-border-subtle text-left text-xs uppercase tracking-wider text-text-secondary">
                            <div className="px-3 sm:px-5 py-2.5">{t('admin.audit.table.time')}</div>
                            <div className="px-3 sm:px-5 py-2.5">{t('admin.audit.table.action')}</div>
                            <div className="hidden sm:block px-5 py-2.5">{t('admin.audit.table.resource')}</div>
                            <div className="hidden sm:block px-5 py-2.5">{t('admin.audit.table.user')}</div>
                            <div className="hidden sm:block px-5 py-2.5">{t('admin.audit.table.ip')}</div>
                        </div>
                    </div>
                    {/* table 包一層 overflow-hidden 處理底部圓角，
                        但只蓋表格本身，不會吃到 sticky header 的 scrolling box */}
                    <div className="overflow-hidden rounded-b-cv-lg">
                        <table className="w-full table-fixed">
                            <colgroup>
                                <col className="w-[110px] sm:w-[180px]" />
                                <col />
                                <col className="hidden sm:table-column" />
                                <col className="hidden sm:table-column" />
                                <col className="hidden sm:table-column sm:w-[140px]" />
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
                            <tbody className="divide-y divide-border-subtle">
                                {isLoadingAudit ? (
                                    <tr>
                                        <td className="px-5 py-10 text-center text-text-secondary" colSpan={5}>
                                            {t('common.loading')}
                                        </td>
                                    </tr>
                                ) : auditLogs.length === 0 ? (
                                    <tr>
                                        <td className="px-5 py-10 text-center text-text-secondary" colSpan={5}>
                                            {t('admin.audit.noEvents')}
                                        </td>
                                    </tr>
                                ) : (
                                    auditLogs.map((log) => (
                                        <tr
                                            key={log.id}
                                            className="transition hover:bg-white/[0.04] dark:hover:bg-white/[0.04] cursor-pointer"
                                            onClick={() => setAuditDrawer(log)}
                                        >
                                            <td className="px-3 sm:px-5 py-2 text-[11px] sm:text-sm text-text-secondary whitespace-nowrap">
                                                {formatDate(log.created_at)}
                                            </td>
                                            <td className="px-3 sm:px-5 py-2">
                                                <span
                                                    className={`rounded-full border px-2 sm:px-3 py-0.5 text-[10px] sm:text-xs font-semibold ${getActionPillClass(log.action)}`}
                                                >
                                                    {t(`admin.audit.actionTypes.${log.action}`, {
                                                        defaultValue: ACTION_LABELS[log.action] || log.action,
                                                    })}
                                                </span>
                                            </td>
                                            <td className="hidden sm:table-cell px-5 py-2 text-sm text-text-primary">
                                                {t(`admin.audit.resourceTypes.${log.resource_type}`, {
                                                    defaultValue: RESOURCE_LABELS[log.resource_type] || log.resource_type,
                                                })}
                                            </td>
                                            <td className="hidden sm:table-cell max-w-[180px] truncate px-5 py-2 text-sm text-text-secondary">
                                                {log.user_email || log.user_id || '-'}
                                            </td>
                                            <td className="hidden sm:table-cell px-5 py-2 font-mono text-xs text-text-secondary/70">
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
                            className="fixed inset-0 bg-black/40 z-40"
                            onClick={() => setAuditDrawer(null)}
                        />
                        <motion.aside
                            key="audit-drawer"
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={spring}
                            className="fixed top-0 right-0 bottom-0 w-full sm:w-[480px] bg-bg-surface/90 supports-[backdrop-filter]:bg-bg-surface/72 backdrop-blur-2xl border-l border-white/40 dark:border-white/20 z-50 overflow-y-auto custom-scrollbar shadow-[0_0_60px_rgb(0_0_0/0.18)]"
                            role="dialog"
                            aria-label="audit detail"
                        >
                            <div className="sticky top-0 bg-bg-surface border-b border-border-subtle px-5 py-4 flex items-center justify-between">
                                <div>
                                    <p className="text-[12px] font-bold uppercase tracking-wider text-accent">
                                        {t('admin.audit.detailEyebrow', '稽核細節')}
                                    </p>
                                    <h3 className="mt-0.5 text-base font-semibold text-text-primary">
                                        {t(`admin.audit.actionTypes.${auditDrawer.action}`, {
                                            defaultValue: ACTION_LABELS[auditDrawer.action] || auditDrawer.action,
                                        })}
                                    </h3>
                                </div>
                                <button
                                    onClick={() => setAuditDrawer(null)}
                                    className="p-2 rounded-full text-text-muted hover:text-text-primary hover:bg-bg-base transition-colors"
                                    aria-label={t('common.close', '關閉')}
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                            <dl className="px-5 py-4 space-y-3 text-sm">
                                {(
                                    [
                                        [t('admin.audit.table.time'), formatDate(auditDrawer.created_at)],
                                        [t('admin.audit.table.action'), auditDrawer.action],
                                        [
                                            t('admin.audit.table.resource'),
                                            auditDrawer.resource_type +
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
                                    <p className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-2">
                                        {t('admin.audit.detailPayload', 'Payload')}
                                    </p>
                                    <pre className="p-4 rounded-[12px] border border-border-subtle bg-bg-base text-[12px] text-text-primary overflow-x-auto">
                                        {JSON.stringify(auditDrawer.details, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>
        </>
    )
}
