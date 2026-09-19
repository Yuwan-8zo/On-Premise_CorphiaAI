/**
 * Demo — 右下角重設展示按鈕
 */
import { useState } from 'react'

export default function DemoResetButton() {
    const [confirming, setConfirming] = useState(false)

    const handleClick = () => {
        if (confirming) {
            // 清除所有 zustand persist 資料，回到首頁
            localStorage.removeItem('auth-storage')
            localStorage.removeItem('ui-storage')
            window.location.href = '/'
        } else {
            setConfirming(true)
            setTimeout(() => setConfirming(false), 3000)
        }
    }

    return (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-2">
            {/* Demo 標籤 */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/90 text-white text-[11px] font-semibold shadow-lg backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                DEMO MODE
            </div>

            {/* 重設按鈕 */}
            <button
                onClick={handleClick}
                title="重設展示（回到初始狀態）"
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg font-medium text-[13px] transition-all active:scale-95 ${
                    confirming
                        ? 'bg-red-500 text-white animate-pulse'
                        : 'bg-bg-base border border-border-subtle text-text-secondary hover:text-text-primary hover:border-amber-400/60 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                }`}
            >
                <svg
                    className={`w-4 h-4 ${confirming ? '' : 'text-amber-500'}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {confirming ? '確認重設？' : '⟳ 重設展示'}
            </button>
        </div>
    )
}
