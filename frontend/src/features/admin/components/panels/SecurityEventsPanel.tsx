/**
 * 資安事件面板（過去 24 小時）
 * 顯示 PII / Injection / DLP / Login Failed 等關鍵資安指標
 */

import { AlertTriangle, FileWarning, Lock, Shield } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Panel, SectionHeader } from '@/features/admin/components/AdminPrimitives'
import { usePolling } from '@/features/admin/hooks/usePolling'
import { adminApi } from '@/api/admin'

export interface SecurityEventsPanelProps {
    className?: string
}

export default function SecurityEventsPanel({ className }: SecurityEventsPanelProps) {
    const { t } = useTranslation()

    const { data } = usePolling(
        () => adminApi.getSecuritySummary(),
        5000,
        true,
    )

    const kpis = [
        {
            label: t('admin.overview.piiDetected', '個資命中'),
            value: data?.pii_detected ?? 0,
            icon: Shield,
            colorClass: 'text-red-500 bg-red-500/10',
        },
        {
            label: t('admin.overview.injectionBlocked', '注入攔截'),
            value: data?.prompt_injection_blocked ?? 0,
            icon: AlertTriangle,
            colorClass: 'text-orange-500 bg-orange-500/10',
        },
        {
            label: t('admin.overview.dlpHit', 'DLP 命中'),
            value: data?.dlp_hit ?? 0,
            icon: FileWarning,
            colorClass: 'text-yellow-500 bg-yellow-500/10',
        },
        {
            label: t('admin.overview.loginFailed', '登入失敗'),
            value: data?.login_failed ?? 0,
            icon: Lock,
            colorClass: 'text-gray-500 bg-gray-500/10',
        },
    ]

    return (
        <Panel className={`overflow-hidden flex flex-col min-h-[160px] lg:min-h-0 ${className || ''}`}>
            <SectionHeader
                title={t('admin.overview.securityEvents', '資安事件 (24h)')}
                eyebrow="Security Events"
            />
            <div className="flex-1 min-h-0 p-2.5">
                <div className="grid grid-cols-2 gap-2 h-full">
                    {kpis.map((kpi) => {
                        const Icon = kpi.icon
                        // 排版：左側 icon + 文字標籤；右側放大數字（tabular-nums 對齊）
                        // value > 0 時數字用 accent 色 + 粗體強調，0 用 muted 弱化
                        return (
                            <div
                                key={kpi.label}
                                className="flex items-center gap-3 p-3 rounded-cv-sm bg-bg-secondary/50 border border-border/30 hover:border-border/60 transition-colors"
                            >
                                {/* 左：icon */}
                                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${kpi.colorClass}`}>
                                    <Icon className="h-4 w-4" />
                                </span>

                                {/* 中：標籤（吃掉剩餘空間，太長就 truncate） */}
                                <p className="flex-1 min-w-0 text-[11px] font-medium uppercase tracking-[0.1em] text-text-muted truncate">
                                    {kpi.label}
                                </p>

                                {/* 右：放大的數字 */}
                                <p className={`shrink-0 text-3xl font-semibold tabular-nums leading-none ${kpi.value > 0 ? 'text-accent' : 'text-text-muted'}`}>
                                    {kpi.value}
                                </p>
                            </div>
                        )
                    })}
                </div>
            </div>
        </Panel>
    )
}
