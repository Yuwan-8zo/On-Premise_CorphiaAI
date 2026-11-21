/**
 * 稽核細節視窗（管理後台 → 稽核，點一筆紀錄從右邊滑出；手機全螢幕）
 * --------------------------------------------------------------------
 * 版面（照《Liquid Glass 元件規範》：實色卡片、分組清單、iOS 字級）：
 *   1. 標題＝操作名稱，下面一行是完整時間（不再另外列一次「操作」）
 *   2. 描述：一句白話說明，放在最上面的卡片
 *   3. 「事件內容」：附加資料翻成白話欄位（utils/auditDetails.ts）＋對象（資源種類＋短編號，可複製）
 *   4. 「操作者」：帳號、IP 位址、裝置／瀏覽器
 *   5. 認不得的欄位才收在可展開的「原始資料」
 * 沒有值的欄位整列不顯示，不放「-」。
 */
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { AuditLogItem } from '@/api/auditLogs'
import { Check, ChevronDown, Copy, X } from '@/components/snow/icons'
import { copyText } from '@/lib/clipboard'
import { motion, AnimatePresence } from '@/lib/gsapMotion'
import { spring } from '@/lib/motionPresets'
import { useScrollFade } from '@/lib/useScrollFade'
import { auditActionLabel, auditResourceLabel } from '@/features/admin/utils/auditLabels'
import {
    describeAuditDetails,
    describeIp,
    describeUserAgent,
    formatFullDate,
    isLongId,
    shortId,
    type AuditField,
} from '@/features/admin/utils/auditDetails'

/** 「已複製」打勾維持多久（毫秒）後變回複製圖示 */
const COPIED_MS = 1600

function CopyButton({ value, label }: Readonly<{ value: string; label: string }>) {
    const { t } = useTranslation()
    const [copied, setCopied] = useState(false)
    useEffect(() => {
        if (!copied) return
        const id = setTimeout(() => setCopied(false), COPIED_MS)
        return () => clearTimeout(id)
    }, [copied])
    return (
        <button
            type="button"
            onClick={() => void copyText(value).then((ok) => ok && setCopied(true))}
            aria-label={copied ? t('ui.message.copied') : t('admin.audit.detail.copy', { label })}
            title={copied ? t('ui.message.copied') : t('admin.audit.detail.copy', { label })}
            // 點擊範圍比一行字高：上下負邊距抵掉，有複製鈕的列和其他列一樣高
            className="icon-tap shrink-0 -my-[var(--sp-4)] text-text-muted"
        >
            {copied ? <Check className="h-4 w-4 text-[var(--sys-green)]" /> : <Copy className="h-4 w-4" />}
        </button>
    )
}

/** 分組清單：組名（Footnote）＋實色卡片，列之間細分隔線 */
function Group({ title, rows }: Readonly<{ title: string; rows: AuditField[] }>) {
    if (rows.length === 0) return null
    return (
        <section>
            <h4 className="px-[var(--sp-16)] pb-[var(--sp-6)] text-[length:var(--fs-13)] leading-[var(--lh-18)] font-semibold text-text-secondary">
                {title}
            </h4>
            <dl className="rounded-[var(--r-16)] snow-well divide-y divide-[var(--paper-line)]">
                {rows.map((row) => (
                    <div
                        key={row.key}
                        className="grid grid-cols-[var(--audit-label)_minmax(0,1fr)] items-baseline gap-[var(--sp-12)] px-[var(--sp-16)] py-[var(--sp-12)] text-[length:var(--fs-15)] leading-[var(--lh-20)]"
                    >
                        <dt className="text-text-secondary">{row.label}</dt>
                        <dd className="flex min-w-0 items-center gap-[var(--sp-8)] text-text-primary">
                            <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">{row.value}</span>
                            {row.copy && <CopyButton value={row.copy} label={row.label} />}
                        </dd>
                    </div>
                ))}
            </dl>
        </section>
    )
}

export interface AuditDetailDrawerProps {
    log: AuditLogItem | null
    onClose: () => void
}

export default function AuditDetailDrawer({ log, onClose }: Readonly<AuditDetailDrawerProps>) {
    return <AnimatePresence>{log && <DrawerBody key={log.id} log={log} onClose={onClose} />}</AnimatePresence>
}

