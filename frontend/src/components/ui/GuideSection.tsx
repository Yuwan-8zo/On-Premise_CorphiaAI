import { Sparkles } from 'lucide-react'
import { motion } from '@/lib/gsapMotion'
import { useTranslation } from 'react-i18next'

import { resetOnboarding } from '@/components/onboarding/OnboardingTour'
import { useUIStore } from '@/store/uiStore'

export default function GuideSection() {
    const { t } = useTranslation()
    const triggerOnboardingReplay = useUIStore((s) => s.triggerOnboardingReplay)
    const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)

    function handleReplayOnboarding() {
        // 清旗標 + 觸發 replay token，並關掉 settings modal 讓 chat 看得到 tour
        resetOnboarding()
        setSettingsOpen(false)
        // 等 modal 關閉動畫，再觸發（Tour 顯示在 ChatPage）
        setTimeout(() => triggerOnboardingReplay(), 200)
    }

    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    }

    const itemVariants = {
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0 }
    }

    return (
        <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-6 pb-8"
        >
            <div>
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h3 className="text-xl font-bold text-text-primary mb-2 tracking-tight">{t('guide.title')}</h3>
                        <p className="text-text-secondary text-sm">
                            {t('guide.subtitle')}
                        </p>
                    </div>
                    {/* 重新觀看引導按鈕 —— 隨時可以重看一次 onboarding tour */}
                    <button
                        type="button"
                        onClick={handleReplayOnboarding}
                        className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 text-[12px] font-medium text-accent hover:bg-accent/20 transition"
                        title={t('settings.replayTourHint', '重新顯示首次使用引導')}
                    >
                        <Sparkles className="h-3.5 w-3.5" />
                        {t('settings.replayTour', '重新觀看引導')}
                    </button>
                </div>
            </div>

            {/* 一、權限管理與角色 */}
            <motion.section variants={itemVariants} className="space-y-3">
                <h4 className="text-[16px] font-semibold flex items-center gap-2 text-text-primary">
                    <span className="p-1 bg-accent text-corphia-bronze rounded-md">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                    </span>
                    {t('guide.auth.title')}
                </h4>
                <div className="bg-bg-base border border-border-subtle rounded-cv-lg p-4 text-[14px]">
                    <ul className="space-y-4">
                        <li className="flex flex-col sm:flex-row sm:gap-3 gap-1">
                            <span className="w-auto sm:w-20 font-medium text-text-primary shrink-0">Engineer</span>
                            <span className="text-text-secondary">{t('guide.auth.engineer')}</span>
                        </li>
                        <li className="border-t border-border-subtle pt-3 flex flex-col sm:flex-row sm:gap-3 gap-1">
                            <span className="w-auto sm:w-20 font-medium text-text-primary shrink-0">Admin</span>
                            <span className="text-text-secondary">{t('guide.auth.admin')}</span>
                        </li>
                        <li className="border-t border-border-subtle pt-3 flex flex-col sm:flex-row sm:gap-3 gap-1">
                            <span className="w-auto sm:w-20 font-medium text-text-primary shrink-0">User</span>
                            <span className="text-text-secondary">{t('guide.auth.user')}</span>
                        </li>
                    </ul>
                </div>
            </motion.section>

            {/* 二、專案模式與知識庫 */}
            <motion.section variants={itemVariants} className="space-y-3">
                <h4 className="text-[16px] font-semibold flex items-center gap-2 text-text-primary">
                    <span className="p-1 bg-green-100 text-green-600 rounded-md">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                    </span>
                    {t('guide.project.title')}
                </h4>
                <div className="bg-bg-base border border-border-subtle rounded-cv-lg p-5 text-[14px] space-y-3 text-text-secondary leading-relaxed">
                    <p>{t('guide.project.descStart')} <strong className="text-text-primary">{t('guide.project.mode')}</strong>{t('guide.project.descEnd')}</p>
                    <ol className="list-decimal pl-5 space-y-2">
                        <li>{t('guide.project.step1')}</li>
                        <li>{t('guide.project.step2Start')} <strong className="text-text-primary">{t('guide.project.step2Types')}</strong> {t('guide.project.step2End')}</li>
                        <li>{t('guide.project.step3')}</li>
                        <li>{t('guide.project.step4')}</li>
                    </ol>
                </div>
            </motion.section>

            {/* 三、對話與介面操作技巧 */}
            <motion.section variants={itemVariants} className="space-y-3">
                <h4 className="text-[16px] font-semibold flex items-center gap-2 text-text-primary">
                    <span className="p-1 bg-bg-surface text-text-secondary rounded-md">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                        </svg>
                    </span>
                    {t('guide.chat.title')}
                </h4>
                <div className="bg-bg-base border border-border-subtle rounded-cv-lg p-5 text-[14px] space-y-3 text-text-secondary leading-relaxed">
                    <ul className="list-disc pl-5 space-y-3">
                        <li>
                            <strong className="text-text-primary font-medium block mb-1">{t('guide.chat.minimapTitle')}</strong>
                            {t('guide.chat.minimapDescStart')}<strong className="text-corphia-bronze">{t('guide.chat.minimapDescHighlight')}</strong> {t('guide.chat.minimapDescEnd')}
                        </li>
                        <li>
                            <strong className="text-text-primary font-medium block mb-1">{t('guide.chat.scrollBottomTitle')}</strong>
                            {t('guide.chat.scrollBottomDesc')}
                        </li>
                        <li>
                            <strong className="text-text-primary font-medium block mb-1">{t('guide.chat.renameTitle')}</strong>
                            {t('guide.chat.renameDesc')}
                        </li>
                    </ul>
                </div>
            </motion.section>

        </motion.div>
    )
}
