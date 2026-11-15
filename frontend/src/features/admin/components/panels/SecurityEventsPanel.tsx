/**
 * 資安事件面板（過去 24 小時）
 */

import { useTranslation } from 'react-i18next'

import type { SecuritySummary } from '@/api/admin'
import { ItshoverIcon } from '@/components/icons/itshover'
import { Panel, SectionHeader } from '@/features/admin/components/AdminPrimitives'
import { usePolling } from '@/features/admin/hooks/usePolling'
import { adminApi } from '@/api/admin'
import { SkelText } from '@/components/ui/Skeleton'

import { SECURITY_KPI_DEFINITIONS } from './securityEventsKpis'

export interface SecurityEventsPanelProps {
    className?: string
    /** 由 Overview 聚合輪詢傳入時，不再自行打 API */
    securitySummary?: SecuritySummary | null
}

export default function SecurityEventsPanel({
    className,
    securitySummary: securityFromParent,
}: SecurityEventsPanelProps) {
    const { t } = useTranslation()

    const { data: polled } = usePolling(
        () => adminApi.getSecuritySummary(),
        5000,
        securityFromParent === undefined,
    )

    const data = securityFromParent !== undefined ? securityFromParent : polled

    return (
        <Panel className={`flex flex-col min-h-[var(--sz-160)] ${className || ''}`}>
            <SectionHeader
                title={t('admin.overview.securityEvents', '資安事件 (24h)')}
            />
            <div className="flex-1 px-[var(--space)] pb-[var(--space)]">
                <div className="grid grid-cols-2 gap-[var(--space)] h-full">
                    {SECURITY_KPI_DEFINITIONS.map((kpi) => {
                        const value = data?.[kpi.valueKey] ?? 0
                        return (
                            <div
                                key={kpi.valueKey}
                                className={`flex flex-wrap items-center gap-x-3 gap-y-[var(--sp-6)] px-[var(--sp-14)] py-3 rounded-[var(--admin-in)] bg-[var(--chip)] border transition-colors  ${value > 0 ? kpi.borderAccent : 'border-transparent'}`}
                            >
                                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-8)] ${kpi.colorClass}`}>
                                    <ItshoverIcon icon={kpi.icon} size={16} />
                                </span>

                                <p className="flex-1 basis-[max-content] whitespace-nowrap text-[length:var(--fs-12)] font-medium text-text-secondary">
                                    {t(kpi.labelKey, kpi.labelFallback)}
                                </p>

                                <p className={`ml-auto shrink-0 text-3xl font-semibold tabular-nums leading-none ${value > 0 ? kpi.valueColor : 'text-text-muted'}`}>
                                    {/* 還沒讀到之前用佔位，不先顯示 0 再跳成真的數字 */}
                                    {data ? value : <SkelText>0</SkelText>}
                                </p>
                            </div>
                        )
                    })}
                </div>
            </div>
        </Panel>
    )
}
