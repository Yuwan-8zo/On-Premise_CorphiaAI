/**
 * swallowNextClick — 吃掉「同一次按壓」放開後瀏覽器自己送出的那一下 click。
 *
 * 什麼時候要用：元件在手指放開（pointerup）或按下（pointerdown）時就已經做完動作，而這個動作會讓畫面換掉
 * （切頁、開對話框、關選單）。瀏覽器稍後還會在同一個位置送出 click，這時手指底下已經是新的東西，
 * 就會被誤按——例如手機設定點「語言」切到語言頁後，同一下又點到「日本語」。
 *
 * 共用的地方：點外面關閉選單（useDismiss）、玻璃分段切換器／直向導覽／右上選單／選單放大鏡放開時。
 * 鍵盤操作不經過這裡（Enter／空白鍵不產生指標事件）。
 */

/** 同一次按壓放開時產生的 click 最晚多久會到（行動裝置可能延遲約 300ms）；超過就不攔，不會吃到使用者下一次真正的點擊 */
const SAME_PRESS_MS = 450

export function swallowNextClick() {
    const stop = (e: Event) => {
        e.preventDefault()
        e.stopPropagation()
        cleanup()
    }
    const timer = setTimeout(() => cleanup(), SAME_PRESS_MS)
    const cleanup = () => {
        clearTimeout(timer)
        document.removeEventListener('click', stop, true)
    }
    document.addEventListener('click', stop, true)
}
