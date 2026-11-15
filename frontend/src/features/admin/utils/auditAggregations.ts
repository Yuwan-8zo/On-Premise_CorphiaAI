/**
 * 審計日誌前端聚合工具
 * --------------------
 * 不動後端，純前端把 audit logs 聚合成圖表需要的 series。
 * 兩個用途：
 *   1) aggregateByDay — 過去 N 天每日事件數，畫趨勢柱狀圖
 *   2) aggregateByAction — 依 action 分組，畫分布甜甜圈
 *
 * Caveat：來源資料是 AdminPage 已抓進 props 的 logs（通常是最新一頁）。
 * 如果分頁很多，這邊聚合出來的計數會偏低；解法是後端提供 aggregation API。
 */

import { parseServerDate } from '@/lib/utils'
import type { AuditLogItem } from '@/api/auditLogs'
import { auditActionLabel } from '@/features/admin/utils/auditLabels'
import i18n from '@/i18n'

/* ────────────────────────────────────────────────────────────────────────
   通用 categorical 聚合 — 給 dashboard 各種「類別 → 數量」分布圖共用
   ──────────────────────────────────────────────────────────────────────── */

export interface CategoryCount {
    /** Stable key (used for React key + lookup) */
    key: string
    /** Display label */
    name: string
    /** Number of items with this key */
    count: number
}

export interface DailyCount {
    /** "MM/DD" — for X-axis tick label */
    date: string
    /** 週幾 — for tooltip */
    weekday: string
    /** ISO date — for tooltip / debugging */
    iso: string
    count: number
}

export interface ActionCount {
    /** 中文 label，找不到時退回原始 action 字串 */
    name: string
    rawAction: string
    count: number
}

/**
 * 把 audit logs 依日期 bucket 成過去 N 天（含今天）的計數。
 * 結果按時間順序排序（最早 → 今天，最右為今日）。
 */
export function aggregateByDay(
    logs: AuditLogItem[],
    days = 7,
    /** 介面語言（星期幾的寫法） */
    lang: string = i18n.language,
): DailyCount[] {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const buckets: DailyCount[] = []
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today)
        d.setDate(today.getDate() - i)
        buckets.push({
            date: `${d.getMonth() + 1}/${d.getDate()}`,
            weekday: d.toLocaleDateString(lang || undefined, { weekday: 'short' }), // 跟著介面語言（週一／Mon／月）
            iso: d.toISOString(),
            count: 0,
        })
    }

    for (const log of logs) {
        if (!log.created_at) continue
        const created = parseServerDate(log.created_at)
        if (Number.isNaN(created.getTime())) continue
        created.setHours(0, 0, 0, 0)
        const diffDays = Math.floor(
            (today.getTime() - created.getTime()) / 86400000,
        )
        if (diffDays >= 0 && diffDays < days) {
            buckets[days - 1 - diffDays].count += 1
        }
    }

    return buckets
}

/**
 * 把 audit logs 依 action 分組聚合，回傳 top N 個（其餘併到「其他」）。
 * 已按 count 由大到小排序。
 * 排除自動產生的 action（如 token_refresh），避免噪音。
 */
const EXCLUDED_FROM_DASHBOARD = new Set([
    'token_refresh',  // 自動排程，不是使用者行為
])

export function aggregateByAction(
    logs: AuditLogItem[],
    topN = 5,
    /** 介面語言（分類名稱） */
    lang: string = i18n.language,
): ActionCount[] {
    const t = i18n.getFixedT(lang)
    const counts = new Map<string, number>()
    for (const log of logs) {
        if (EXCLUDED_FROM_DASHBOARD.has(log.action)) continue
        counts.set(log.action, (counts.get(log.action) ?? 0) + 1)
    }

    const sorted: ActionCount[] = Array.from(counts.entries())
        .map(([rawAction, count]) => ({
            rawAction,
            name: auditActionLabel(t, rawAction),
            count,
        }))
        .sort((a, b) => b.count - a.count)

    if (sorted.length <= topN) return sorted

    const top = sorted.slice(0, topN)
    const otherCount = sorted
        .slice(topN)
        .reduce((sum, item) => sum + item.count, 0)
    if (otherCount > 0) {
        top.push({ rawAction: '__other__', name: t('ui.charts.other'), count: otherCount })
    }
    return top
}
