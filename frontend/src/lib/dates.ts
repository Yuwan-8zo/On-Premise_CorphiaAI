/**
 * 日期共用工具（一律用使用者所在地的「本地」日期，不要用 toISOString().slice(0, 10)：那是 UTC，台灣早上 8 點前會變成前一天）
 */

const pad = (n: number) => String(n).padStart(2, '0')

/** 本地日期 YYYY-MM-DD */
export function localDate(d: Date = new Date()): string {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 'YYYY-MM-DD' 解析成本地那天的 00:00；格式不對回 null */
function parseLocalDay(day: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
}

/** 本地那天開始的確切時間（給後端篩選用，帶時區）；不是單純日期就原樣回傳 */
export function dayStartISO(day: string): string {
    const d = parseLocalDay(day)
    return d ? d.toISOString() : day
}

/** 本地那天最後一刻的確切時間（含整天）；不是單純日期就原樣回傳 */
export function dayEndISO(day: string): string {
    const d = parseLocalDay(day)
    if (!d) return day
    d.setDate(d.getDate() + 1)
    return new Date(d.getTime() - 1).toISOString()
}
