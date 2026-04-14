import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

export default function GuideSection() {
    const { t } = useTranslation()

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
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">{t('guide.title')}</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                    {t('guide.subtitle')}
                </p>
            </div>

            {/* 一、權限管理與角色 */}
            <motion.section variants={itemVariants} className="space-y-3">
                <h4 className="text-[16px] font-semibold flex items-center gap-2 text-gray-800 dark:text-gray-200">
                    <span className="p-1 bg-ios-blue-light/10 dark:bg-ios-blue-dark/20 text-ios-blue-light dark:text-ios-blue-dark rounded-md">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                    </span>
                    {t('guide.auth.title')}
                </h4>
                <div className="bg-white dark:bg-ios-dark-gray4 border border-gray-200 dark:border-white/5 rounded-[20px] p-4 text-[14px]">
                    <ul className="space-y-4">
                        <li className="flex flex-col sm:flex-row sm:gap-3 gap-1">
                            <span className="w-auto sm:w-20 font-medium text-gray-700 dark:text-gray-300 shrink-0">Engineer</span>
                            <span className="text-gray-600 dark:text-gray-400">{t('guide.auth.engineer')}</span>
                        </li>
                        <li className="border-t border-gray-100 dark:border-white/5 pt-3 flex flex-col sm:flex-row sm:gap-3 gap-1">
                            <span className="w-auto sm:w-20 font-medium text-gray-700 dark:text-gray-300 shrink-0">Admin</span>
                            <span className="text-gray-600 dark:text-gray-400">{t('guide.auth.admin')}</span>
                        </li>
                        <li className="border-t border-gray-100 dark:border-white/5 pt-3 flex flex-col sm:flex-row sm:gap-3 gap-1">
                            <span className="w-auto sm:w-20 font-medium text-gray-700 dark:text-gray-300 shrink-0">User</span>
                            <span className="text-gray-600 dark:text-gray-400">{t('guide.auth.user')}</span>
                        </li>
                    </ul>
                </div>
            </motion.section>

            {/* 二、專案模式與知識庫 */}
            <motion.section variants={itemVariants} className="space-y-3">
                <h4 className="text-[16px] font-semibold flex items-center gap-2 text-gray-800 dark:text-gray-200">
                    <span className="p-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-md">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                    </span>
                    {t('guide.project.title')}
                </h4>
                <div className="bg-white dark:bg-ios-dark-gray4 border border-gray-200 dark:border-white/5 rounded-[20px] p-5 text-[14px] space-y-3 text-gray-600 dark:text-gray-400 leading-relaxed">
                    <p>{t('guide.project.descStart')} <strong className="text-black dark:text-white">{t('guide.project.mode')}</strong>{t('guide.project.descEnd')}</p>
                    <ol className="list-decimal pl-5 space-y-2">
                        <li>{t('guide.project.step1')}</li>
                        <li>{t('guide.project.step2Start')} <strong className="text-black dark:text-white">{t('guide.project.step2Types')}</strong> {t('guide.project.step2End')}</li>
                        <li>{t('guide.project.step3')}</li>
                        <li>{t('guide.project.step4')}</li>
                    </ol>
                </div>
            </motion.section>

            {/* 三、對話與介面操作技巧 */}
            <motion.section variants={itemVariants} className="space-y-3">
                <h4 className="text-[16px] font-semibold flex items-center gap-2 text-gray-800 dark:text-gray-200">
                    <span className="p-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-md">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                        </svg>
                    </span>
                    {t('guide.chat.title')}
                </h4>
                <div className="bg-white dark:bg-ios-dark-gray4 border border-gray-200 dark:border-white/5 rounded-[20px] p-5 text-[14px] space-y-3 text-gray-600 dark:text-gray-400 leading-relaxed">
                    <ul className="list-disc pl-5 space-y-3">
                        <li>
                            <strong className="text-black dark:text-white font-medium block mb-1">{t('guide.chat.minimapTitle')}</strong>
                            {t('guide.chat.minimapDescStart')}<strong className="text-ios-blue-light dark:text-ios-blue-dark">{t('guide.chat.minimapDescHighlight')}</strong> {t('guide.chat.minimapDescEnd')}
                        </li>
                        <li>
                            <strong className="text-black dark:text-white font-medium block mb-1">{t('guide.chat.scrollBottomTitle')}</strong>
                            {t('guide.chat.scrollBottomDesc')}
                        </li>
                        <li>
                            <strong className="text-black dark:text-white font-medium block mb-1">{t('guide.chat.renameTitle')}</strong>
                            {t('guide.chat.renameDesc')}
                        </li>
                    </ul>
                </div>
            </motion.section>

        </motion.div>
    )
}
