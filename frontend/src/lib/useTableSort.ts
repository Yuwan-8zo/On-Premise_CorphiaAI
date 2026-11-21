/**
 * 表格排序（後台各個資料表共用）
 *
 *   const sort = useTableSort<Row, 'name' | 'lastLogin'>(rows, { name: (r) => r.name, lastLogin: (r) => r.lastLoginAt ?? '' })
 *   sort.rows          排好的資料
 *   sort.headerProps('name')   給 <SortHeader> 的屬性（目前是哪一欄、哪個方向、點了要做什麼）
 *
 * 點同一欄：升冪 → 降冪 → 不排序（回到原本的順序）；換一欄從升冪開始。
 * 文字用目前語言的排序規則（中文依筆畫／注音由瀏覽器決定）、數字照大小、空值永遠排最後。
 */
import { useMemo, useState } from 'react'
import i18n from '@/i18n'

export type SortDir = 'asc' | 'desc'
type Value = string | number | null | undefined

/** 給 <th aria-sort> 用 */
const ARIA_SORT = { asc: 'ascending', desc: 'descending' } as const
export const sortAria = (dir: SortDir | null) => (dir ? ARIA_SORT[dir] : 'none')

export function compareValues(a: Value, b: Value, dir: SortDir): number {
    const emptyA = a === null || a === undefined || a === ''
    const emptyB = b === null || b === undefined || b === ''
    if (emptyA && emptyB) return 0
    if (emptyA) return 1
    if (emptyB) return -1
    const n = typeof a === 'number' && typeof b === 'number'
        ? a - b
        : String(a).localeCompare(String(b), i18n.language, { numeric: true, sensitivity: 'base' })
    return dir === 'asc' ? n : -n
}

export function useTableSort<Row, Key extends string>(rows: readonly Row[], getters: Record<Key, (r: Row) => Value>) {
    const [sort, setSort] = useState<{ key: Key; dir: SortDir } | null>(null)

    const sorted = useMemo(() => {
        if (!sort) return rows.slice()
        const get = getters[sort.key]
        // 加上原本的位置當平手時的依據：同值的列不會跳來跳去
        return rows
            .map((r, i) => ({ r, i }))
            .sort((x, y) => compareValues(get(x.r), get(y.r), sort.dir) || x.i - y.i)
            .map((x) => x.r)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rows, sort])

    const toggle = (key: Key) =>
        setSort((cur) => {
            if (cur?.key !== key) return { key, dir: 'asc' }
            return cur.dir === 'asc' ? { key, dir: 'desc' } : null
        })

    const headerProps = (key: Key) => ({
        dir: sort?.key === key ? sort.dir : null,
        onSort: () => toggle(key),
    })

    return { rows: sorted, sort, headerProps }
}
