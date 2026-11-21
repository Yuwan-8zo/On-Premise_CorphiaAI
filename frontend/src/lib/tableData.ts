/**
 * 表格資料工具（AI 回答裡的表格：下載 CSV、複製到 Excel、自動畫長條圖）——純函式，不碰畫面
 *
 *   readTable(el)      從畫好的 <table> 讀出表頭與每一列的文字
 *   toCsv(t)           轉成 CSV（前面加 BOM，Excel 直接打開中文不會亂碼）
 *   toTsv(t)           轉成以 Tab 分隔的文字：貼進 Excel、Google 試算表會自動分欄
 *   parseNum(s)        「1,234」「NT$ 500」「12.5%」「3 萬」這類儲存格讀成數字；不是數字回傳 null
 *   chartPlan(t)       這張表適不適合畫長條圖：找出標籤欄和數字欄；不適合回傳 null
 */

export interface TableData {
    head: string[]
    rows: string[][]
}

export function readTable(el: HTMLTableElement): TableData {
    const text = (c: Element) => (c.textContent ?? '').replace(/\s+/g, ' ').trim()
    const head = Array.from(el.querySelectorAll('thead th')).map(text)
    const rows = Array.from(el.querySelectorAll('tbody tr')).map((tr) => Array.from(tr.querySelectorAll('td,th')).map(text))
    return { head, rows }
}

const csvCell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

export function toCsv({ head, rows }: TableData): string {
    return '﻿' + [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')
}

export function toTsv({ head, rows }: TableData): string {
    return [head, ...rows].map((r) => r.map((v) => v.replace(/[\t\n\r]+/g, ' ')).join('\t')).join('\n')
}

/** 數字前後最多容許幾個非數字的字（幣別、單位、百分比） */
const MAX_AFFIX = 4
/** 數字前面可以有的字：幣別、約略 */
const PREFIX_OK = /^(nt\$|us\$|hk\$|rmb|\$|€|£|¥|￥|約|~|≈)?$/i
const NUM_RE = new RegExp(String.raw`^(\D{0,${MAX_AFFIX}}?)\s*([-+−]?\d[\d,，]*(?:\.\d+)?)\s*(\D{0,${MAX_AFFIX}})$`)

export function parseNum(raw: string): number | null {
    const s = raw.trim()
    if (!s) return null
    const m = NUM_RE.exec(s)
    if (!m) return null
    // 前後的字不能又夾著數字（例如「2024-01」）；前面只能是幣別或「約」（「第 3 季」「abc123」不是量）
    if (/\d/.test(m[1] + m[3]) || !PREFIX_OK.test(m[1].trim())) return null
    const n = Number(m[2].replace(/[,，]/g, '').replace('−', '-'))
    if (!Number.isFinite(n)) return null
    if (m[3].startsWith('萬')) return n * 1e4
    if (m[3].startsWith('億')) return n * 1e8
    return n
}

/** 表格停止變動多久才畫長條圖（AI 還在打字時表格會一直長）；列印成 PDF 也要等這麼久 */
export const TABLE_SETTLE_MS = 600

/** 一欄至少要有這個比例的儲存格是數字，才算數字欄 */
const NUMERIC_SHARE = 0.8
/** 列數在這個範圍內才畫（太少沒意義、太多擠成一團） */
export const CHART_MIN_ROWS = 2
export const CHART_MAX_ROWS = 24
/** 最多畫幾組長條 */
export const CHART_MAX_SERIES = 3
/** 數字欄之間大小差超過這個倍數就不放在同一張圖（小的會看不見） */
const SCALE_RATIO = 20
/** 標題像這些字的欄位是編號／年份，不當成要比較的數字 */
const ID_HEAD = /^(#|no\.?|id|編號|序號|項次|年|年份|年度|year|date|日期|月|月份)$/i

export interface ChartPlan {
    labelCol: number
    /** 這張圖畫哪幾欄（大小相近、可以放在同一張圖的那一組） */
    valueCols: number[]
    /** 所有可以畫的數字欄（畫面上一欄一顆膠囊，點了切換；大小差太多的欄位分開畫） */
    numericCols: number[]
    data: Array<Record<string, string | number>>
}

/**
 * focus：要以哪一個數字欄為主（預設第一個數字欄）；和它大小相近的欄一起畫，最多 CHART_MAX_SERIES 組
 */
export function chartPlan(t: TableData, focus?: number): ChartPlan | null {
    const { head, rows } = t
    if (rows.length < CHART_MIN_ROWS || rows.length > CHART_MAX_ROWS || head.length < 2) return null
    const cols = head.map((_, c) => rows.map((r) => parseNum(r[c] ?? '')))
    const isNumeric = cols.map((vals) => vals.filter((v) => v !== null).length / rows.length >= NUMERIC_SHARE)
    // 標籤欄：第一個不是數字的欄；全部都是數字（例如第一欄是年份）就用第一欄
    const firstText = isNumeric.findIndex((n) => !n)
    const labelCol = firstText === -1 ? 0 : firstText
    const maxOf = (c: number) => Math.max(...cols[c].map((v) => Math.abs(v ?? 0)))
    const numericCols = head.map((_, c) => c).filter((c) => c !== labelCol && isNumeric[c] && !ID_HEAD.test(head[c].trim()) && maxOf(c) > 0)
    if (!numericCols.length) return null
    const main = focus !== undefined && numericCols.includes(focus) ? focus : numericCols[0]
    const top = maxOf(main)
    const valueCols = [main, ...numericCols.filter((c) => {
        if (c === main) return false
        const m = maxOf(c)
        return Math.max(m, top) / Math.min(m, top) <= SCALE_RATIO
    })].slice(0, CHART_MAX_SERIES).sort((a, b) => a - b)
    const data = rows.map((r, i) => {
        const point: Record<string, string | number> = { label: r[labelCol] || String(i + 1) }
        for (const c of numericCols) point[`v${c}`] = cols[c][i] ?? 0
        return point
    })
    return { labelCol, valueCols, numericCols, data }
}
