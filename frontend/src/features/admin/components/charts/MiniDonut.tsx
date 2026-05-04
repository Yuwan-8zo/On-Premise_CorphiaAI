/**
 * MiniDonut — 通用小型甜甜圈圖表
 * --------------------------------
 * 給 admin overview 的多個分布圖共用：
 *   - User Role Distribution (admin / engineer / user)
 *   - Document Type Distribution (PDF / DOCX / XLSX / PPTX / MD)
 *   - 任何 (label, count) 的 categorical 分布
 *
 * 跟 EventDonut 差別：尺寸更小、可放入 1/3 col 的格子，
 * 內建 legend on the right (而非外部需另外渲染)。
 */

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

import { makeAccentShades, useAccentColor } from '../../hooks/useAccentColor'

export interface MiniDonutDatum {
    /** Display label */
    name: string
    /** Number of items */
    count: number
    /** Optional original key for stable React key + sorting */
    key?: string
}

interface MiniDonutProps {
    data: MiniDonutDatum[]
    /** 中央顯示文字（總數或自訂） */
    centerLabel?: string
    /** 中央上方小字 */
    centerEyebrow?: string
    /** 空狀態文字 */
    emptyText?: string
}

interface DonutTooltipPayload {
    payload?: MiniDonutDatum
}

interface DonutTooltipProps {
    active?: boolean
    payload?: ReadonlyArray<DonutTooltipPayload>
    total: number
}

function CustomTooltip({ active, payload, total }: DonutTooltipProps) {
    if (!active || !payload?.length) return null
    const item = payload[0]?.payload
    if (!item) return null
    const pct = total > 0 ? ((item.count / total) * 100).toFixed(1) : '0'
    return (
        <div className="rounded-cv-md border border-border-subtle bg-bg-elevated px-3 py-2 text-xs shadow-md">
            <p className="font-medium text-text-primary">{item.name}</p>
            <p className="mt-0.5 font-mono text-text-secondary tabular-nums">
                {item.count.toLocaleString()} · {pct}%
            </p>
        </div>
    )
}

export default function MiniDonut({
    data,
    centerLabel,
    centerEyebrow,
    emptyText = '尚無資料',
}: MiniDonutProps) {
    const accent = useAccentColor()
    const total = data.reduce((sum, d) => sum + d.count, 0)
    const colors = makeAccentShades(accent, data.length, { from: 0.95, to: 0.35 })

    if (total === 0) {
        return (
            <div className="flex h-full min-h-[120px] items-center justify-center text-xs text-text-secondary">
                {emptyText}
            </div>
        )
    }

    return (
        <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_minmax(0,90px)] gap-2 items-center">
            {/* 甜甜圈 + 中央 label */}
            <div className="relative h-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            dataKey="count"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius="60%"
                            outerRadius="92%"
                            startAngle={90}
                            endAngle={-270}
                            paddingAngle={1.5}
                            stroke="rgb(var(--bg-base))"
                            strokeWidth={1.5}
                        >
                            {data.map((_, i) => (
                                <Cell key={i} fill={colors[i]} />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip total={total} />} />
                    </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-[20px] font-light leading-none text-text-primary tabular-nums">
                        {centerLabel ?? total.toLocaleString()}
                    </p>
                    {centerEyebrow && (
                        <p className="mt-1 text-[9px] uppercase tracking-[0.18em] text-text-muted">
                            {centerEyebrow}
                        </p>
                    )}
                </div>
            </div>

            {/* Legend（右側） */}
            <ul className="space-y-1 text-[10px] overflow-y-auto custom-scrollbar max-h-full">
                {data.map((item, i) => {
                    const pct = total > 0 ? Math.round((item.count / total) * 100) : 0
                    return (
                        <li
                            key={item.key ?? item.name}
                            className="flex items-center gap-1.5"
                        >
                            <span
                                className="h-1.5 w-1.5 shrink-0 rounded-full"
                                style={{ background: colors[i] }}
                            />
                            <span className="flex-1 truncate text-text-secondary">
                                {item.name}
                            </span>
                            <span className="font-mono text-text-primary tabular-nums">
                                {pct}%
                            </span>
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}
