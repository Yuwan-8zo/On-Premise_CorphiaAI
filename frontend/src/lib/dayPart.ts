/**
 * 現在是什麼時段、什麼節日：聊天首頁的問候語、小 AI 的配件都從這裡讀
 *
 *   時段（DAY_PARTS）：用「幾點開始」切，最後一段一路到隔天第一段之前
 *   節日：農曆用瀏覽器內建的農曆換算（Intl 的 chinese 曆），不寫死每年的日期
 *     - 過年：除夕到初五
 *     - 中秋：八月十四到十六
 *     - 聖誕：12/20～12/26
 *   深夜（late）沒有節日時，小 AI 戴睡帽
 */
import { useEffect, useState } from 'react'

export type DayPart = 'morning' | 'noon' | 'afternoon' | 'evening' | 'late'
export type Holiday = 'newYear' | 'midAutumn' | 'christmas'
export type MascotAccessory = Holiday | 'nightcap'

/** 每段從幾點開始（依時間排序）；凌晨 0～5 點算前一天的最後一段 */
const DAY_PARTS: ReadonlyArray<readonly [DayPart, number]> = [
    ['morning', 5],
    ['noon', 11],
    ['afternoon', 14],
    ['evening', 18],
    ['late', 22],
]
/** 節日的範圍：農曆（月、起日、迄日）或國曆 */
const NEW_YEAR_LAST_DAY = 5
const MID_AUTUMN = { month: 8, from: 14, to: 16 }
const CHRISTMAS = { month: 12, from: 20, to: 26 }
/** 多久重新看一次時間（毫秒）：跨過整點時問候語、配件要跟著換 */
const TICK_MS = 60_000

export function dayPartOf(date: Date): DayPart {
    const h = date.getHours()
    let part: DayPart = DAY_PARTS[DAY_PARTS.length - 1][0]
    for (const [name, start] of DAY_PARTS) if (h >= start) part = name
    return part
}

let lunarFmt: Intl.DateTimeFormat | null | undefined
/** 農曆的月、日；瀏覽器不支援農曆時回傳 null（就不顯示農曆節日） */
function lunar(date: Date): { month: number; day: number } | null {
    if (lunarFmt === undefined) {
        try { lunarFmt = new Intl.DateTimeFormat('en-u-ca-chinese', { month: 'numeric', day: 'numeric' }) } catch { lunarFmt = null }
    }
    if (!lunarFmt) return null
    const parts = lunarFmt.formatToParts(date)
    // 閏月會寫成「6bis」：parseInt 只取數字（閏月不會是一月或八月，不影響判斷）
    const month = Number.parseInt(parts.find((p) => p.type === 'month')?.value ?? '', 10)
    const day = Number.parseInt(parts.find((p) => p.type === 'day')?.value ?? '', 10)
    return Number.isFinite(month) && Number.isFinite(day) ? { month, day } : null
}

export function holidayOf(date: Date): Holiday | null {
    const m = date.getMonth() + 1, d = date.getDate()
    if (m === CHRISTMAS.month && d >= CHRISTMAS.from && d <= CHRISTMAS.to) return 'christmas'
    const today = lunar(date)
    if (!today) return null
    if (today.month === 1 && today.day <= NEW_YEAR_LAST_DAY) return 'newYear'
    // 除夕：明天就是正月初一（臘月可能只有 29 天，所以用「明天」判斷）
    const tomorrow = lunar(new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 12))
    if (tomorrow?.month === 1 && tomorrow.day === 1) return 'newYear'
    if (today.month === MID_AUTUMN.month && today.day >= MID_AUTUMN.from && today.day <= MID_AUTUMN.to) return 'midAutumn'
    return null
}

/** 小 AI 現在該戴什麼：節日優先，其次深夜的睡帽；都不是就不戴 */
export function accessoryOf(date: Date): MascotAccessory | null {
    return holidayOf(date) ?? (dayPartOf(date) === 'late' ? 'nightcap' : null)
}

/** 現在時間（每分鐘更新一次），給要跟著時段變的畫面用 */
export function useNow(): Date {
    const [now, setNow] = useState(() => new Date())
    useEffect(() => {
        const id = window.setInterval(() => setNow(new Date()), TICK_MS)
        return () => window.clearInterval(id)
    }, [])
    return now
}
