import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

import { CorphiaLogoSymbol } from '../icons/CorphiaIcons'

export default function AboutSection() {
    const { t } = useTranslation()

    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    }

    const itemVariants = {
        hidden: { opacity: 0, y: 15 },
        show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } }
    }

    const badgeVariants = {
        hidden: { opacity: 0, scale: 0.9 },
        show: { opacity: 1, scale: 1, transition: { type: 'spring' as const, stiffness: 300, damping: 20 } }
    }

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="flex flex-col items-center h-full pt-4 pb-8 px-4 overflow-y-auto custom-scrollbar"
        >
            {/* 懸浮機器人圖標 */}
            <motion.div 
                variants={itemVariants}
                className="relative mb-6"
            >
                <div
                    className="relative z-10 inline-flex items-center justify-center w-28 h-28 rounded-[28px] bg-gradient-to-tr from-ios-blue-dark via-ios-blue-light to-blue-400 border border-white/20"
                >
                    <CorphiaLogoSymbol className="w-16 h-16" />
                </div>
            </motion.div>

            {/* 系統標題 */}
            <motion.div variants={itemVariants} className="text-center mb-6">
                <h3 className="text-[28px] font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 tracking-tight leading-tight mb-2">
                    Corphia AI Platform
                </h3>
                <div className="flex items-center justify-center gap-2">
                    <span className="px-2.5 py-1 text-xs font-semibold bg-gray-100 dark:bg-ios-dark-gray4 text-gray-600 dark:text-gray-300 rounded-lg">
                        {t('about.version')} 2.2.0
                    </span>
                    <span className="px-2.5 py-1 text-xs font-semibold bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400 rounded-lg flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                        {t('about.systemStable')}
                    </span>
                </div>
            </motion.div>

            {/* 描述 */}
            <motion.p variants={itemVariants} className="text-[15px] text-gray-500 dark:text-gray-400 text-center max-w-sm leading-relaxed mb-8">
                {t('about.description')}
            </motion.p>

            {/* 技術棧標籤卡塊 */}
            <motion.div variants={itemVariants} className="w-full bg-gray-50/50 dark:bg-ios-dark-gray6/30 border border-gray-100 dark:border-white/5 rounded-[24px] p-6 backdrop-blur-sm">
                <div className="grid grid-cols-2 gap-y-5 gap-x-4">
                    <motion.div variants={badgeVariants} className="flex flex-col">
                        <span className="text-[12px] font-medium text-gray-400 dark:text-gray-500 mb-1 uppercase tracking-wider">{t('about.frontend')}</span>
                        <span className="text-[15px] font-semibold text-gray-800 dark:text-gray-200">React + FastAPI</span>
                    </motion.div>
                    
                    <motion.div variants={badgeVariants} className="flex flex-col">
                        <span className="text-[12px] font-medium text-gray-400 dark:text-gray-500 mb-1 uppercase tracking-wider">{t('about.inference')}</span>
                        <span className="text-[15px] font-semibold text-gray-800 dark:text-gray-200">llama.cpp</span>
                    </motion.div>

                    <motion.div variants={badgeVariants} className="flex flex-col">
                        <span className="text-[12px] font-medium text-gray-400 dark:text-gray-500 mb-1 uppercase tracking-wider">{t('about.vector')}</span>
                        <span className="text-[15px] font-semibold text-gray-800 dark:text-gray-200">ChromaDB</span>
                    </motion.div>

                    <motion.div variants={badgeVariants} className="flex flex-col">
                        <span className="text-[12px] font-medium text-gray-400 dark:text-gray-500 mb-1 uppercase tracking-wider">{t('about.dataCore')}</span>
                        <span className="text-[15px] font-semibold text-gray-800 dark:text-gray-200">PostgreSQL</span>
                    </motion.div>
                </div>
            </motion.div>

            {/* 底部版權 */}
            <motion.div variants={itemVariants} className="mt-6 text-center">
                <p className="text-[13px] font-medium text-gray-400 dark:text-gray-500/80">
                    {t('about.copyright')}
                </p>
            </motion.div>
        </motion.div>
    )
}
