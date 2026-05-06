/**
 * BackendBootSplash — 後端啟動中的 splash screen
 * ===================================================
 *
 * 桌面 app 雙擊啟動時，Tauri 視窗會「秒開」，但後端 sidecar 要載 GGUF 模型
 * 通常要 10~30 秒才 ready。這段時間使用者看到登入頁但點下去都失敗很沒安全感。
 *
 * 這個 splash 在 backend health 沒回 200 之前蓋掉所有路由，顯示：
 *   - Corphia logo
 *   - 旋轉的 loading 指示器
 *   - 動態訊息（每幾秒輪播 "正在啟動服務..." → "正在載入模型..."）
 *   - 30 秒後若還沒 ready，顯示錯誤 + 重試按鈕
 *
 * 使用方式：
 *   <BackendGate>
 *     <App />     ← 只有 backend ready 才會渲染
 *   </BackendGate>
 */

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from '@/lib/gsapMotion'
// 同時載入兩個版本，依當前主題（dark / light）切換顯示，
// 避免「深色 C 在深色背景看不到」這種對比失敗
import CorphiaLogoForLight from '@/assets/Corphia_Icon_Light.png' // 深色 C（用在淺色背景）
import CorphiaLogoForDark from '@/assets/Corphia_Icon_Dark.png'   // 白色 C（用在深色背景）

/** 輪播文字 — 給使用者「事情有在進行」的感受，避免覺得當掉 */
const STATUS_MESSAGES = [
    '正在啟動服務…',
    '正在載入 AI 模型…',
    '正在連接資料庫…',
    '即將就緒…',
]

/** 健康檢查 endpoint。Vite proxy 會自動轉到 backend */
const HEALTH_URL = '/api/v1/health'

/** 重試的「視為失敗」門檻 — 30 秒沒 ready 就顯示錯誤頁 */
const TIMEOUT_MS = 30_000

/** 輪詢間隔 */
const POLL_INTERVAL_MS = 1500

interface BackendBootSplashProps {
    /** 後端 ready 時觸發 */
    onReady: () => void
}

export default function BackendBootSplash({ onReady }: BackendBootSplashProps) {
    const [statusIdx, setStatusIdx] = useState(0)
    const [isTimeout, setIsTimeout] = useState(false)
    const [retryCount, setRetryCount] = useState(0)
    const startTimeRef = useRef(Date.now())

    // 輪播狀態文字（每 2.5 秒換一句）
    useEffect(() => {
        const id = setInterval(() => {
            setStatusIdx((i) => (i + 1) % STATUS_MESSAGES.length)
        }, 2500)
        return () => clearInterval(id)
    }, [])

    // 輪詢 health endpoint
    useEffect(() => {
        let cancelled = false
        let timer: ReturnType<typeof setTimeout>

        const check = async () => {
            if (cancelled) return

            // 超過 timeout → 顯示錯誤頁
            if (Date.now() - startTimeRef.current > TIMEOUT_MS) {
                setIsTimeout(true)
                return
            }

            try {
                const res = await fetch(HEALTH_URL, {
                    method: 'GET',
                    // 不要快取
                    cache: 'no-store',
                    // 短超時，避免某次卡住延遲下次嘗試
                    signal: AbortSignal.timeout(2000),
                })
                if (res.ok && !cancelled) {
                    onReady()
                    return
                }
            } catch {
                // ignore — 下次再試
            }

            timer = setTimeout(check, POLL_INTERVAL_MS)
        }

        check()
        return () => {
            cancelled = true
            if (timer) clearTimeout(timer)
        }
        // retryCount 改變時重新跑（使用者按重試）
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [retryCount])

    const handleRetry = () => {
        startTimeRef.current = Date.now()
        setIsTimeout(false)
        setRetryCount((c) => c + 1)
    }

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-bg-base">
            {/* 弧線背景：呼應主畫面風格 */}
            <div
                className="absolute inset-0 pointer-events-none opacity-50"
                style={{
                    background:
                        'radial-gradient(ellipse 800px 400px at 50% 30%, rgba(180, 148, 102, 0.08), transparent 70%)',
                }}
            />

            <div className="relative z-10 flex flex-col items-center gap-8 px-8 max-w-md text-center">
                {/* Logo（用 motion.div 包，因為自製 motion 沒有 motion.img）
                    主題切換：跟 CorphiaWordmark 一樣用 dark:hidden / hidden dark:block 的兩張圖法，
                    比 useUIStore 訂閱主題狀態更輕量（splash 早期 zustand 可能還沒 hydrate） */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                >
                    {/* 淺色模式：深色 C */}
                    <img
                        src={CorphiaLogoForLight}
                        alt="Corphia AI"
                        className="w-24 h-24 select-none dark:hidden"
                        draggable={false}
                    />
                    {/* 深色模式：白色 C */}
                    <img
                        src={CorphiaLogoForDark}
                        alt="Corphia AI"
                        className="w-24 h-24 select-none hidden dark:block"
                        draggable={false}
                    />
                </motion.div>

                {/* 標題 */}
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
                        Corphia AI
                    </h1>
                    <p className="text-sm text-text-muted">
                        Enterprise Knowledge Engine
                    </p>
                </div>

                {/* 動態狀態 — timeout 之前顯示 */}
                {!isTimeout && (
                    <div className="flex flex-col items-center gap-4">
                        {/* 旋轉指示器 */}
                        <div className="w-10 h-10 rounded-full border-[3px] border-accent/15 border-t-accent animate-spin" />

                        {/* 輪播文字 */}
                        <AnimatePresence mode="wait">
                            <motion.p
                                key={statusIdx}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.3 }}
                                className="text-sm text-text-secondary"
                            >
                                {STATUS_MESSAGES[statusIdx]}
                            </motion.p>
                        </AnimatePresence>
                    </div>
                )}

                {/* Timeout 錯誤狀態 */}
                {isTimeout && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col items-center gap-4"
                    >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M12 9v4M12 17h.01" />
                                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            </svg>
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm font-medium text-text-primary">
                                後端服務啟動逾時
                            </p>
                            <p className="text-xs text-text-secondary leading-relaxed">
                                可能原因：
                                <br />
                                • 後端正在載入大型 AI 模型，請再等待
                                <br />
                                • 後端尚未啟動（請確認後端服務有跑起來）
                                <br />
                                • PostgreSQL 沒開
                            </p>
                        </div>
                        <button
                            onClick={handleRetry}
                            className="rounded-cv-md bg-accent px-4 py-2 text-sm font-medium text-text-on-accent hover:bg-accent/90 transition"
                        >
                            重試
                        </button>
                    </motion.div>
                )}

                {/* 底部小字：版本 / 提示 */}
                <p className="text-[11px] text-text-muted/70 mt-4">
                    地端部署 · 資料 100% 留在本機
                </p>
            </div>
        </div>
    )
}
