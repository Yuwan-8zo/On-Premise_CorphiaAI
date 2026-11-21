/**
 * AI 回答裡的表格自動畫成長條圖（不用另外要求；判斷規則見 lib/tableData 的 chartPlan）
 *   每一組數字一個顏色：強調色、綠、橘（Apple 系統色）；圖例只在兩組以上時顯示
 *   Recharts 不認 CSS 變數，顏色在這裡從樣式讀成實際的值；換主題、換強調色會跟著變
 *   這個檔案另外載入（lazy），沒有表格的對話不用下載圖表程式
 */
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useAccentColor } from '@/features/admin/hooks/useAccentColor'
import { useCssPx } from '@/lib/cssVars'
import type { ChartPlan } from '@/lib/tableData'

interface Props {
    plan: ChartPlan
    head: string[]
}

const cssColor = (name: string) =>
    (typeof window === 'undefined' ? '' : getComputedStyle(document.documentElement).getPropertyValue(name).trim())

const CHART_VARS = ['--md-chart-h', '--md-chart-bar'] as const

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 })

export default function TableChart({ plan, head }: Readonly<Props>) {
    const accent = useAccentColor()
    const colors = [accent.full, cssColor('--sys-green'), cssColor('--sys-orange')]
    const ink = 'rgb(var(--text-secondary))'
    const px = useCssPx(CHART_VARS)
    const height = px['--md-chart-h']
    const bar = px['--md-chart-bar']
    const many = plan.valueCols.length > 1

    return (
        <figure className="md-chart paper" aria-label={plan.valueCols.map((c) => head[c]).join('、')}>
            <ResponsiveContainer width="100%" height={height}>
                <BarChart data={plan.data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                    <CartesianGrid stroke={accent.alpha(0.08)} strokeDasharray="3 4" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 11, fill: ink }} />
                    <YAxis tickLine={false} axisLine={false} width={44} tick={{ fontSize: 11, fill: ink }} tickFormatter={fmt} />
                    <Tooltip
                        cursor={{ fill: accent.alpha(0.1) }}
                        formatter={(v: number, key: string) => [fmt(v), head[Number(key.slice(1))]]}
                        contentStyle={{ background: 'var(--paper-solid)', border: '0.5px solid var(--paper-line)', borderRadius: 14, fontSize: 12 }}
                        labelStyle={{ color: 'rgb(var(--text-primary))', fontWeight: 600 }}
                    />
                    {many && <Legend formatter={(key: string) => head[Number(key.slice(1))]} wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />}
                    {plan.valueCols.map((c, i) => (
                        <Bar key={c} dataKey={`v${c}`} fill={colors[i]} radius={[8, 8, 4, 4]} maxBarSize={bar} isAnimationActive />
                    ))}
                </BarChart>
            </ResponsiveContainer>
        </figure>
    )
}
