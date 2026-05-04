/**
 * StatusBar — 文件處理狀態的水平堆疊條
 * --------------------------------------
 * 把 documents 依 status 分組（pending / processing / completed / failed），
 * 顯示一條 bg-bg-surface 軌道上不同色的水平 segment + 下方 legend。
 *
 * 用 div + flex 而非 recharts 因為這個圖很簡單（一條線 4 段），
 * 用 recharts 反而 overkill；自製比較精簡也不會有 ResponsiveContainer 高度問題。
 *
 * 配色：
 *   pending   = 灰
 *   processing = accent
 *   completed  = green
 *   failed     = red
 */

export interface StatusBarDatum {
    /** Stable key */
    key: 'pending' | 'processing' | 'completed' | 'failed' | string
    /** Display label */
    label: string
    count: number
}

interface StatusBarProps {
    data: StatusBarDatum[]
    emptyText?: string
}

const STATUS_COLORS: Record<string, string> = {
    pending: 'rgb(var(--text-muted) / 0.6)',
    processing: 'rgb(var(--accent))',
    completed: '#10b981', // emerald-500
    failed: '#ef4444',     // red-500
}

const STATUS_DEFAULT_COLOR = 'rgb(var(--text-muted) / 0.6)'

export default function StatusBar({
    data,
    emptyText = '尚無資料',
}: StatusBarProps) {
    const total = data.reduce((sum, d) => sum + d.count, 0)

    if (total === 0) {
        return (
            <div className="flex h-full min-h-[80px] items-center justify-center text-xs text-text-secondary">
                {emptyText}
            </div>
        )
    }

    return (
        <div className="flex h-full min-h-0 flex-col justify-center gap-3">
            {/* 總數 */}
            <div className="flex items-baseline gap-2">
                <span className="text-[20px] font-light leading-none text-text-primary tabular-nums">
                    {total.toLocaleString()}
                </span>
                <span className="text-[10px] uppercase tracking-[0.16em] text-text-muted">
                    Total
                </span>
            </div>

            {/* 堆疊條 */}
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-bg-surface">
                {data.map((item) => {
                    const pct = (item.count / total) * 100
                    if (pct === 0) return null
                    return (
                        <div
                            key={item.key}
                            className="h-full transition-all duration-300"
                            style={{
                                width: `${pct}%`,
                                background: STATUS_COLORS[item.key] || STATUS_DEFAULT_COLOR,
                            }}
                            title={`${item.label}: ${item.count} (${pct.toFixed(1)}%)`}
                        />
                    )
                })}
            </div>

            {/* Legend */}
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                {data.map((item) => (
                    <li key={item.key} className="flex items-center gap-1.5">
                        <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{
                                background: STATUS_COLORS[item.key] || STATUS_DEFAULT_COLOR,
                            }}
                        />
                        <span className="flex-1 truncate text-text-secondary">
                            {item.label}
                        </span>
                        <span className="font-mono text-text-primary tabular-nums">
                            {item.count}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    )
}
