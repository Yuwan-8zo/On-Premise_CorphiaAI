/**
 * 全域通知（《Liquid Glass 元件規範》HTML 10 / CSS：.toast）
 *   畫面頂端置中、離上 26；玻璃膠囊＋光邊（.glass-chip）、內距 13 × 22、文字 13／18 粗體、主要文字色
 *   沒有圖示、沒有關閉鈕；出現與消失不影響版面、不擋點擊（role="status"，報讀軟體會唸出來）
 *   同一時間一則、顯示 2 秒（toastStore）；進場：從上方 20px、縮小 0.96 滑進來＋淡入，0.23 秒減速；退場反向播放
 *   「減少動態效果」時只淡入淡出
 */
import { useToastStore } from '../../store/toastStore'

export function ToastContainer() {
    const { toasts } = useToastStore()

    return (
        <div className="toast-stack" aria-live="polite">
            {toasts.map((toast) => (
                <div key={toast.id} role="status" className={`toast-pill glass-chip ${toast.leaving ? 'is-leaving' : ''}`}>
                    {toast.message}
                </div>
            ))}
        </div>
    )
}

export default ToastContainer
