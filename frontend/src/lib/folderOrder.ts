/**
 * 專案資料夾的手動排序（側欄拖曳）——記在這台裝置（localStorage，每個帳號分開）
 *
 *   applyOrder(names, order)   依記下來的順序排；新資料夾（還沒排過）照原本的順序接在後面
 *   moveName(names, from, to)  把第 from 個移到第 to 個的位置，回傳新的順序
 *   loadOrder(userId) / saveOrder(userId, order)
 *
 * 一般對話不做手動排序：清單本來就照「最近使用」排，手動排會跟它打架。
 */
const key = (userId: string) => `corphia-folder-order:${userId}`

export function loadOrder(userId: string | undefined): string[] {
    if (!userId) return []
    try {
        const v = JSON.parse(localStorage.getItem(key(userId)) ?? '[]')
        return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
    } catch {
        return []
    }
}

export function saveOrder(userId: string | undefined, order: string[]) {
    if (!userId) return
    try { localStorage.setItem(key(userId), JSON.stringify(order)) } catch { /* 存不了就只在這次有效 */ }
}

export function applyOrder(names: readonly string[], order: readonly string[]): string[] {
    const rank = new Map(order.map((n, i) => [n, i]))
    return names
        .map((n, i) => ({ n, i, r: rank.get(n) ?? Number.POSITIVE_INFINITY }))
        .sort((a, b) => a.r - b.r || a.i - b.i)
        .map((x) => x.n)
}

export function moveName(names: readonly string[], from: number, to: number): string[] {
    const next = names.slice()
    const [item] = next.splice(from, 1)
    next.splice(Math.max(0, Math.min(to, next.length)), 0, item)
    return next
}
