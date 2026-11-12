import { useTranslation } from 'react-i18next'

export type BackendStatus = 'online' | 'offline' | 'checking'

interface BackendStatusPillProps {
    status: BackendStatus
    compact?: boolean
}

export default function BackendStatusPill({ status, compact = false }: BackendStatusPillProps) {
    const { t } = useTranslation()
    const dotClass = status === 'online' ? 'bg-[var(--sys-green)] text-[var(--sys-green)]' : status === 'offline' ? 'bg-[var(--sys-red)] text-[var(--sys-red)]' : 'bg-accent text-accent'
    const textClass = status === 'online' ? 'text-text-secondary' : status === 'offline' ? 'text-[var(--sys-red)]' : 'text-accent'
    const label = t(status === 'online' ? 'auth.statusOnline' : status === 'offline' ? 'auth.statusOffline' : 'auth.statusChecking')

    return (
        <div className={`flex items-center gap-2 rounded-full glass-chip transition-colors ${compact ? 'px-3 py-1.5' : 'px-3.5 py-2 w-fit'}`}>
            <span className={`w-2 h-2 rounded-full ${dotClass} shadow-[0_0_14px_currentColor]`} />
            <span className={`${compact ? 'text-[length:var(--fs-12)] leading-[var(--lh-16)] font-medium' : 'text-[length:var(--fs-13)] leading-[var(--lh-18)] font-medium'} ${textClass}`}>{label}</span>
        </div>
    )
}
