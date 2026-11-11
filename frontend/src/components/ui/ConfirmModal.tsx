import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUIStore } from '../../store/uiStore'
import { motion, AnimatePresence } from '@/lib/gsapMotion'

export const ConfirmModal: React.FC = () => {
    const { t } = useTranslation()
    const { confirmConfig, closeConfirm } = useUIStore()
    const [isProcessing, setIsProcessing] = useState(false)

    const handleConfirm = async () => {
        if (!confirmConfig) return
        try {
            setIsProcessing(true)
            await confirmConfig.onConfirm()
        } finally {
            setIsProcessing(false)
            closeConfirm()
        }
    }

    return (
        <AnimatePresence>
            {confirmConfig && (
                <motion.div
                    key="confirm-backdrop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="fixed inset-0 z-50 bg-black/20 dark:bg-black/45 backdrop-blur-md"
                />
            )}
            {confirmConfig && (
                <motion.div
                    key="confirm-modal"
                    initial={{ scale: 0.94, opacity: 0, y: 12 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.96, opacity: 0, y: 6 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                >
                    {/* Apple 對話框：兩顆等寬膠囊按鈕；外框圓角 ＝ 按鈕圓角 ＋ 內距（同心） */}
                    <div
                        role="alertdialog"
                        aria-modal="true"
                        className="dialog-sheet w-full max-w-[var(--sz-360)] pointer-events-auto"
                        onClick={e => e.stopPropagation()}
                    >
                        <h3 className="dialog-title whitespace-pre-wrap">{confirmConfig.message}</h3>
                        <p className="dialog-body">{t('common.confirmHint', '此動作無法復原。')}</p>
                        <div className="dialog-actions">
                            <button onClick={closeConfirm} disabled={isProcessing} className="btn btn-lg btn-secondary">
                                {t('common.cancel')}
                            </button>
                            <button onClick={handleConfirm} disabled={isProcessing} className="btn btn-lg btn-danger-solid">
                                {isProcessing && (
                                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                    </svg>
                                )}
                                {t('common.confirm')}
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
