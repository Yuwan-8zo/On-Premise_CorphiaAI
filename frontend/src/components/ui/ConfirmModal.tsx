import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUIStore } from '../../store/uiStore'
import DialogShell from './DialogShell'

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
        // Apple 對話框：兩顆等寬膠囊按鈕；外框圓角 ＝ 按鈕圓角 ＋ 內距（同心）
        <DialogShell
            open={!!confirmConfig}
            onClose={closeConfirm}
            dismissible={!isProcessing}
            role="alertdialog"
            className="w-full max-w-[var(--sz-360)]"
        >
            {confirmConfig && (
                <>
                    <h3 className="dialog-title whitespace-pre-wrap">{confirmConfig.message}</h3>
                    <p className="dialog-body">{confirmConfig.hint ?? t('common.confirmHint', '此動作無法復原。')}</p>
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
                </>
            )}
        </DialogShell>
    )
}
