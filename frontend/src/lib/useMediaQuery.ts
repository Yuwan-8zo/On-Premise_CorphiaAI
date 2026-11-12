/**
 * useMediaQuery — 共用的「這個媒體查詢現在成立嗎」，畫面大小改變時自動更新。各元件不要自己掛 matchMedia。
 *
 *   const desktop = useMediaQuery(MQ_DESKTOP)
 */
import { useSyncExternalStore } from 'react'

/** 和 Tailwind 的 md 斷點同一個寬度（tailwind.config 的預設 md＝768px）：以上是桌機版面（側欄固定在左邊） */
export const MQ_DESKTOP = '(min-width: 768px)'

/** 有滑鼠（能懸停、指得準）的裝置。手機、平板、折疊手機都不算：那些裝置沒有「停在上面」這回事 */
export const MQ_HOVER = '(hover: hover) and (pointer: fine)'

/** 不在 React 元件裡（事件處理、store 初始值）時用：現在是不是桌機版面 */
export const isDesktop = () => typeof window !== 'undefined' && window.matchMedia(MQ_DESKTOP).matches

export function useMediaQuery(query: string): boolean {
    return useSyncExternalStore(
        (onChange) => {
            const mq = window.matchMedia(query)
            mq.addEventListener('change', onChange)
            return () => mq.removeEventListener('change', onChange)
        },
        () => window.matchMedia(query).matches,
        () => false,
    )
}
