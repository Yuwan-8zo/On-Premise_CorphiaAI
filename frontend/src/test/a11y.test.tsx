/**
 * 無障礙自動檢查（axe-core，開源的無障礙規則引擎）
 *
 * 常用的元件各畫一次，交給 axe 檢查：按鈕有沒有名稱、表單欄位有沒有標籤、角色用得對不對、ARIA 屬性合不合法…
 * 以後改元件時這裡會自動擋下「讀螢幕軟體用不了」的寫法（之前一輪人工審查找到的那類問題）。
 * 顏色對比在 jsdom 裡量不到（沒有真的畫面），交給 Lighthouse CI（.github/workflows/lighthouse.yml）在真的瀏覽器裡量。
 */
import { describe, expect, it } from 'vitest'
import { render, act } from '@testing-library/react'
import { axe } from 'vitest-axe'

import ConversationRow from '@/features/chat/components/ConversationRow'
import SortHeader from '@/components/ui/SortHeader'
import GlassSegmented from '@/components/ui/GlassSegmented'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import DateRangePicker from '@/features/admin/components/DateRangePicker'
import { useUIStore } from '@/store/uiStore'
import type { Conversation } from '@/types/chat'

/** jsdom 量不到顏色對比：關掉這一條，其他規則全開 */
const run = (el: Element) => axe(el, { rules: { 'color-contrast': { enabled: false } } })

describe('無障礙（axe）', () => {
    it('側欄的對話列（可以用鍵盤選、「⋯」有名稱）', async () => {
        const conv = { id: 'c1', title: '季報整理', created_at: '', updated_at: '' } as unknown as Conversation
        const { container } = render(
            <div role="list">
                <div role="listitem">
                    <ConversationRow
                        conv={conv}
                        isCurrent
                        isMenuOpen={false}
                        rowRef={() => undefined}
                        pressProps={{}}
                        onSelect={() => undefined}
                        menuButtonProps={{ onPointerDown: () => undefined, onClick: () => undefined, className: '' }}
                        swipe={{ onRename: () => undefined, onDelete: () => undefined }}
                    />
                </div>
            </div>,
        )
        expect(await run(container)).toHaveNoViolations()
    })

    it('可排序的表頭', async () => {
        const { container } = render(
            <table>
                <thead>
                    <tr>
                        <th aria-sort="ascending"><SortHeader label="名稱" dir="asc" onSort={() => undefined} /></th>
                        <th><SortHeader label="角色" dir={null} onSort={() => undefined} /></th>
                    </tr>
                </thead>
                <tbody><tr><td>王小明</td><td>使用者</td></tr></tbody>
            </table>,
        )
        expect(await run(container)).toHaveNoViolations()
    })

    it('分段切換器（文字、只有圖示兩種）', async () => {
        const { container } = render(
            <div>
                <GlassSegmented value="a" onChange={() => undefined} options={[{ value: 'a', label: '一般' }, { value: 'b', label: '專案' }]} />
                <GlassSegmented value="a" onChange={() => undefined} options={[{ value: 'a', label: <svg aria-hidden />, name: '一般' }, { value: 'b', label: <svg aria-hidden />, name: '專案' }]} />
            </div>,
        )
        expect(await run(container)).toHaveNoViolations()
    })

    it('確認框（一般、破壞性）', async () => {
        for (const tone of ['default', 'danger'] as const) {
            const { baseElement, unmount } = render(<ConfirmModal />)
            act(() => useUIStore.getState().showConfirm('要刪除這則對話嗎？', () => undefined, undefined, { tone }))
            expect(await run(baseElement)).toHaveNoViolations()
            act(() => useUIStore.getState().closeConfirm())
            unmount()
        }
    })

    it('日期區間選擇器（打開的面板）', async () => {
        const { container, getByRole } = render(<DateRangePicker value={{}} onChange={() => undefined} />)
        act(() => getByRole('button').click())
        expect(await run(container)).toHaveNoViolations()
    })
})
