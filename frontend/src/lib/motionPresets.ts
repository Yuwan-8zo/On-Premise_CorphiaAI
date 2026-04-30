/**
 * Motion Presets — Apple 風格的彈性動畫常數
 * ==========================================================
 *
 * 任何地方用到 framer-motion 的 transition，都從這個檔 import 取用一致的物理參數。
 * 避免每個地方各寫一組 stiffness / damping，整個 App 的動感才會一致。
 *
 *   import { spring, springSnappy, springGentle } from '@/lib/motionPresets'
 *   <motion.div animate={...} transition={spring} />
 */

/**
 * 主要 spring：日常 UI 元件的進出場、tab 切換、Drawer 滑入滑出。
 * stiffness 200 / damping 25 —— 有微微彈性回饋，但不會 wobble。
 */
export const spring = {
    type: 'spring' as const,
    stiffness: 200,
    damping: 25,
    mass: 1,
}

/**
 * 較硬的 spring：小元件 (按鈕、icon) 的快速響應。
 * stiffness 380 / damping 30 —— 接近 iOS 系統「按下去」的回彈。
 */
export const springSnappy = {
    type: 'spring' as const,
    stiffness: 380,
    damping: 30,
    mass: 0.9,
}

/**
 * 柔和 spring：頁面切換、modal 進場，不要太過搶戲。
 * stiffness 120 / damping 22 —— 略帶慢動作的 ease-out 感。
 */
export const springGentle = {
    type: 'spring' as const,
    stiffness: 120,
    damping: 22,
    mass: 1,
}

/**
 * 標準淡入淡出 (沒有位移)：只用於 backdrop / overlay 的 opacity 動畫。
 * 因為 spring 對純 opacity 沒意義，這裡用 tween。
 */
export const fade = {
    type: 'tween' as const,
    duration: 0.18,
    ease: [0.4, 0, 0.2, 1] as const,
}
