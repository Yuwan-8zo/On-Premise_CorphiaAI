/**
 * Admin shared UI primitives
 * --------------------------
 * Extracted from AdminPage.tsx to keep the main page focused on data + layout.
 *
 * Design language (matches login + chat pages):
 *   - Flat: bg-bg-base + border-border-subtle, no glass/big-shadow/28px-radius
 *   - Single radius token: rounded-cv-lg
 *   - Whitespace via padding, not via outer glow
 */

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
        // Glass morphism v3：白色微染 + 較明顯邊框
        // FIX: 原本 dark:border-white/10 在深色頁面幾乎看不見，bumped 到 white/20
        //   - light mode: white/50 — 淺色背景上白色邊框本就明顯，半透明就夠
        //   - dark mode:  white/20 — 深色背景上需要更亮才看得到，但仍保持 glass 透視感
        <section
            className={`rounded-cv-lg border border-white/50 dark:border-white/20 bg-white/[0.04] dark:bg-white/[0.04] supports-[backdrop-filter]:bg-white/[0.04] backdrop-blur-2xl ${className}`}
        >
            {children}
        </section>
    )
}

// ---------------------------------------------------------------------------
// SectionHeader — title strip at the top of a Panel, with optional eyebrow
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
        <div className="flex flex-col gap-3 border-b border-border-subtle px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
                {eyebrow && (
                    <p className="mb-0.5 text-[11px] font-medium uppercase tracking-[0.14em] text-text-muted">
                        {eyebrow}
                    </p>
                )}
                <h2 className="truncate text-[17px] font-semibold tracking-tight text-text-primary">
                    {title}
                </h2>
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
    const variants = {
        primary: 'bg-accent text-[var(--text-on-accent,#fff)] hover:opacity-90',
        secondary: 'border border-border-subtle bg-bg-surface text-text-primary hover:bg-white/[0.06] dark:hover:bg-white/[0.06]',
        danger: 'border border-red-500/30 bg-red-500/10 text-red-500 hover:bg-red-500/20',
    }
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`inline-flex h-9 shrink-0 min-w-max items-center justify-center gap-2 rounded-full px-4 text-sm font-medium whitespace-nowrap transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]}`}
        >
            {children}
        </button>
    )
}

// ---------------------------------------------------------------------------
// StatusPill — green dot for active, grey for disabled.
// ---------------------------------------------------------------------------

export function StatusPill({ active }: { active: boolean }) {
    const { t } = useTranslation()
    return (
        <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
                active
                    ? 'border-accent/20 bg-accent/10 text-accent'
                    : 'border-border-subtle bg-bg-surface text-text-secondary'
            }`}
        >
            <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-accent' : 'bg-text-secondary'}`} />
            {active ? t('common.active') : t('common.disabled')}
        </span>
    )
}

// ---------------------------------------------------------------------------
// RoleBadge — uppercase pill for user roles.
// ---------------------------------------------------------------------------

export type AdminUserRole = 'engineer' | 'admin' | 'user'

export function RoleBadge({ role }: { role: AdminUserRole }) {
    const { t } = useTranslation()
    const styles = {
        admin: 'border-accent/20 bg-accent/10 text-accent',
        engineer: 'border-accent/20 bg-accent/10 text-accent',
        user: 'border-border-subtle bg-bg-surface text-text-secondary',
    }
    const roleLabels = {
        admin: t('admin.users.role.admin', { defaultValue: 'Admin' }),
        engineer: t('admin.users.role.engineer', { defaultValue: 'Engineer' }),
        user: t('admin.users.role.user', { defaultValue: 'User' }),
    }
    return (
        <span
            className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${styles[role]}`}
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
                className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md"
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
                    className={`relative w-full ${maxWidth} rounded-[26px] border border-white/50 bg-bg-surface/86 p-6 text-text-primary shadow-[0_22px_70px_rgb(0_0_0/0.18)] supports-[backdrop-filter]:bg-bg-surface/74 backdrop-blur-2xl pointer-events-auto dark:border-white/20`}
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
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
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
    'w-full rounded-[18px] border border-border-subtle/80 bg-bg-elevated/80 px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent focus:bg-bg-elevated focus:ring-2 focus:ring-accent/15 placeholder:text-text-secondary'

export const selectClass = `${inputClass} cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236B6B6B%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:1.2em_1.2em] bg-[right_1rem_center] bg-no-repeat pr-10`

// ---------------------------------------------------------------------------
// formatDate — shared by Overview / Audit / Users sections.
// Renders ISO timestamps as compact MM/DD am/pm HH:mm in zh-TW locale.
// Returns '-' when value is falsy.
// ---------------------------------------------------------------------------

export function formatDate(value?: string): string {
    if (!value) return '-'
    return new Date(value).toLocaleString('zh-TW', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    })
}
