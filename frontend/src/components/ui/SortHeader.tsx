/**
 * 可以排序的表頭：整格是一顆按鈕，旁邊的小箭頭表示目前方向（沒排序時淡淡的上下箭頭）
 *   搭配 lib/useTableSort：<SortHeader label="名稱" {...sort.headerProps('name')} />
 *   報讀軟體會唸出「遞增／遞減排序」（aria-sort 放在外面的 <th> 上，見 lib/useTableSort 的 sortAria）
 */
import type { SortDir } from '@/lib/useTableSort'
import { ChevronDown, ChevronUp } from '@/components/snow/icons'

interface Props {
    label: string
    dir: SortDir | null
    onSort: () => void
}

export default function SortHeader({ label, dir, onSort }: Readonly<Props>) {
    return (
        <button type="button" className={`sort-head${dir ? ' is-on' : ''}`} onClick={onSort}>
            <span>{label}</span>
            <span className="sort-head-arrow" aria-hidden>
                {dir === 'desc' ? <ChevronDown /> : <ChevronUp />}
            </span>
        </button>
    )
}
