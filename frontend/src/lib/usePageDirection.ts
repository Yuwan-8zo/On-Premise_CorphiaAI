import { useRef } from 'react'

/**
 * 換頁方向（規範：方向照順序）：這次的位置比上一次後面 → 'fwd'（新頁從右邊進來），前面 → 'back'（從左邊進來）。
 * 搭配 motion.css 的 .page-in：<div key={頁} className="page-in" data-dir={dir}>
 *
 * 方向只在「位置真的變了」那一次決定，之後重新繪製（例如資料輪詢）都沿用同一個方向，
 * 不然動畫播到一半方向會被改掉。
 */
export function usePageDirection(index: number): 'fwd' | 'back' {
    const prev = useRef(index)
    const dir = useRef<'fwd' | 'back'>('fwd')
    if (index !== prev.current) {
        dir.current = index < prev.current ? 'back' : 'fwd'
        prev.current = index
    }
    return dir.current
}
