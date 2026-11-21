/**
 * 下拉重新整理（手機清單）：清單已經在最上面時，手指往下拉＝拉出一段空間，放開超過門檻就重新載入
 *
 *   拉的距離有阻力（手指移動的 --pull-damp 倍），最多 --pull-max；超過 --pull-trigger 放開才算數
 *   載入中停在 --pull-hold 的高度，載完收回（數值都在 styles/tokens.css，開始拉的時候讀一次）
 *   用觸控事件（不是指標事件）：清單本身可以捲，指標事件一開始捲動就會被瀏覽器取消；
 *   在頂端往下拉時才擋掉瀏覽器自己的回彈
 *
 *   const pull = usePullRefresh(enabled, refresh)   // refresh 回傳 Promise
 *   <Indicator distance={pull.distance} state={pull.state} />  <div ref={pull.ref} className="overflow-y-auto">…</div>
 */
import { useCallback, useRef, useState } from 'react'
import { readNum, readPx } from '@/lib/cssVars'

/** 下拉的距離設定（像素；從樣式設定讀，不寫死） */
export function pullConfig() {
    return { trigger: readPx('--pull-trigger'), max: readPx('--pull-max'), hold: readPx('--pull-hold'), damp: readNum('--pull-damp') }
}

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
        let cfg = pullConfig()
        const start = (e: TouchEvent) => {
            if (!live.current.enabled || live.current.state === 'refreshing' || el.scrollTop > 0 || e.touches.length > 1) return
            startY = e.touches[0].clientY
            cfg = pullConfig()
        }
        const move = (e: TouchEvent) => {
            if (startY === null) return
            const dy = e.touches[0].clientY - startY
            if (dy <= 0 || el.scrollTop > 0) {
                if (d) { d = 0; setDistance(0); setState('idle') }
                return
            }
            e.preventDefault()
            d = Math.min(cfg.max, dy * cfg.damp)
            setDistance(d)
            setState(d >= cfg.trigger ? 'ready' : 'pulling')
        }
        const end = () => {
            if (startY === null) return
            startY = null
            if (d < cfg.trigger) { d = 0; setDistance(0); setState('idle'); return }
            d = 0
            setDistance(cfg.hold)
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
