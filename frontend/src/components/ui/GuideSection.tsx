import { Layers3, Pointer, Sparkles, Users } from '@/components/snow/icons'
import { motion } from '@/lib/gsapMotion'
import { useTranslation } from 'react-i18next'

import { resetOnboarding } from '@/components/onboarding/OnboardingTour'
import { useUIStore } from '@/store/uiStore'
import Tooltip from '@/components/ui/Tooltip'

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
                    <Tooltip label={t('settings.replayTourHint', '重新顯示首次使用引導')}>
                        <button
                            type="button"
                            onClick={handleReplayOnboarding}
                            className="btn btn-sm btn-secondary shrink-0 !text-accent"
                        >
                            <Sparkles className="h-3.5 w-3.5" />
                            {t('settings.replayTour', '重新觀看引導')}
                        </button>
                    </Tooltip>
                </div>
            </div>

            {/* 一、權限管理與角色 */}
            <motion.section variants={itemVariants} className="space-y-3">
                <h4 className="text-[16px] font-semibold flex items-center gap-2 text-text-primary">
                    <span className="p-1 bg-accent text-corphia-bronze rounded-md">
                        <Users className="w-5 h-5" />
                    </span>
                    {t('guide.auth.title')}
                </h4>
                <div className="snow-well rounded-[20px] p-4 text-[14px]">
                    <ul className="space-y-4">
                        <li className="flex flex-col sm:flex-row sm:gap-3 gap-1">
                            <span className="w-auto sm:w-20 font-medium text-text-primary shrink-0">Engineer</span>
                            <span className="text-text-secondary">{t('guide.auth.engineer')}</span>
                        </li>
                        <li className="border-t border-[var(--paper-line)] pt-3 flex flex-col sm:flex-row sm:gap-3 gap-1">
                            <span className="w-auto sm:w-20 font-medium text-text-primary shrink-0">Admin</span>
                            <span className="text-text-secondary">{t('guide.auth.admin')}</span>
                        </li>
                        <li className="border-t border-[var(--paper-line)] pt-3 flex flex-col sm:flex-row sm:gap-3 gap-1">
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
                        <Layers3 className="w-5 h-5" />
                    </span>
                    {t('guide.project.title')}
                </h4>
                <div className="snow-well rounded-[20px] p-5 text-[14px] space-y-3 text-text-secondary leading-relaxed">
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
                    <span className="p-1 bg-[var(--chip)] text-text-secondary rounded-md">
                        <Pointer className="w-5 h-5" />
                    </span>
                    {t('guide.chat.title')}
                </h4>
                <div className="snow-well rounded-[20px] p-5 text-[14px] space-y-3 text-text-secondary leading-relaxed">
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
