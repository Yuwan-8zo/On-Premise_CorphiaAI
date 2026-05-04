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

import type { AuditLogItem } from '@/api/auditLogs'
import { ACTION_LABELS } from '@/api/auditLogs'

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

/**
 * 把陣列依某個 key 分組計數，回傳 (key, name, count) 排序後 list（大到小）
 *
 * @param items     資料陣列
 * @param getKey    從一筆資料拿出 group key（也用來查 labelMap）
 * @param labelMap  key → 顯示名稱對應；找不到時 fallback 用 key 自己當名稱
 */
export function groupByKey<T>(
    items: T[],
    getKey: (item: T) => string,
    labelMap: Record<string, string> = {},
): CategoryCount[] {
    const counts = new Map<string, number>()
    for (const it of items) {
        const k = getKey(it)
        if (!k) continue
        counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    return Array.from(counts.entries())
        .map(([key, count]) => ({
            key,
            name: labelMap[key] ?? key,
            count,
        }))
        .sort((a, b) => b.count - a.count)
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

const WEEK_LABELS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']

/**
 * 把 audit logs 依日期 bucket 成過去 N 天（含今天）的計數。
 * 結果按時間順序排序（最早 → 今天，最右為今日）。
 */
export function aggregateByDay(
    logs: AuditLogItem[],
    days = 7,
): DailyCount[] {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const buckets: DailyCount[] = []
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today)
        d.setDate(today.getDate() - i)
        buckets.push({
            date: `${d.getMonth() + 1}/${d.getDate()}`,
            weekday: WEEK_LABELS[d.getDay()],
            iso: d.toISOString(),
            count: 0,
        })
    }

    for (const log of logs) {
        if (!log.created_at) continue
        const created = new Date(log.created_at)
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
 */
export function aggregateByAction(
    logs: AuditLogItem[],
    topN = 5,
): ActionCount[] {
    const counts = new Map<string, number>()
    for (const log of logs) {
        counts.set(log.action, (counts.get(log.action) ?? 0) + 1)
    }

    const sorted: ActionCount[] = Array.from(counts.entries())
        .map(([rawAction, count]) => ({
            rawAction,
            name: ACTION_LABELS[rawAction] ?? rawAction,
            count,
        }))
        .sort((a, b) => b.count - a.count)

    if (sorted.length <= topN) return sorted

    const top = sorted.slice(0, topN)
    const otherCount = sorted
        .slice(topN)
        .reduce((sum, item) => sum + item.count, 0)
    if (otherCount > 0) {
        top.push({ rawAction: '__other__', name: '其他', count: otherCount })
    }
    return top
}
