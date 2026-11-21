import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useToastStore } from '../toastStore'

describe('「復原」通知不會被其他通知蓋掉', () => {
    beforeEach(() => { vi.useFakeTimers(); useToastStore.setState({ toasts: [] }) })
    afterEach(() => { vi.runAllTimers(); vi.useRealTimers() })

    it('顯示期間來的一般通知先排隊，復原按鈕一直在', () => {
        const undo = vi.fn()
        useToastStore.getState().undoable('已刪除「A」', '復原', undo, 5000)
        useToastStore.getState().info('另一則通知')
        const t = useToastStore.getState().toasts
        expect(t).toHaveLength(1)
        expect(t[0].message).toBe('已刪除「A」')
        expect(t[0].action?.label).toBe('復原')
        t[0].action!.onClick()
        expect(undo).toHaveBeenCalledOnce()
        // 按了復原之後，排隊的通知才出來
        expect(useToastStore.getState().toasts[0]?.message).toBe('另一則通知')
    })

    it('時間到自動收起，排隊的接著顯示', () => {
        useToastStore.getState().undoable('已刪除「B」', '復原', () => {}, 5000)
        useToastStore.getState().error('連線中斷')
        vi.advanceTimersByTime(5000)
        expect(useToastStore.getState().toasts[0]?.message).toBe('連線中斷')
    })
})
