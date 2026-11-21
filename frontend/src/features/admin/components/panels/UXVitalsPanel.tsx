/**
 * 使用者體驗面板（近 7 天，資料來自 lib/webVitals 量的真實使用）
 *
 *   三個最重要的指標，各顯示「第 75 百分位」的數值（四分之三的使用都比這個快；Google 判斷網站好壞用的就是這個）：
 *     按下去的反應（INP）、畫面載入（LCP）、版面穩定（CLS）
 *   好壞門檻照 Google 的 Core Web Vitals（VITAL_THRESHOLDS），數字是標準本身，不是畫面尺寸
 *   只顯示數字和等級：量測時就沒有收任何使用者或對話資訊
 */
import { useTranslation } from 'react-i18next'

import apiClient from '@/api/client'
import { Panel, SectionHeader } from '@/features/admin/components/AdminPrimitives'
import { usePolling } from '@/features/admin/hooks/usePolling'
import { SkelText } from '@/components/ui/Skeleton'

type MetricKey = 'INP' | 'LCP' | 'CLS'
type Rating = 'good' | 'needs-improvement' | 'poor'

interface MetricSummary {
    count: number
    p75: number | null
}
interface VitalsSummary {
    days: number
    metrics: Record<string, MetricSummary>
}

/** Google Core Web Vitals 的門檻：≤ 第一個＝良好，≤ 第二個＝待改善，其他＝偏慢（時間是毫秒） */
export const VITAL_THRESHOLDS: Record<MetricKey, [number, number]> = {
    INP: [200, 500],
    LCP: [2500, 4000],
    CLS: [0.1, 0.25],
}
const SHOWN: MetricKey[] = ['INP', 'LCP', 'CLS']
/** 多久重新讀一次（量測資料變化慢） */
const POLL_MS = 60_000

export function ratingOf(key: MetricKey, value: number): Rating {
    const [good, ni] = VITAL_THRESHOLDS[key]
    if (value <= good) return 'good'
    return value <= ni ? 'needs-improvement' : 'poor'
}

const TONE: Record<Rating, string> = {
    good: 'text-[var(--ink-green)]',
    'needs-improvement': 'text-[var(--ink-orange)]',
    poor: 'text-[var(--danger-ink)]',
}

export default function UXVitalsPanel({ className }: Readonly<{ className?: string }>) {
    const { t } = useTranslation()
    const { data, error } = usePolling(async () => (await apiClient.get<VitalsSummary>('/vitals/summary', { params: { days: 7 } })).data, POLL_MS, true)

    const format = (key: MetricKey, v: number) => {
        if (key === 'CLS') return v.toFixed(2)
        return v < 1000 ? t('admin.overview.ux.ms', { n: Math.round(v) }) : t('admin.overview.ux.sec', { n: (v / 1000).toFixed(1) })
    }
    const empty = data && SHOWN.every((k) => !data.metrics[k]?.count)

    return (
        <Panel className={`flex flex-col ${className || ''}`}>
            <SectionHeader title={t('admin.overview.ux.title')} />
            <div className="px-[var(--space)] pb-[var(--space)]">
                <p className="mb-[var(--sp-12)] text-[length:var(--fs-12)] leading-[var(--lh-16)] text-text-secondary">{t('admin.overview.ux.hint')}</p>
                {error && !data ? (
                    <p className="py-[var(--sp-12)] text-[length:var(--fs-15)] leading-[var(--lh-20)] text-text-secondary">{t('admin.overview.ux.unavailable')}</p>
                ) : empty ? (
                    <p className="py-[var(--sp-12)] text-[length:var(--fs-15)] leading-[var(--lh-20)] text-text-secondary">{t('admin.overview.ux.empty')}</p>
                ) : (
                    <div className="grid grid-cols-1 gap-[var(--space)] sm:grid-cols-3">
                        {SHOWN.map((key) => {
                            const m = data?.metrics[key]
                            const rating = m?.p75 != null ? ratingOf(key, m.p75) : null
                            return (
                                <div key={key} className="flex flex-col gap-[var(--sp-4)] px-[var(--sp-14)] py-3 rounded-[var(--admin-in)] bg-[var(--chip)]">
                                    <p className="text-[length:var(--fs-12)] leading-[var(--lh-16)] font-medium text-text-secondary">{t(`admin.overview.ux.${key}`)}</p>
                                    <p className="text-[length:var(--fs-28)] leading-none font-semibold tabular-nums text-text-primary">
                                        {!data ? <SkelText>000</SkelText> : m?.p75 != null ? format(key, m.p75) : '—'}
                                    </p>
                                    <p className="flex items-center gap-[var(--sp-6)] text-[length:var(--fs-12)] leading-[var(--lh-16)] text-text-secondary">
                                        {rating && <span className={`font-semibold ${TONE[rating]}`}>{t(`admin.overview.ux.rating.${rating}`)}</span>}
                                        {m?.count ? <span className="tabular-nums">{t('admin.overview.ux.samples', { n: m.count })}</span> : null}
                                    </p>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </Panel>
    )
}
