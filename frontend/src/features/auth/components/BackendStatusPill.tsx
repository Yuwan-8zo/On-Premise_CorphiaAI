export type BackendStatus = 'online' | 'offline' | 'checking'

interface BackendStatusPillProps {
    status: BackendStatus
    compact?: boolean
}

export default function BackendStatusPill({ status, compact = false }: BackendStatusPillProps) {
    const dotClass = status === 'online' ? 'bg-green-500' : status === 'offline' ? 'bg-red-500' : 'bg-yellow-500'
    const textClass = status === 'online' ? 'text-green-600' : status === 'offline' ? 'text-red-600' : 'text-yellow-600'
    const label = status === 'online' ? 'Online' : status === 'offline' ? 'Offline' : 'Checking...'

    return (
        <div className={`flex items-center gap-2 bg-bg-base border border-border-subtle rounded-full shadow-sm dark:shadow-none transition-colors ${compact ? 'px-3 py-1.5' : 'px-3 py-1.5 w-fit'}`}>
            <span className={`${compact ? 'w-2 h-2' : 'w-2.5 h-2.5'} rounded-full ${dotClass}`} />
            <span className={`${compact ? 'text-xs font-medium' : 'text-sm'} text-text-secondary`}>Backend:</span>
            <span className={`${compact ? 'text-xs font-semibold' : 'text-sm'} ${textClass}`}>{label}</span>
        </div>
    )
}
