import React, { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
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
                    transition={{ duration: 0.15 }}
                    className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md"
                />
            )}
            {confirmConfig && (
                <motion.div
                    key="confirm-modal"
                    initial={{ scale: 0.95, opacity: 0, y: 10 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 10 }}
                    transition={{ type:"spring", stiffness: 400, damping: 30 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                >
                    <div 
                        className="bg-bg-base rounded-cv-xl w-full max-w-sm shadow-xl overflow-hidden border border-border-subtle pointer-events-auto"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-6">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                                    <AlertTriangle className="w-5 h-5 text-red-600" />
                                </div>
                                <h3 className="text-xl font-medium text-text-primary">
                                    Corphia AI
                                </h3>
                            </div>
                            
                            <p className="text-text-secondary whitespace-pre-wrap">
                                {confirmConfig.message}
                            </p>
                        </div>
                        
                        <div className="p-4 bg-bg-surface flex justify-end gap-3 border-t border-border-subtle">
                            <button
                                onClick={closeConfirm}
                                disabled={isProcessing}
                                className="px-5 py-2.5 rounded-full text-sm font-medium text-text-secondary hover:bg-bg-elevated transition-colors disabled:opacity-50"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={isProcessing}
                                className="px-5 py-2.5 rounded-full text-sm font-medium text-text-primary bg-red-600 hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {isProcessing && (
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
