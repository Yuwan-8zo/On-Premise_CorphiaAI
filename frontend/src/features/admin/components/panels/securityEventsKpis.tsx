import {
    FileDescriptionIcon,
    LockIcon,
    ShieldCheckIcon,
    TriangleAlertIcon,
    type ItshoverIconComponent,
} from '@/components/icons/itshover'

export interface SecurityKpiDefinition {
    labelKey: string
    labelFallback: string
    valueKey: 'pii_detected' | 'prompt_injection_blocked' | 'dlp_hit' | 'login_failed'
    icon: ItshoverIconComponent
    colorClass: string
}

export const SECURITY_KPI_DEFINITIONS: (SecurityKpiDefinition & { valueColor: string; borderAccent: string })[] = [
    {
        labelKey: 'admin.overview.piiDetected',
        labelFallback: '個資命中',
        valueKey: 'pii_detected',
        icon: ShieldCheckIcon,
        colorClass: 'text-[var(--ink-red)] bg-[color-mix(in_srgb,var(--sys-red)_20%,transparent)]',
        valueColor: 'text-[var(--ink-red)]',
        borderAccent: 'border-[color-mix(in_srgb,var(--sys-red)_55%,transparent)]',
    },
    {
        labelKey: 'admin.overview.injectionBlocked',
        labelFallback: '注入攔截',
        valueKey: 'prompt_injection_blocked',
        icon: TriangleAlertIcon,
        colorClass: 'text-[var(--ink-orange)] bg-[color-mix(in_srgb,var(--sys-orange)_20%,transparent)]',
        valueColor: 'text-[var(--ink-orange)]',
        borderAccent: 'border-[color-mix(in_srgb,var(--sys-orange)_55%,transparent)]',
    },
    {
        labelKey: 'admin.overview.dlpHit',
        labelFallback: 'DLP 命中',
        valueKey: 'dlp_hit',
        icon: FileDescriptionIcon,
        colorClass: 'text-[var(--ink-yellow)] bg-[color-mix(in_srgb,var(--sys-yellow)_20%,transparent)]',
        valueColor: 'text-[var(--ink-yellow)]',
        borderAccent: 'border-[color-mix(in_srgb,var(--sys-yellow)_55%,transparent)]',
    },
    {
        labelKey: 'admin.overview.loginFailed',
        labelFallback: '登入失敗',
        valueKey: 'login_failed',
        icon: LockIcon,
        colorClass: 'text-[var(--ink-blue)] bg-[color-mix(in_srgb,var(--sys-blue)_20%,transparent)]',
        valueColor: 'text-[var(--ink-blue)]',
        borderAccent: 'border-[color-mix(in_srgb,var(--sys-blue)_55%,transparent)]',
    },
]
