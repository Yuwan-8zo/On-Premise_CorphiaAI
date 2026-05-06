/**
 * Admin > System tab（重寫版本）
 * ----------------------------------
 * 新排版：
 *   Row 1 · KPI（Uptime / DB Pool / 當前模型 / Platform）
 *   Row 2 · 即時資源使用（CPU / RAM / GPU bar）
 *   Row 3 · 磁碟和維護操作
 *   Bottom · Stack 小卡
 */

import {
    Activity,
    CircleAlert,
    Cpu,
    Database,
    HardDrive,
    Layers3,
    RefreshCw,
    ShieldCheck,
    SlidersHorizontal,
    Clock,
    Server,
    MonitorPlay,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import SystemMonitorPanel from '@/components/system/SystemMonitorPanel'
import {
    Panel,
    SectionHeader,
    ActionButton,
} from '@/features/admin/components/AdminPrimitives'
import { systemApi, type RuntimeInfo } from '@/api/system'
import { usePolling } from '@/features/admin/hooks/usePolling'

export interface SystemSectionProps {
    currentModelName?: string
}

/**
 * 格式化秒數為人類可讀的時間（3 天 4 小時）
 */
function formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)

    const parts = []
    if (days > 0) parts.push(`${days}d`)
    if (hours > 0) parts.push(`${hours}h`)
    if (minutes > 0) parts.push(`${minutes}m`)
    if (parts.length === 0) parts.push('<1m')

    return parts.slice(0, 2).join(' ')
}

export default function SystemSection({ currentModelName }: SystemSectionProps) {
    const { t } = useTranslation()
    const [runtimeInfo, setRuntimeInfo] = useState<RuntimeInfo['data'] | null>(null)

    // 每 30s 輪詢一次 runtime 資訊
    const { data: runtime } = usePolling(systemApi.getRuntimeInfo, 30000)

    useEffect(() => {
        if (runtime) {
            setRuntimeInfo(runtime)
        }
    }, [runtime])

    const uptimeFormatted = runtimeInfo ? formatUptime(runtimeInfo.uptime_seconds) : '--'
    const poolUsage = runtimeInfo
        ? `${runtimeInfo.db_pool.checked_out}/${runtimeInfo.db_pool.size}+${runtimeInfo.db_pool.overflow}`
        : '--'

    return (
        <div className="grid h-full min-h-0 grid-rows-[auto_auto_auto_minmax(0,1fr)] gap-2">
            {/* ─────────────────────────────────────────────────────────────
              Row 1 · KPI 卡片（4 個主要指標）
              ───────────────────────────────────────────────────────────── */}
            <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {/* Uptime */}
                <Panel className="relative overflow-hidden p-2.5 hover:border-accent/40">
                    <div
                        aria-hidden
                        className="pointer-events-none absolute -right-5 -top-5 h-14 w-14 rounded-full bg-accent/10 blur-2xl"
                    />
                    <div className="relative flex items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-cv-sm bg-accent/10 text-accent">
                            <Clock className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-[9px] font-medium uppercase tracking-[0.14em] text-text-muted">
                                {t('admin.system.uptime', 'Uptime')}
                            </p>
                            <p className="truncate text-[15px] font-semibold text-text-primary">{uptimeFormatted}</p>
                        </div>
                    </div>
                </Panel>

                {/* DB Pool */}
                <Panel className="relative overflow-hidden p-2.5 hover:border-accent/40">
                    <div
                        aria-hidden
                        className="pointer-events-none absolute -right-5 -top-5 h-14 w-14 rounded-full bg-accent/10 blur-2xl"
                    />
                    <div className="relative flex items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-cv-sm bg-accent/10 text-accent">
                            <Database className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-[9px] font-medium uppercase tracking-[0.14em] text-text-muted">
                                {t('admin.system.dbPool', 'DB Pool')}
                            </p>
                            <p className="truncate text-[13px] font-mono font-semibold text-text-primary">{poolUsage}</p>
                        </div>
                    </div>
                </Panel>

                {/* Current Model */}
                <Panel className="relative overflow-hidden p-2.5 hover:border-accent/40">
                    <div
                        aria-hidden
                        className="pointer-events-none absolute -right-5 -top-5 h-14 w-14 rounded-full bg-accent/10 blur-2xl"
                    />
                    <div className="relative flex items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-cv-sm bg-accent/10 text-accent">
                            <Cpu className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-[9px] font-medium uppercase tracking-[0.14em] text-text-muted">
                                {t('admin.system.model', 'Model')}
                            </p>
                            <p className="truncate text-[13px] font-semibold text-text-primary">
                                {currentModelName?.slice(0, 10) || t('admin.standby', 'Standby')}
                            </p>
                        </div>
                    </div>
                </Panel>

                {/* Platform */}
                <Panel className="relative overflow-hidden p-2.5 hover:border-accent/40">
                    <div
                        aria-hidden
                        className="pointer-events-none absolute -right-5 -top-5 h-14 w-14 rounded-full bg-accent/10 blur-2xl"
                    />
                    <div className="relative flex items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-cv-sm bg-accent/10 text-accent">
                            <Server className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-[9px] font-medium uppercase tracking-[0.14em] text-text-muted">
                                {t('admin.system.platform', 'Platform')}
                            </p>
                            <p className="truncate text-[13px] font-semibold text-text-primary">Python 3.12</p>
                        </div>
                    </div>
                </Panel>
            </section>

            {/* ─────────────────────────────────────────────────────────────
              Row 2 · 即時系統監控（CPU / RAM / GPU）
              ───────────────────────────────────────────────────────────── */}
            <Panel className="overflow-hidden flex flex-col min-h-[180px]">
                <SectionHeader
                    title={t('admin.system.realTimeHealth', '即時資源')}
                    eyebrow={t('admin.system.resourceMonitoring', '資源監控')}
                />
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3">
                    <SystemMonitorPanel />
                </div>
            </Panel>

            {/* ─────────────────────────────────────────────────────────────
              Row 3 · 維護操作
              ───────────────────────────────────────────────────────────── */}
            <Panel className="overflow-hidden">
                <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                    <div className="flex flex-col">
                        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted">
                            {t('admin.system.maintenance', '維護')}
                        </p>
                    </div>
                    <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
                        <ActionButton variant="secondary">
                            <RefreshCw className="h-4 w-4" />
                            {t('admin.system.clearCache', '清快取')}
                        </ActionButton>
                        <ActionButton variant="secondary">
                            <SlidersHorizontal className="h-4 w-4" />
                            {t('admin.system.reindexVector', '重建索引')}
                        </ActionButton>
                        <ActionButton variant="danger">
                            <CircleAlert className="h-4 w-4" />
                            {t('admin.system.restartService', '重啟')}
                        </ActionButton>
                    </div>
                </div>
            </Panel>
        </div>
    )
}
