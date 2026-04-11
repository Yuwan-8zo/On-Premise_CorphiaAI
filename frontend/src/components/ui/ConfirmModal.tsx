import React, { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useUIStore } from '../../store/uiStore'

export const ConfirmModal: React.FC = () => {
    const { t } = useTranslation()
    const { confirmConfig, closeConfirm } = useUIStore()
    const [isProcessing, setIsProcessing] = useState(false)

    if (!confirmConfig) return null

    const handleConfirm = async () => {
        try {
            setIsProcessing(true)
            await confirmConfig.onConfirm()
        } finally {
            setIsProcessing(false)
            closeConfirm()
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-sm shadow-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-200">
                <div className="p-6">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center shrink-0">
                            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                        </div>
                        <h3 className="text-xl font-medium text-zinc-900 dark:text-zinc-100">
                            Corphia AI
                        </h3>
                    </div>
                    
                    <p className="text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                        {confirmConfig.message}
                    </p>
                </div>
                
                <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 flex justify-end gap-3 border-t border-zinc-100 dark:border-zinc-800">
                    <button
                        onClick={closeConfirm}
                        disabled={isProcessing}
                        className="px-5 py-2.5 rounded-full text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isProcessing}
                        className="px-5 py-2.5 rounded-full text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        {isProcessing && (
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        )}
                        {t('common.confirm')}
                    </button>
                </div>
            </div>
        </div>
    )
}
