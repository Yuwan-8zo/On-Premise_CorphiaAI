/**
 * DialogShell — 所有對話框共用的外殼：遮罩、置中、進出動畫、Esc 關閉、放到 body 最上層。
 * 動畫參數集中在 lib/motionPresets（dialogBackdrop／dialogSheet），各對話框不要自己寫。
 *
 *   <DialogShell open={open} onClose={close} className="w-full max-w-[var(--sz-360)]">
 *       ...內容...
 *   </DialogShell>
 */
import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { AnimatePresence, motion } from '@/lib/gsapMotion'
import { dialogBackdrop, dialogSheet } from '@/lib/motionPresets'

export interface DialogShellProps {
    open: boolean
    onClose?: () => void
    children: ReactNode
    /** 本體的寬度等樣式（預設外觀是 dialog-sheet） */
    className?: string
    /** 不用 dialog-sheet 外觀時傳 false（例如後台卡片樣式自己給） */
    sheet?: boolean
    /** 層級：一般 z-50；疊在其他視窗上面的（例如設定裡的修改密碼）用更高的 */
    layer?: string
    role?: 'dialog' | 'alertdialog'
    labelledBy?: string
    /** 點遮罩是否關閉（處理中時可以關掉） */
    dismissible?: boolean
}

export default function DialogShell({
    open,
    onClose,
    children,
    className = '',
    sheet = true,
    layer = 'z-50',
    role = 'dialog',
    labelledBy,
    dismissible = true,
}: DialogShellProps) {
    // Esc 關閉
    useEffect(() => {
        if (!open || !onClose || !dismissible) return
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open, onClose, dismissible])

    return createPortal(
        <AnimatePresence>
            {open && (
                <motion.div
                    key="dialog-backdrop"
                    {...dialogBackdrop}
                    className={`fixed inset-0 ${layer} bg-black/20 dark:bg-black/45 backdrop-blur-md`}
                    onClick={dismissible ? onClose : undefined}
                />
            )}
            {open && (
                <motion.div
                    key="dialog-sheet"
                    {...dialogSheet}
                    className={`fixed inset-0 ${layer} flex items-center justify-center p-4 pointer-events-none`}
                >
                    <div
                        role={role}
                        aria-modal="true"
                        aria-labelledby={labelledBy}
                        className={`relative ${sheet ? 'dialog-sheet' : ''} pointer-events-auto ${className}`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {children}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body,
    )
}
