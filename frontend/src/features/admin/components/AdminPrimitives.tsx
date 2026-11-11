/**
 * Admin shared UI primitives
 * --------------------------
 * Extracted from AdminPage.tsx to keep the main page focused on data + layout.
 *
 * Design language (matches login + chat pages):
 *   - Flat: bg-bg-base + border-[var(--paper-line)], no glass/big-shadow/28px-radius
 *   - Single radius token: rounded-[var(--r-18)]
 *   - Whitespace via padding, not via outer glow
 */

import { parseServerDate } from '@/lib/utils'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from '@/lib/gsapMotion'

// ---------------------------------------------------------------------------
// Panel — flat surface card with hairline border.
// ---------------------------------------------------------------------------

export function Panel({
    className = '',
    children,
}: {
    className?: string
    children: React.ReactNode
}) {
    return (
        <section
            // 後台所有卡片統一圓角 --admin-r；裡面的元件用 --admin-in（＝卡片圓角 − 間距，同心），見 snow.css .admin-shell
            className={`paper !rounded-[var(--admin-r)] ${className}`}
        >
            {children}
        </section>
    )
}

// ---------------------------------------------------------------------------
// SectionHeader — title strip at the top of a Panel, with optional subtitle (shown below the title)
// and right-aligned action slot.
// ---------------------------------------------------------------------------

export function SectionHeader({
    title,
    eyebrow,
    action,
}: {
    title: string
    eyebrow?: string
    action?: React.ReactNode
}) {
    return (
        <div className="flex flex-col gap-3 pl-[var(--sp-21)] pr-[var(--sp-16)] pt-[var(--sp-16)] pb-[var(--space)] md:flex-row md:flex-wrap md:items-center md:justify-between">
            <div className="min-w-0 md:shrink-0 md:max-w-full">
                {/* 規範：標題上方不放眉標；補充資訊放在標題下方（Footnote 13/18 次要文字） */}
                <h2 className="truncate text-[length:var(--fs-17)] leading-[var(--lh-22)] font-semibold text-text-primary">
                    {title}
                </h2>
                {eyebrow && <p className="mt-0.5 text-[length:var(--fs-13)] leading-[var(--lh-18)] text-text-secondary">{eyebrow}</p>}
            </div>
            {action}
        </div>
    )
}

// ---------------------------------------------------------------------------
// ActionButton — pill button with three variants. Aligns visually with the
// login page submit button (primary) and chat page secondary actions.
// ---------------------------------------------------------------------------

export function ActionButton({
    children,
    onClick,
    variant = 'primary',
    disabled,
}: {
    children: React.ReactNode
    onClick?: () => void
    variant?: 'primary' | 'secondary' | 'danger'
    disabled?: boolean
}) {
    // Apple 樣式：主要＝實心品牌色膠囊、次要＝灰色毛玻璃、危險＝紅字灰底
    const variants = {
        primary: 'btn-primary',
        secondary: 'btn-secondary',
        danger: 'btn-danger',
    }
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`btn !h-[var(--sz-40)] !px-[var(--sp-18)] !text-[length:var(--fs-14)] shrink-0 min-w-max ${variants[variant]}`}
        >
            {children}
        </button>
    )
}

// ---------------------------------------------------------------------------
// StatusPill — tag capsule: green (完成) when active, plain when disabled.
// ---------------------------------------------------------------------------

export function StatusPill({ active }: { active: boolean }) {
    const { t } = useTranslation()
    return (
        <span
            className={`tag ${active ? 'tag-green' : ''}`}
        >
            {active ? t('common.active') : t('common.disabled')}
        </span>
    )
}

// ---------------------------------------------------------------------------
// RoleBadge — tag capsule for user roles (規範：標籤膠囊).
// ---------------------------------------------------------------------------

export type AdminUserRole = 'engineer' | 'admin' | 'user'

export function RoleBadge({ role }: { role: AdminUserRole }) {
    const { t } = useTranslation()
    const styles = {
        admin: 'tag-accent',
        engineer: 'tag-accent',
        user: '',
    }
    const roleLabels = {
        admin: t('admin.users.role.admin', { defaultValue: 'Admin' }),
        engineer: t('admin.users.role.engineer', { defaultValue: 'Engineer' }),
        user: t('admin.users.role.user', { defaultValue: 'User' }),
    }
    return (
        <span
            className={`tag ${styles[role]}`}
        >
            {roleLabels[role]}
        </span>
    )
}

// ---------------------------------------------------------------------------
// ModalFrame — backdrop + centered glass card. Used as a wrapper for all
// admin modals (create user, edit tenant, etc.). Renders into document.body
// via portal so it sits above the rest of the admin chrome.
// ---------------------------------------------------------------------------

export function ModalFrame({
    children,
    onClose,
    maxWidth = 'max-w-md',
}: {
    children: React.ReactNode
    onClose: () => void
    maxWidth?: string
}) {
    return createPortal(
        <AnimatePresence>
            <motion.div
                key="admin-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 bg-black/20 dark:bg-black/45 backdrop-blur-md"
                onClick={onClose}
            />
            <motion.div
                key="admin-modal"
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
                <div
                    className={`relative w-full ${maxWidth} paper !rounded-[var(--r-32)] p-6 text-text-primary pointer-events-auto`}
                    onClick={(e) => e.stopPropagation()}
                >
                    {children}
                </div>
            </motion.div>
        </AnimatePresence>,
        document.body,
    )
}

// ---------------------------------------------------------------------------
// Field — label + child slot for form rows.
// ---------------------------------------------------------------------------

export function Field({
    label,
    children,
}: {
    label: string
    children: React.ReactNode
}) {
    return (
        <label className="block">
            <span className="mb-2 block text-xs font-semibold text-text-secondary">
                {label}
            </span>
            {children}
        </label>
    )
}

// ---------------------------------------------------------------------------
// Form input class strings — shared between user form, audit filters, etc.
// Kept as plain strings (not components) so consumers can compose them with
// other Tailwind classes freely.
// ---------------------------------------------------------------------------

export const inputClass =
    'w-full rounded-[var(--r-10)] snow-field px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent focus:bg-[var(--chip)] focus:ring-2 focus:ring-accent/15 placeholder:text-text-secondary'


// ---------------------------------------------------------------------------
// Table helpers — keep Admin tables consistent (Users / Audit / etc.).
// ---------------------------------------------------------------------------

export const tableHeadRowClass =
    'border-b border-[var(--paper-line)] bg-[var(--chip)] text-left text-xs text-text-secondary'

export const tableBodyClass = 'divide-y divide-border-subtle'

export const tableEmptyCellClass = 'px-5 py-10 text-center text-text-secondary'

// ---------------------------------------------------------------------------
// formatDate — shared by Overview / Audit / Users sections.
// Renders ISO timestamps as compact MM/DD am/pm HH:mm in zh-TW locale.
// Returns '-' when value is falsy.
// ---------------------------------------------------------------------------

export function formatDate(value?: string): string {
    if (!value) return '-'
    return parseServerDate(value).toLocaleString('zh-TW', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    })
}
