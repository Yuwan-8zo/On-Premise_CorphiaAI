/**
 * 系統資源面板
 * 顯示 CPU / RAM 即時百分比進度條
 */

import { useTranslation } from 'react-i18next'

import { Panel, SectionHeader } from '@/features/admin/components/AdminPrimitives'
import { usePolling } from '@/features/admin/hooks/usePolling'
import { systemApi } from '@/api/system'

/**
 * 對應 backend `_get_cpu_info()` 的回傳結構（`/system/health/detailed` 中的 `cpu` 區塊）
 * 後端目前把 CPU 跟 RAM 資訊都裝在同一個 `cpu` 物件裡，名稱用底線格式
 */
interface CpuAndMemoryInfo {
    cpu_percent: number
    cpu_cores: number
    memory_total_gb: number
    memory_used_gb: number
    memory_percent: number
}

interface DetailedHealthData {
    cpu: CpuAndMemoryInfo
}

export interface SystemResourcePanelProps {
    className?: string
}

function getResourceColor(percent: number): string {
    if (percent < 50) return 'bg-green-500'
    if (percent < 80) return 'bg-yellow-500'
    return 'bg-red-500'
}

export default function SystemResourcePanel({ className }: SystemResourcePanelProps) {
    const { t } = useTranslation()

    const { data } = usePolling(
        async () => {
            const result = await systemApi.getHealthDetailed()
            return result as DetailedHealthData
        },
        5000,
        true,
    )

    const info = data?.cpu

    const cpuPercent = info?.cpu_percent ?? 0
    const memoryPercent = info?.memory_percent ?? 0
    const totalMemoryGb = info?.memory_total_gb ?? 0
    const coreCount = info?.cpu_cores ?? 0

    return (
        <Panel className={`overflow-hidden flex flex-col min-h-[160px] lg:min-h-0 ${className || ''}`}>
            <SectionHeader
                title={t('admin.overview.systemResources', '系統資源')}
                eyebrow="System Resources"
            />
            <div className="flex-1 min-h-0 p-2.5">
                <div className="flex flex-col gap-3 h-full justify-between">
                    {/* CPU 進度條 */}
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                            <p className="text-[9px] font-medium uppercase tracking-[0.1em] text-text-muted">
                                {t('admin.overview.cpuUsage', 'CPU')}
                            </p>
                            <p className="text-xs font-semibold tabular-nums text-text-primary">
                                {cpuPercent.toFixed(1)}%
                            </p>
                        </div>
                        <div className="h-2 rounded-full bg-bg-secondary/70 overflow-hidden">
                            <div
                                className={`h-full transition-all duration-300 ${getResourceColor(cpuPercent)}`}
                                style={{ width: `${cpuPercent}%` }}
                            />
                        </div>
                        <p className="text-[7px] text-text-muted">
                            {coreCount} {coreCount === 1 ? 'core' : 'cores'}
                        </p>
                    </div>

                    {/* RAM 進度條 */}
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                            <p className="text-[9px] font-medium uppercase tracking-[0.1em] text-text-muted">
                                {t('admin.overview.ramUsage', '記憶體')}
                            </p>
                            <p className="text-xs font-semibold tabular-nums text-text-primary">
                                {memoryPercent.toFixed(1)}%
                            </p>
                        </div>
                        <div className="h-2 rounded-full bg-bg-secondary/70 overflow-hidden">
                            <div
                                className={`h-full transition-all duration-300 ${getResourceColor(memoryPercent)}`}
                                style={{ width: `${memoryPercent}%` }}
                            />
                        </div>
                        <p className="text-[7px] text-text-muted">
                            {totalMemoryGb.toFixed(1)} GB total
                        </p>
                    </div>
                </div>
            </div>
        </Panel>
    )
}
