/**
 * 日期區間選擇器（稽核紀錄用）
 *   膠囊按鈕顯示目前的區間（沒選＝「全部時間」）；按下去打開面板：
 *     上面是常用區間（今天、近 7 天、近 30 天、本月、全部時間），點一下就套用；
 *     下面是月曆：先點起日、再點迄日（點到比起日早的日子就重新從那天開始），點完立刻套用。
 *   日期一律是本地日期 YYYY-MM-DD（lib/dates）；不能選未來的日子。
 *   鍵盤：Tab 走到每一天、Enter 選；Esc 關閉（useDismiss）
 *   外觀：選了區間時按鈕不塗滿強調色（只有文字、圖示變強調色）——滿版強調色留給頁面的主要按鈕；
 *     區間是一條淡淡的帶子，在每一行的頭尾收成圓角、延伸到起訖兩天的圓圈後面（像 iPhone 行事曆）
 */
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Calendar, ChevronLeft, ChevronRight } from '@/components/snow/icons'
import { localDate } from '@/lib/dates'
import { useDismiss } from '@/lib/useDismiss'
import { useKeepInViewport, type ViewportAnchor } from '@/lib/useKeepInViewport'

export interface DateRange {
    start?: string
    end?: string
}

interface Props {
    value: DateRange
    onChange: (range: DateRange) => void
}

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const DAY_MS = 86_400_000

function presets(today: Date): Array<{ id: string; range: DateRange }> {
    const t = localDate(today)
    return [
        { id: 'today', range: { start: t, end: t } },
        { id: 'last7', range: { start: localDate(addDays(today, -6)), end: t } },
        { id: 'last30', range: { start: localDate(addDays(today, -29)), end: t } },
        { id: 'thisMonth', range: { start: localDate(new Date(today.getFullYear(), today.getMonth(), 1)), end: t } },
        { id: 'all', range: {} },
    ]
}

/** 月曆一格一天：前面補上個月的空格（key 用「空格-第幾格」），讓 1 號落在正確的星期 */
function monthCells(year: number, month: number): { key: string; day: string | null }[] {
    const first = new Date(year, month, 1).getDay()
    const days = new Date(year, month + 1, 0).getDate()
    const blanks = Array.from({ length: first }, (_, n) => ({ key: `blank-${n}`, day: null }))
    const dates = Array.from({ length: days }, (_, n) => {
        const day = localDate(new Date(year, month, n + 1))
        return { key: day, day }
    })
    return [...blanks, ...dates]
}

/** 星期的代碼（0＝星期日）：當作 key，標示文字依語言另外產生 */
const WEEK = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

