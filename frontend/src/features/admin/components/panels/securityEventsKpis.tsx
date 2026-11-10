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

export interface SecurityKpiDefinitionExtended extends SecurityKpiDefinition {
    valueColor: string
    borderAccent: string
}

export const SECURITY_KPI_DEFINITIONS: (SecurityKpiDefinition & { valueColor: string; borderAccent: string })[] = [
    {
        labelKey: 'admin.overview.piiDetected',
        labelFallback: '個資命中',
        valueKey: 'pii_detected',
        icon: ShieldCheckIcon,
        colorClass: 'text-red-500 dark:text-red-400 bg-red-500/15',
        valueColor: 'text-red-500 dark:text-red-400',
        borderAccent: 'border-red-500/40',
    },
    {
        labelKey: 'admin.overview.injectionBlocked',
        labelFallback: '注入攔截',
        valueKey: 'prompt_injection_blocked',
        icon: TriangleAlertIcon,
        colorClass: 'text-orange-500 dark:text-orange-300 bg-orange-500/15',
        valueColor: 'text-orange-500 dark:text-orange-300',
        borderAccent: 'border-orange-500/40',
    },
    {
        labelKey: 'admin.overview.dlpHit',
        labelFallback: 'DLP 命中',
        valueKey: 'dlp_hit',
        icon: FileDescriptionIcon,
        colorClass: 'text-amber-500 dark:text-amber-300 bg-amber-500/15',
        valueColor: 'text-amber-500 dark:text-amber-300',
        borderAccent: 'border-amber-500/40',
    },
    {
        labelKey: 'admin.overview.loginFailed',
        labelFallback: '登入失敗',
        valueKey: 'login_failed',
        icon: LockIcon,
        colorClass: 'text-blue-500 dark:text-blue-300 bg-blue-500/15',
        valueColor: 'text-blue-500 dark:text-blue-300',
        borderAccent: 'border-blue-500/40',
    },
]