function DrawerBody({ log, onClose }: Readonly<{ log: AuditLogItem; onClose: () => void }>) {
    const { t } = useTranslation()
    const scrollRef = useScrollFade()
    const [showRaw, setShowRaw] = useState(false)

    // Esc 關閉
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [onClose])

    const { fields, raw } = useMemo(() => describeAuditDetails(t, log), [t, log])
    const title = auditActionLabel(t, log.action)

    const eventRows: AuditField[] = [...fields]
    if (log.resource_type) {
        const id = log.resource_id ?? ''
        // 資源編號是 UUID 就只露前 8 碼、可複製完整的；其他短代碼（例如 security_gates）不重複顯示
        eventRows.push({
            key: '__resource',
            label: t('admin.audit.detail.fields.target'),
            value: auditResourceLabel(t, log.resource_type) + (id && isLongId(id) ? ` · ${shortId(id)}` : ''),
            copy: id && isLongId(id) ? id : undefined,
        })
    }
    // 有些事件（AI 產出檔案、工具呼叫、內容過濾）後端只存使用者編號、沒存信箱：改顯示短編號，可複製完整的
    const userId = log.user_id ?? ''
    const userRow: AuditField = log.user_email
        ? { key: '__user', label: t('admin.audit.detail.fields.account'), value: log.user_email }
        : { key: '__user', label: t('admin.audit.detail.fields.userId'), value: shortId(userId), copy: isLongId(userId) ? userId : undefined }
    const actorRows: AuditField[] = [
        userRow,
        { key: '__ip', label: t('admin.audit.table.ip'), value: describeIp(t, log.ip_address) },
        { key: '__ua', label: t('admin.audit.detail.fields.device'), value: describeUserAgent(log.user_agent) },
    ].filter((r) => r.value)

    return (
        <>
            <motion.div
                key="audit-drawer-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-[var(--scrim)] z-[var(--z-drawer)]"
                onClick={onClose}
            />
            <motion.aside
                key="audit-drawer"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={spring}
                className="fixed top-0 right-0 bottom-0 w-full sm:w-[var(--sz-480)] paper paper-solid !rounded-none sm:!rounded-l-[var(--r-25)] z-50 flex flex-col overflow-hidden"
                role="dialog"
                aria-modal="true"
                aria-label={t('admin.audit.detail.dialogLabel', { action: title })}
            >
                {/* 標題列：操作名稱＋完整時間；右邊關閉鈕 */}
                <div className="shrink-0 flex items-center justify-between gap-[var(--sp-12)] px-[var(--edge)] pt-[var(--edge)] pb-[var(--sp-12)]">
                    <div className="min-w-0">
                        <h3 className="text-[length:var(--fs-17)] leading-[var(--lh-22)] font-semibold text-text-primary">{title}</h3>
                        <p className="mt-[var(--sp-2)] text-[length:var(--fs-13)] leading-[var(--lh-18)] text-text-secondary tabular-nums">
                            {formatFullDate(log.created_at)}
                        </p>
                    </div>
                    <button onClick={onClose} className="btn-icon !w-10 !h-10 shrink-0 text-text-secondary" aria-label={t('common.close', '關閉')}>
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* 抽屜本身不捲、這層捲（玻璃光邊才不會跟著內容捲走） */}
                <div ref={scrollRef} className="glass-scroll flex-1 min-h-0">
                    <div className="flex flex-col gap-[var(--sp-20)] px-[var(--edge)] pb-[var(--edge)] pt-[var(--sp-4)]">
                        {log.description && (
                            <p className="rounded-[var(--r-16)] snow-well px-[var(--sp-16)] py-[var(--sp-12)] text-[length:var(--fs-15)] leading-[var(--lh-20)] text-text-primary break-words [overflow-wrap:anywhere]">
                                {log.description}
                            </p>
                        )}
                        <Group title={t('admin.audit.detail.eventGroup')} rows={eventRows} />
                        <Group title={t('admin.audit.detail.actorGroup')} rows={actorRows} />

                        {raw && (
                            <section>
                                <button
                                    type="button"
                                    aria-expanded={showRaw}
                                    onClick={() => setShowRaw((v) => !v)}
                                    className="flex w-full items-center justify-between rounded-[var(--r-16)] snow-well px-[var(--sp-16)] py-[var(--sp-12)] text-[length:var(--fs-15)] leading-[var(--lh-20)] text-text-primary"
                                >
                                    <span>{t('admin.audit.detail.rawData')}</span>
                                    <ChevronDown
                                        className={`h-4 w-4 text-text-muted transition-transform duration-200 ${showRaw ? 'rotate-180' : ''}`}
                                    />
                                </button>
                                {showRaw && (
                                    <>
                                        <p className="px-[var(--sp-16)] pt-[var(--sp-8)] text-[length:var(--fs-13)] leading-[var(--lh-18)] text-text-secondary">
                                            {t('admin.audit.detail.rawHint')}
                                        </p>
                                        <pre className="mt-[var(--sp-8)] p-[var(--sp-16)] rounded-[var(--r-16)] snow-well text-[length:var(--fs-12)] leading-[var(--lh-16)] text-text-primary whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                                            {JSON.stringify(raw, null, 2)}
                                        </pre>
                                    </>
                                )}
                            </section>
                        )}
                    </div>
                </div>
            </motion.aside>
        </>
    )
}
