export type BackendStatus = 'online' | 'offline' | 'checking'

interface BackendStatusPillProps {
    status: BackendStatus
    compact?: boolean
}

export default function BackendStatusPill({ status, compact = false }: BackendStatusPillProps) {
    const dotClass = status === 'online' ? 'bg-[#30D158] text-[#30D158]' : status === 'offline' ? 'bg-[#FF453A] text-[#FF453A]' : 'bg-accent text-accent'
    const textClass = status === 'online' ? 'text-text-secondary' : status === 'offline' ? 'text-[#FF453A]' : 'text-accent'
    const label = status === 'online' ? 'Online' : status === 'offline' ? 'Offline' : 'Checking...'

    return (
        <div className={`flex items-center gap-2 rounded-full glass-chip transition-colors ${compact ? 'px-3 py-1.5' : 'px-3.5 py-2 w-fit'}`}>
            <span className={`${compact ? 'w-2 h-2' : 'w-2 h-2'} rounded-full ${dotClass} shadow-[0_0_14px_currentColor]`} />
            <span className={`${compact ? 'text-[length:var(--fs-12)] leading-[var(--lh-16)] font-medium' : 'text-[length:var(--fs-13)] leading-[var(--lh-18)] font-medium'} ${textClass}`}>{label}</span>
        </div>
    )
}
