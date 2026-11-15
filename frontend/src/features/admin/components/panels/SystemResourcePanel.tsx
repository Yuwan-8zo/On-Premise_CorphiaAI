/**
 * 系統資源面板
 * 顯示 CPU / RAM 即時百分比進度條
 */

import { useTranslation } from 'react-i18next'

import { Cpu, HardDrive } from '@/components/snow/icons'

import { Panel, SectionHeader } from '@/features/admin/components/AdminPrimitives'
import { useHealthDetailed } from '@/features/admin/hooks/useHealthDetailed'
import { SkelText } from '@/components/ui/Skeleton'

export interface SystemResourcePanelProps {
    className?: string
}

function getResourceColor(percent: number): string {
    if (percent < 50) return 'bg-[var(--sys-green)]'
    if (percent < 80) return 'bg-[var(--sys-yellow)]'
    return 'bg-[var(--sys-red)]'
}

export default function SystemResourcePanel({ className }: SystemResourcePanelProps) {
    const { t } = useTranslation()

    const data = useHealthDetailed()

    const info = data?.cpu

    const cpuPercent = info?.cpu_percent ?? 0
    const memoryPercent = info?.memory_percent ?? 0
    const totalMemoryGb = info?.memory_total_gb ?? 0
    const coreCount = info?.cpu_cores ?? 0

    // CPU、記憶體各一個內層方塊，平均撐滿卡片（和資安事件、LLM 即時狀態同樣做法：內距＝間距、圓角＝卡片圓角 − 間距）
    const items = [
        {
            key: 'cpu',
            icon: <Cpu className="h-3 w-3 text-[var(--ink-blue)]" />,
            label: t('admin.overview.cpuUsage', 'CPU'),
            percent: cpuPercent,
            note: t('ui.misc.cores', { n: coreCount }),
            // 載入中的佔位：和真資料同格式、同長度，資料進來時這一行不會變寬或換行
            placeholder: t('ui.misc.cores', { n: 8 }),
        },
        {
            key: 'ram',
            icon: <HardDrive className="h-3 w-3 text-[var(--ink-teal)]" />,
            label: t('admin.overview.ramUsage', '記憶體'),
            percent: memoryPercent,
            note: t('ui.misc.memTotal', { gb: totalMemoryGb.toFixed(1) }),
            placeholder: t('ui.misc.memTotal', { gb: '00.0' }),
        },
    ]

    return (
        <Panel className={`flex flex-col min-h-[var(--sz-160)] ${className || ''}`}>
            <SectionHeader
                title={t('admin.overview.systemResources', '系統資源')}
            />
            <div className="flex-1 flex flex-col gap-[var(--space)] px-[var(--space)] pb-[var(--space)]">
                {items.map((item) => (
                    <div
                        key={item.key}
                        className="flex flex-1 flex-col justify-center gap-[var(--sp-6)] px-[var(--sp-16)] py-[var(--sp-10)] rounded-[var(--admin-in)] bg-[var(--chip)]"
                    >
                        {/* 一行到底（不換行）：這一行的高度固定，資料長短不會讓卡片長高、整頁縮放跳動；太窄時備註截斷 */}
                        <div className="flex items-center justify-between gap-x-2 min-w-0">
                            <div className="flex shrink-0 items-center gap-1.5">
                                {item.icon}
                                <p className="whitespace-nowrap text-[length:var(--fs-12)] font-medium text-text-secondary">{item.label}</p>
                            </div>
                            <p className="min-w-0 truncate text-[length:var(--fs-11)] text-text-muted">{info ? item.note : <SkelText>{item.placeholder}</SkelText>}</p>
                        </div>
                        <p className="text-[length:var(--fs-28)] leading-[var(--lh-30)] font-semibold tabular-nums whitespace-nowrap text-text-primary">
                            {/* 載入中用同格式的佔位（數字＋小一號的 %），高度和真資料一樣 */}
                            {info ? <>{item.percent.toFixed(1)}<span className="ml-0.5 text-[length:var(--fs-15)] font-medium text-text-secondary">%</span></> : <SkelText>00.0<span className="ml-0.5 text-[length:var(--fs-15)] font-medium">%</span></SkelText>}
                        </p>
                        <div className="h-1.5 rounded-full bg-[rgb(var(--text-primary)/0.12)] overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-[width,background-color] duration-300 ${getResourceColor(item.percent)}`}
                                style={{ width: `${item.percent}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </Panel>
    )
}
