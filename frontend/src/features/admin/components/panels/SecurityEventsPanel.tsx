/**
 * 資安事件面板（過去 24 小時）
 */

import { useTranslation } from 'react-i18next'

import type { SecuritySummary } from '@/api/admin'
import { ItshoverIcon } from '@/components/icons/itshover'
import { Panel, SectionHeader } from '@/features/admin/components/AdminPrimitives'
import { usePolling } from '@/features/admin/hooks/usePolling'
import { adminApi } from '@/api/admin'

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
        <Panel className={`overflow-hidden flex flex-col min-h-[160px] lg:min-h-0 ${className || ''}`}>
            <SectionHeader
                title={t('admin.overview.securityEvents', '資安事件 (24h)')}
            />
            <div className="flex-1 min-h-0 p-2.5">
                <div className="grid grid-cols-2 gap-2 h-full">
                    {SECURITY_KPI_DEFINITIONS.map((kpi) => {
                        const value = data?.[kpi.valueKey] ?? 0
                        return (
                            <div
                                key={kpi.valueKey}
                                className={`flex items-center gap-3 p-3 rounded-[16px] bg-[var(--chip)] border transition-colors  ${value > 0 ? kpi.borderAccent : 'border-[var(--paper-line)]'}`}
                            >
                                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] ${kpi.colorClass}`}>
                                    <ItshoverIcon icon={kpi.icon} size={16} />
                                </span>

                                <p className="flex-1 min-w-0 text-[12px] font-medium text-text-secondary truncate">
                                    {t(kpi.labelKey, kpi.labelFallback)}
                                </p>

                                <p className={`shrink-0 text-3xl font-semibold tabular-nums leading-none ${value > 0 ? kpi.valueColor : 'text-text-muted'}`}>
                                    {value}
                                </p>
                            </div>
                        )
                    })}
                </div>
            </div>
        </Panel>
    )
}
