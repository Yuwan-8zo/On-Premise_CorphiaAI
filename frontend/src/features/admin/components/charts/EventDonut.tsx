/**
 * EventDonut — audit logs 依 action 分布甜甜圈
 *
 * 每一類用一個 Apple 系統色（色相明顯不同），切片之間只留很小的間隔，不畫外框線。
 * 中央放總事件數。配色跟著使用者品牌色變。
 */

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

import { appleCategoryColors } from '../../hooks/useAccentColor'
import type { ActionCount } from '../../utils/auditAggregations'

interface EventDonutProps {
    data: ActionCount[]
    /** 數字（px）或 "100%"。中央 label 用絕對定位，外層 height 會控制整個 donut 容器 */
    height?: number | string
}

/** 寬鬆接收 recharts 傳的 props，內部 payload[0].payload 是我們塞進去的 ActionCount */
type DonutTooltipProps = {
    active?: boolean
    payload?: ReadonlyArray<{ payload?: ActionCount }>
    total: number
}

function CustomTooltip({ active, payload, total }: DonutTooltipProps) {
    if (!active || !payload?.length) return null
    const item = payload[0]?.payload
    if (!item) return null
    const pct = total > 0 ? ((item.count / total) * 100).toFixed(1) : '0'
    return (
        <div className="paper !rounded-[14px] px-3 py-2 text-xs">
            <p className="font-medium text-text-primary">{item.name}</p>
            <p className="mt-0.5 text-text-secondary tabular-nums">
                {item.count.toLocaleString()} 筆 · {pct}%
            </p>
        </div>
    )
}

export default function EventDonut({ data, height = 220 }: EventDonutProps) {
    const total = data.reduce((sum, d) => sum + d.count, 0)
    const colors = appleCategoryColors(data.length)

    if (total === 0) {
        return (
            <div
                className="flex items-center justify-center text-sm text-text-secondary"
                style={{ height }}
            >
                尚無事件可分析
            </div>
        )
    }

    return (
        <div className="relative [container-type:size]" style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        dataKey="count"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius="62%"
                        outerRadius="92%"
                        startAngle={90}
                        endAngle={-270}
                        paddingAngle={1.5}
                        stroke="none"
                    >
                        {data.map((_, i) => (
                            <Cell key={i} fill={colors[i]} />
                        ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip total={total} />} />
                </PieChart>
            </ResponsiveContainer>

            {/* Center label, absolutely positioned over the donut hole. */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-[clamp(15px,13cqmin,26px)] font-light leading-none text-text-primary tabular-nums">
                    {total.toLocaleString()}
                </p>
                <p className="mt-[clamp(2px,2cqmin,6px)] text-[clamp(8px,4.5cqmin,11px)] text-text-secondary">
                    Total
                </p>
            </div>
        </div>
    )
}

/**
 * Companion legend — list the slices with their color, name, count, and %.
 * Exported so OverviewSection can render it next to the donut.
 */
export function EventDonutLegend({ data }: { data: ActionCount[] }) {
    const total = data.reduce((sum, d) => sum + d.count, 0)
    const colors = appleCategoryColors(data.length)

    if (data.length === 0) return null

    return (
        <ul className="space-y-2">
            {data.map((item, i) => {
                const pct = total > 0 ? ((item.count / total) * 100).toFixed(0) : '0'
                return (
                    <li
                        key={item.rawAction}
                        className="flex items-center gap-2.5 text-xs"
                    >
                        <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ background: colors[i] }}
                        />
                        <span className="flex-1 truncate text-text-secondary">
                            {item.name}
                        </span>
                        <span className=" text-text-primary tabular-nums">
                            {pct}%
                        </span>
                    </li>
                )
            })}
        </ul>
    )
}
