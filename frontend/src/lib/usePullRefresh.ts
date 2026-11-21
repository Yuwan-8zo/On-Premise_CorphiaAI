/**
 * 下拉重新整理（手機清單）：清單已經在最上面時，手指往下拉＝拉出一段空間，放開超過門檻就重新載入
 *
 *   拉的距離有阻力（手指移動的 PULL_DAMP 倍），最多 PULL_MAX；超過 PULL_TRIGGER 放開才算數
 *   載入中停在 PULL_HOLD 的高度，載完收回
 *   用觸控事件（不是指標事件）：清單本身可以捲，指標事件一開始捲動就會被瀏覽器取消；
 *   在頂端往下拉時才擋掉瀏覽器自己的回彈
 *
 *   const pull = usePullRefresh(enabled, refresh)   // refresh 回傳 Promise
 *   <Indicator distance={pull.distance} state={pull.state} />  <div ref={pull.ref} className="overflow-y-auto">…</div>
 */
import { useCallback, useRef, useState } from 'react'

export const PULL_TRIGGER = 64
export const PULL_MAX = 96
export const PULL_HOLD = 56
const PULL_DAMP = 0.5

export type PullState = 'idle' | 'pulling' | 'ready' | 'refreshing'

export function usePullRefresh(enabled: boolean, onRefresh: () => Promise<unknown>) {
    const [distance, setDistance] = useState(0)
    const [state, setState] = useState<PullState>('idle')
    const live = useRef({ enabled, onRefresh, state })
    live.current = { enabled, onRefresh, state }
    const cleanup = useRef<(() => void) | null>(null)

    const ref = useCallback((el: HTMLElement | null) => {
        cleanup.current?.()
        cleanup.current = null
        if (!el) return
        let startY: number | null = null
        let d = 0
        const start = (e: TouchEvent) => {
            if (!live.current.enabled || live.current.state === 'refreshing' || el.scrollTop > 0 || e.touches.length > 1) return
            startY = e.touches[0].clientY
        }
        const move = (e: TouchEvent) => {
            if (startY === null) return
            const dy = e.touches[0].clientY - startY
            if (dy <= 0 || el.scrollTop > 0) {
                if (d) { d = 0; setDistance(0); setState('idle') }
                return
            }
            e.preventDefault()
            d = Math.min(PULL_MAX, dy * PULL_DAMP)
            setDistance(d)
            setState(d >= PULL_TRIGGER ? 'ready' : 'pulling')
        }
        const end = () => {
            if (startY === null) return
            startY = null
            if (d < PULL_TRIGGER) { d = 0; setDistance(0); setState('idle'); return }
            d = 0
            setDistance(PULL_HOLD)
            setState('refreshing')
            void Promise.resolve(live.current.onRefresh()).catch(() => undefined).finally(() => {
                setDistance(0)
                setState('idle')
            })
        }
        el.addEventListener('touchstart', start, { passive: true })
        el.addEventListener('touchmove', move, { passive: false })
        el.addEventListener('touchend', end)
        el.addEventListener('touchcancel', end)
        cleanup.current = () => {
            el.removeEventListener('touchstart', start)
            el.removeEventListener('touchmove', move)
            el.removeEventListener('touchend', end)
            el.removeEventListener('touchcancel', end)
        }
    }, [])
    return { ref, distance, state }
}
