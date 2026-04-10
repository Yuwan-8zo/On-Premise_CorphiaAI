/**
 * Toast 通知元件
 * 
 * 顯示全域通知訊息
 */

import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

import { useUIStore } from '@/store/uiStore'
import { cn } from '@/lib/utils'

export function Toaster() {
    const { toasts, hideToast } = useUIStore()

    return (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm pointer-events-none">
            <AnimatePresence>
                {toasts.map((toast) => (
                    <motion.div
                        key={toast.id}
                        initial={{ opacity: 0, y: -20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                        layout
                        className="pointer-events-auto"
                    >
                        <div
                            className={cn(
                                "flex items-start gap-3 p-4 rounded-lg shadow-lg border backdrop-blur-sm",
                                "bg-white/90 dark:bg-slate-800/90",
                                {
                                    'border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-900/20': toast.type === 'success',
                                    'border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/20': toast.type === 'error',
                                    'border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-900/20': toast.type === 'info',
                                    'border-yellow-200 bg-yellow-50 dark:border-yellow-900/50 dark:bg-yellow-900/20': toast.type === 'warning',
                                }
                            )}
                        >
                            {/* 圖示 */}
                            <div className="flex-shrink-0 mt-0.5">
                                {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-green-500" />}
                                {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                                {toast.type === 'info' && <Info className="w-5 h-5 text-blue-500" />}
                                {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-yellow-500" />}
                            </div>

                            {/* 訊息 */}
                            <p className="flex-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                                {toast.message}
                            </p>

                            {/* 關閉按鈕 */}
                            <button
                                onClick={() => hideToast(toast.id)}
                                className="flex-shrink-0 text-slate-400 hover:text-slate-500 dark:hover:text-slate-300 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    )
}
