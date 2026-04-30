export type BackendStatus = 'online' | 'offline' | 'checking'

interface BackendStatusPillProps {
    status: BackendStatus
    compact?: boolean
}

export default function BackendStatusPill({ status, compact = false }: BackendStatusPillProps) {
    const dotClass = status === 'online' ? 'bg-[#30D158] text-[#30D158]' : status === 'offline' ? 'bg-[#FF453A] text-[#FF453A]' : 'bg-corphia-bronze text-corphia-bronze'
    const textClass = status === 'online' ? 'text-text-secondary' : status === 'offline' ? 'text-[#FF453A]' : 'text-corphia-bronze'
    const label = status === 'online' ? 'Online' : status === 'offline' ? 'Offline' : 'Checking...'

    return (
        <div className={`flex items-center gap-2 rounded-full border border-white/10 bg-bg-base/42 shadow-[0_10px_30px_rgba(0,0,0,0.16)] backdrop-blur-xl transition-colors ${compact ? 'px-3 py-1.5' : 'px-3.5 py-2 w-fit'}`}>
            <span className={`${compact ? 'w-2 h-2' : 'w-2 h-2'} rounded-full ${dotClass} shadow-[0_0_14px_currentColor]`} />
            <span className={`${compact ? 'text-xs font-medium' : 'text-[12px] font-medium'} ${textClass}`}>{label}</span>
        </div>
    )
}
