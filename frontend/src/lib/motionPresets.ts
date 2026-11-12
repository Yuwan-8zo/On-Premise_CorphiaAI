import { MOTION } from '@/design-system'

type SpringPreset = {
    type: 'spring'
    stiffness: number
    damping: number
    mass: number
}

type TweenPreset = {
    type: 'tween'
    duration: number
    ease: readonly [number, number, number, number]
}

function springFromToken(value: { stiffness: number; damping: number; mass: number }): SpringPreset {
    return {
        type: 'spring',
        stiffness: value.stiffness,
        damping: value.damping,
        mass: value.mass,
    }
}

export const spring = springFromToken(MOTION.spring.default)

export const fade: TweenPreset = {
    type: 'tween',
    duration: MOTION.fade.duration,
    ease: MOTION.fade.ease,
}

// ---------------------------------------------------------------------------
// 規範「時間與曲線總表」：只用減速或彈性曲線，不用加速曲線；進場從 0.95 開始
// ---------------------------------------------------------------------------
export const EASE_DECEL: number[] = [0.23, 1, 0.32, 1]
export const EASE_SPRING: number[] = [0.32, 0.72, 0, 1]

/** 對話框：遮罩淡入淡出 */
export const dialogBackdrop = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2, ease: EASE_DECEL },
}

/** 對話框：本體從 0.95 縮放進場（約 0.3 秒，減速曲線），收合時縮回 0.95 */
export const dialogSheet = {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
    transition: { duration: 0.3, ease: EASE_DECEL },
}

/** 彈出：選單、下拉、浮動小按鈕（同對話框本體：從 0.95、0.3 秒減速） */
export const popIn = dialogSheet

/** 小圖示互換（例如顯示／隱藏密碼）：從 0.95 淡入，0.2 秒 */
export const iconSwap = {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
    transition: { duration: 0.2, ease: EASE_DECEL },
}

/** 浮起進場：新訊息、底部輸入列（往上 12、從 0.95、0.42 秒減速） */
export const riseIn = {
    initial: { opacity: 0, y: 12, scale: 0.95 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: 12, scale: 0.95 },
    transition: { duration: 0.42, ease: EASE_DECEL },
}

/** 換頁滑動（給 motion 元件用；CSS 的版本是 motion.css 的 .page-in）：dir 1＝新頁從右邊進來、-1＝從左邊 */
export const pageSlide = (dir: 1 | -1) => ({
    initial: { opacity: 0, x: 14 * dir },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -14 * dir },
    transition: { duration: 0.42, ease: EASE_DECEL },
})
