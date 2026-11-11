/**
 * 「忘記密碼？」說明彈窗：地端系統不寄信，重設密碼要請管理員處理
 */
import { useTranslation } from 'react-i18next'
import { HelpCircle, X } from '@/components/snow/icons'
import { motion, AnimatePresence } from '@/lib/gsapMotion'

export default function ContactAdminDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { t } = useTranslation()
    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div
                        key="reset-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-50 bg-black/20 dark:bg-black/45 backdrop-blur-sm"
                        onClick={onClose}
                    />
                    <motion.div
                        key="reset-card"
                        initial={{ opacity: 0, scale: 0.92, y: 16 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 8 }}
                        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                    >
                        <div role="dialog" aria-modal="true" aria-labelledby="reset-modal-title" className="pointer-events-auto w-full max-w-sm dialog-sheet relative">
                            <button type="button" onClick={onClose} className="btn-icon dialog-close absolute text-text-secondary" aria-label={t('common.close', '關閉')}>
                                <X className="w-4 h-4" />
                            </button>

                            <div className="flex flex-col items-center text-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-accent/10 text-accent flex items-center justify-center">
                                    <HelpCircle className="w-6 h-6" />
                                </div>
                                <h3 id="reset-modal-title" className="text-lg font-semibold text-text-primary">
                                    {t('auth.contactAdminTitle', '無法登入？')}
                                </h3>
                                <p className="text-sm text-text-secondary leading-relaxed">
                                    {t('auth.contactAdminBody', '請聯絡您的企業 IT 管理員協助重設密碼。基於資料主權與離線部署考量，本系統不提供自助式信件重設。')}
                                </p>
                            </div>

                            <button type="button" onClick={onClose} className="btn btn-lg btn-primary btn-block mt-5">
                                {t('common.confirm', '我知道了')}
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
