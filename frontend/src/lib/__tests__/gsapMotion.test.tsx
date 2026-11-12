import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AnimatePresence, motion } from '@/lib/gsapMotion'

const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }

function Swap({ mode }: { mode: 'a' | 'b' }) {
    return (
        <AnimatePresence mode="wait">
            {mode === 'a' ? (
                <motion.div key="a" {...fade}>A</motion.div>
            ) : (
                <motion.div key="b" {...fade}>B</motion.div>
            )}
        </AnimatePresence>
    )
}

function Toggle({ show }: { show: boolean }) {
    return (
        <AnimatePresence initial={false}>
            {show && <motion.div key="x" data-testid="x" {...fade}>X</motion.div>}
        </AnimatePresence>
    )
}

describe('AnimatePresence', () => {
    beforeEach(() => { vi.useFakeTimers() })
    afterEach(() => { vi.useRealTimers() })

    it('mode="wait" 快速切走又切回：不會閃出還沒畫出來的那一個', () => {
        const { container, rerender } = render(<Swap mode="a" />)
        rerender(<Swap mode="b" />)
        // A 離場中，B 還在等
        expect(container.textContent).toBe('A')
        rerender(<Swap mode="a" />)
        expect(container.textContent).toBe('A')
        act(() => { vi.advanceTimersByTime(1000) })
        expect(container.textContent).toBe('A')
    })

    it('mode="wait" 正常切換：舊的離場完才換新的', () => {
        const { container, rerender } = render(<Swap mode="a" />)
        rerender(<Swap mode="b" />)
        expect(container.textContent).toBe('A')
        act(() => { vi.advanceTimersByTime(1000) })
        expect(container.textContent).toBe('B')
    })

    it('initial={false}：第一次不播進場，移除後再出現要播', () => {
        const { getByTestId, queryByTestId, rerender } = render(<Toggle show />)
        // 第一次：沒有設成透明（直接顯示）
        expect(getByTestId('x').style.opacity).toBe('')
        rerender(<Toggle show={false} />)
        act(() => { vi.advanceTimersByTime(1000) })
        expect(queryByTestId('x')).toBeNull()
        rerender(<Toggle show />)
        // 再出現：從透明開始淡入
        expect(getByTestId('x').style.opacity).toBe('0')
    })
})