export default function DateRangePicker({ value, onChange }: Readonly<Props>) {
    const { t, i18n } = useTranslation()
    const [open, setOpen] = useState(false)
    const [picking, setPicking] = useState<string | null>(null)
    const today = useMemo(() => new Date(), [open]) // eslint-disable-line react-hooks/exhaustive-deps
    const todayStr = localDate(today)
    const [view, setView] = useState(() => ({ y: today.getFullYear(), m: today.getMonth() }))
    const btnRef = useRef<HTMLButtonElement>(null)
    const panelRef = useRef<HTMLDialogElement>(null)
    const close = () => { setOpen(false); setPicking(null) }
    useDismiss(open, close, [panelRef, btnRef])
    // 手機上面板可能超出畫面：自動挪進來（下面放不下、上面放得下就翻到按鈕上方）
    const [anchor, setAnchor] = useState<ViewportAnchor | null>(null)
    useKeepInViewport(panelRef, open, anchor)

    const fmt = useMemo(() => new Intl.DateTimeFormat(i18n.language, { month: 'numeric', day: 'numeric' }), [i18n.language])
    const monthFmt = useMemo(() => new Intl.DateTimeFormat(i18n.language, { year: 'numeric', month: 'long' }), [i18n.language])
    const weekdays = useMemo(() => {
        const f = new Intl.DateTimeFormat(i18n.language, { weekday: 'narrow' })
        return WEEK.map((id, i) => ({ id, label: f.format(new Date(2024, 0, 7 + i)) })) // 2024/1/7 是星期日
    }, [i18n.language])
    const day = (s: string) => fmt.format(new Date(`${s}T00:00`))
    // 報讀軟體唸完整日期（「2026年11月22日 星期日」），不是 2026-11-22
    const fullFmt = useMemo(() => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'full' }), [i18n.language])

    const rangeText = (s: string, e: string) => (s === e ? day(s) : `${day(s)} – ${day(e)}`)
    const label = value.start && value.end ? rangeText(value.start, value.end) : t('ui.range.all')
    const days = value.start && value.end ? Math.round((new Date(`${value.end}T00:00`).getTime() - new Date(`${value.start}T00:00`).getTime()) / DAY_MS) + 1 : 0

    let hint = t('ui.range.pickStart')
    if (picking) hint = t('ui.range.pickEnd')
    else if (days) hint = t('ui.range.days', { n: days })

    const apply = (range: DateRange) => { onChange(range); close() }
    const pick = (d: string) => {
        if (!picking || d < picking) { setPicking(d); return }
        apply({ start: picking, end: d })
    }

    const start = picking ?? value.start
    const end = picking ? undefined : value.end
    const shift = (n: number) => setView(({ y, m }) => { const d = new Date(y, m + n, 1); return { y: d.getFullYear(), m: d.getMonth() } })

    return (
        <div className="relative">
            <button
                ref={btnRef}
                type="button"
                className={`btn btn-secondary !h-[var(--sz-40)] !px-[var(--sp-18)] !text-[length:var(--fs-14)] whitespace-nowrap${value.start ? ' drp-trigger-on' : ''}`}
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={() => {
                    if (open) { close(); return }
                    const r = btnRef.current?.getBoundingClientRect()
                    setAnchor(r ? { top: r.top, bottom: r.bottom } : null)
                    setOpen(true)
                }}
            >
                <Calendar className="h-4 w-4" />
                {label}
            </button>
            {open && (
                <dialog open ref={panelRef} className="drp paper paper-solid" aria-label={t('ui.range.title')}>
                    <div className="drp-presets">
                        {presets(today).map((p) => {
                            const on = (p.range.start ?? '') === (value.start ?? '') && (p.range.end ?? '') === (value.end ?? '')
                            return (
                                <button key={p.id} type="button" className={`drp-chip${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => apply(p.range)}>
                                    {t(`ui.range.${p.id}`)}
                                </button>
                            )
                        })}
                    </div>
                    <div className="drp-head">
                        <button type="button" className="icon-tap" aria-label={t('ui.range.prev')} onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></button>
                        <span className="drp-month">{monthFmt.format(new Date(view.y, view.m, 1))}</span>
                        <button type="button" className="icon-tap" aria-label={t('ui.range.next')} disabled={view.y === today.getFullYear() && view.m === today.getMonth()} onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></button>
                    </div>
                    <fieldset className="drp-grid">
                        <legend className="sr-only">{monthFmt.format(new Date(view.y, view.m, 1))}</legend>
                        {weekdays.map((w) => <span key={w.id} className="drp-wd" aria-hidden>{w.label}</span>)}
                        {monthCells(view.y, view.m).map(({ key, day: d }, i) => {
                            if (!d) return <span key={key} />
                            const inRange = !!start && !!end && d >= start && d <= end
                            const edge = d === start || d === end
                            // 區間帶子：這一天是不是一行的頭／尾（收圓角）、是不是區間的起／訖（帶子只畫半格，接到圓圈後面）
                            const col = i % 7
                            const span = !!start && !!end && start !== end
                            const cls = [
                                'drp-day',
                                inRange && 'is-in',
                                edge && 'is-edge',
                                span && d === start && 'is-start',
                                span && d === end && 'is-end',
                                col === 0 && 'is-row-start',
                                col === 6 && 'is-row-end',
                                d === todayStr && 'is-today',
                            ].filter(Boolean).join(' ')
                            return (
                                <button
                                    key={d}
                                    type="button"
                                    disabled={d > todayStr}
                                    className={cls}
                                    aria-pressed={edge}
                                    aria-label={fullFmt.format(new Date(`${d}T00:00`))}
                                    onClick={() => pick(d)}
                                >
                                    <span className="drp-num">{Number(d.slice(8))}</span>
                                </button>
                            )
                        })}
                    </fieldset>
                    <p className="drp-hint" aria-live="polite">
                        {hint}
                    </p>
                </dialog>
            )}
        </div>
    )
}
