/**
 * AI 回答裡的表格自動畫成長條圖（不用另外要求；判斷規則見 lib/tableData 的 chartPlan）
 *   每一組數字一個顏色：強調色、綠、橘（Apple 系統色）
 *   圖的上方一排膠囊＝每一個數字欄：亮著的是現在畫的那幾欄（兼當圖例），點別的就換畫那一欄
 *   （大小差太多的欄位不放在同一張圖，例如「人數 45」和「預算 1,200」，所以要能切換）
 *   Recharts 不認 CSS 變數，顏色在這裡從樣式讀成實際的值；換主題、換強調色會跟著變
 *   這個檔案另外載入（lazy），沒有表格的對話不用下載圖表程式
 */
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useAccentColor } from '@/features/admin/hooks/useAccentColor'
import { useCssPx } from '@/lib/cssVars'
import type { ChartPlan } from '@/lib/tableData'

interface Props {
    plan: ChartPlan
    head: string[]
    /** 點了某一欄的膠囊 */
    onFocus: (col: number) => void
    /** 長條長出來的動畫（列印時關掉） */
    animate?: boolean
}

const cssColor = (name: string) =>
    (typeof window === 'undefined' ? '' : getComputedStyle(document.documentElement).getPropertyValue(name).trim())

const CHART_VARS = ['--md-chart-h', '--md-chart-bar'] as const

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 })

export default function TableChart({ plan, head, onFocus, animate = true }: Readonly<Props>) {
    const accent = useAccentColor()
    const colors = [accent.full, cssColor('--sys-green'), cssColor('--sys-orange')]
    const ink = 'rgb(var(--text-secondary))'
    const px = useCssPx(CHART_VARS)
    const height = px['--md-chart-h']
    const bar = px['--md-chart-bar']

    return (
        <figure className="md-chart paper" aria-label={plan.valueCols.map((c) => head[c]).join('、')}>
            <figcaption className="md-chart-keys">
                {plan.numericCols.map((c) => {
                    const i = plan.valueCols.indexOf(c)
                    const on = i !== -1
                    return (
                        <button key={c} type="button" className={`md-chart-key${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => onFocus(c)}>
                            {on && <span className="md-chart-dot" style={{ background: colors[i] }} aria-hidden />}
                            {head[c]}
                        </button>
                    )
                })}
            </figcaption>
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
                    {plan.valueCols.map((c, i) => (
                        <Bar key={c} dataKey={`v${c}`} fill={colors[i]} radius={[8, 8, 4, 4]} maxBarSize={bar} isAnimationActive={animate} />
                    ))}
                </BarChart>
            </ResponsiveContainer>
        </figure>
    )
}
