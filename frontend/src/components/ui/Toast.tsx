/**
 * Toast 通知元件
 * 固定於右上角，支援 success / error / info 三種樣式
 */
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, X, Info } from 'lucide-react'
import { useToastStore, type Toast } from '../../store/toastStore'

const icons = {
    success: <Check className="w-4 h-4 text-emerald-500" />,
    error: <X className="w-4 h-4 text-red-500" />,
    info: <Info className="w-4 h-4 text-[rgb(var(--color-ios-accent-light))] dark:text-[rgb(var(--color-ios-accent-dark))]" />,
}

const borderColors = {
    success: 'border-emerald-500/30',
    error: 'border-red-500/30',
    info: 'border-[rgb(var(--color-ios-accent-light)/0.3)] dark:border-[rgb(var(--color-ios-accent-dark)/0.3)]',
}

function ToastItem({ toast }: { toast: Toast }) {
    const { remove } = useToastStore()
    const [progress, setProgress] = useState(100)

    // 進度條動畫
    useEffect(() => {
        const interval = setInterval(() => {
            setProgress((p) => Math.max(0, p - 100 / 30))
        }, 100)
        return () => clearInterval(interval)
    }, [])

    return (
        <motion.div
            initial={{ opacity: 0, x: 60, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            onClick={() => remove(toast.id)}
            className={`relative overflow-hidden flex items-start gap-3 min-w-[260px] max-w-[360px] px-4 py-3.5 rounded-[16px] cursor-pointer
                bg-white/90 dark:bg-ios-dark-gray4/90 backdrop-blur-xl
                border ${borderColors[toast.type]}
                shadow-[0_4px_24px_rgba(0,0,0,0.12)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)]`}
        >
            <span className="shrink-0 mt-0.5">{icons[toast.type]}</span>
            <p className="text-[14px] leading-snug text-gray-800 dark:text-gray-100 flex-1 pr-1">
                {toast.message}
            </p>
            <button onClick={() => remove(toast.id)} className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                <X className="w-3.5 h-3.5" />
            </button>
            {/* 底部進度條 */}
            <div
                className="absolute bottom-0 left-0 h-[2px] bg-current opacity-20 transition-none"
                style={{ width: `${progress}%`, color: toast.type === 'error' ? 'rgb(239,68,68)' : toast.type === 'success' ? 'rgb(16,185,129)' : 'rgb(var(--color-ios-accent-light))' }}
            />
        </motion.div>
    )
}

export function ToastContainer() {
    const { toasts } = useToastStore()

    return (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 items-end pointer-events-none">
            <AnimatePresence mode="popLayout">
                {toasts.map((toast) => (
                    <div key={toast.id} className="pointer-events-auto">
                        <ToastItem toast={toast} />
                    </div>
                ))}
            </AnimatePresence>
        </div>
    )
}

export default ToastContainer
