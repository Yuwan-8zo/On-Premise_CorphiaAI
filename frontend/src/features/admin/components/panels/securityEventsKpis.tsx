import { AlertTriangle, FileText, Lock, ShieldCheck } from '@/components/snow/icons'

export interface SecurityKpiDefinition {
    labelKey: string
    labelFallback: string
    valueKey: 'pii_detected' | 'prompt_injection_blocked' | 'dlp_hit' | 'login_failed'
    icon: typeof ShieldCheck
}

// 四格同一個樣子（以前紅、橘、黃、藍各一種，沒有一格是重點）：有事件的那格數字才用紅色
export const SECURITY_KPI_DEFINITIONS: SecurityKpiDefinition[] = [
    {
        labelKey: 'admin.overview.piiDetected',
        labelFallback: '個資命中',
        valueKey: 'pii_detected',
        icon: ShieldCheck,
    },
    {
        labelKey: 'admin.overview.injectionBlocked',
        labelFallback: '注入攔截',
        valueKey: 'prompt_injection_blocked',
        icon: AlertTriangle,
    },
    {
        labelKey: 'admin.overview.dlpHit',
        labelFallback: '機密資料命中',
        valueKey: 'dlp_hit',
        icon: FileText,
    },
    {
        labelKey: 'admin.overview.loginFailed',
        labelFallback: '登入失敗',
        valueKey: 'login_failed',
        icon: Lock,
    },
]
