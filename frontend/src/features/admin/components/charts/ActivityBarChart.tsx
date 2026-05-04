/**
 * ActivityBarChart — 過去 N 天每日事件數柱狀圖
 *
 * 配色從 useAccentColor 抽出，跟著使用者選的品牌色變。
 * 軸線、文字、背景色全部走 CSS 變數，dark mode 自動切。
 */

import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'

import { useAccentColor } from '../../hooks/useAccentColor'
import type { DailyCount } from '../../utils/auditAggregations'

interface ActivityBarChartProps {
    data: DailyCount[]
    /** 數字（px）或 "100%"。Recharts ResponsiveContainer 會吃這兩種 */
    height?: number | string
}

/**
 * Recharts 的 Tooltip content 會傳一堆型別，裡面 payload 帶我們塞進去的 DailyCount。
 * 這邊用寬鬆型別接，再 cast `payload` 第一筆的 payload 為 DailyCount —— 比寫死自家
 * shape 但跟 recharts 內部型別不對盤 (TooltipPayload[]) 來得穩。
 */
type CustomTooltipProps = {
    active?: boolean
    payload?: ReadonlyArray<{ payload?: DailyCount }>
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
    if (!active || !payload?.length) return null
    const item = payload[0]?.payload
    if (!item) return null
    return (
        <div className="rounded-cv-md border border-border-subtle bg-bg-elevated px-3 py-2 text-xs shadow-md">
            <p className="font-mono font-medium text-text-primary tabular-nums">
                {item.date}
            </p>
            <p className="text-text-secondary">{item.weekday}</p>
            <p className="mt-1 font-mono text-sm text-accent tabular-nums">
                {item.count.toLocaleString()} 筆
            </p>
        </div>
    )
}

export default function ActivityBarChart({
    data,
    height = 220,
}: ActivityBarChartProps) {
    const accent = useAccentColor()

    return (
        <ResponsiveContainer width="100%" height={height}>
            <BarChart
                data={data}
                margin={{ top: 12, right: 8, bottom: 0, left: -16 }}
            >
                <defs>
                    <linearGradient id="activity-bar-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={accent.full} stopOpacity={0.95} />
                        <stop offset="100%" stopColor={accent.full} stopOpacity={0.5} />
                    </linearGradient>
                </defs>
                <CartesianGrid
                    stroke={accent.alpha(0.08)}
                    strokeDasharray="3 4"
                    vertical={false}
                />
                <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: 'rgb(var(--text-secondary))' }}
                />
                <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: 'rgb(var(--text-secondary))' }}
                    width={40}
                    allowDecimals={false}
                />
                <Tooltip
                    cursor={{ fill: accent.alpha(0.1) }}
                    content={<CustomTooltip />}
                />
                <Bar
                    dataKey="count"
                    fill="url(#activity-bar-fill)"
                    radius={[8, 8, 4, 4]}
                    maxBarSize={36}
                />
            </BarChart>
        </ResponsiveContainer>
    )
}
