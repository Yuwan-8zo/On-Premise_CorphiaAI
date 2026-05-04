import { motion } from '@/lib/gsapMotion'
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
            className="flex flex-col items-center pb-8"
        >
            {/* 懸浮機器人圖標 */}
            <motion.div 
                variants={itemVariants}
                className="relative mb-6"
            >
                <div
                    className="relative z-10 inline-flex items-center justify-center w-28 h-28 rounded-[28px] bg-gradient-to-tr from-accent via-accent to-blue-400 border border-border-subtle"
                >
                    <CorphiaLogoSymbol className="w-16 h-16" />
                </div>
            </motion.div>

            {/* 系統標題 */}
            <motion.div variants={itemVariants} className="text-center mb-6">
                <h3 className="text-[28px] font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 tracking-tight leading-tight mb-2">
                    Corphia AI Platform
                </h3>
                <div className="flex items-center justify-center gap-2">
                    <span className="px-2.5 py-1 text-xs font-semibold bg-bg-surface text-text-secondary rounded-lg">
                        {t('about.version')} 2.3.0
                    </span>
                    <span className="px-2.5 py-1 text-xs font-semibold bg-green-100 text-green-700 rounded-lg flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                        {t('about.systemStable')}
                    </span>
                </div>
            </motion.div>

            {/* 描述 */}
            <motion.p variants={itemVariants} className="text-[15px] text-text-secondary text-center max-w-sm leading-relaxed mb-8">
                {t('about.description')}
            </motion.p>

            {/* 技術棧標籤卡塊 */}
            <motion.div variants={itemVariants} className="w-full bg-bg-base/50 border border-border-subtle rounded-cv-xl p-6 backdrop-blur-sm">
                <div className="grid grid-cols-2 gap-y-5 gap-x-4">
                    <motion.div variants={badgeVariants} className="flex flex-col">
                        <span className="text-[12px] font-medium text-text-muted mb-1 uppercase tracking-wider">{t('about.frontend')}</span>
                        <span className="text-[15px] font-semibold text-text-primary">React + FastAPI</span>
                    </motion.div>
                    
                    <motion.div variants={badgeVariants} className="flex flex-col">
                        <span className="text-[12px] font-medium text-text-muted mb-1 uppercase tracking-wider">{t('about.inference')}</span>
                        <span className="text-[15px] font-semibold text-text-primary">llama.cpp</span>
                    </motion.div>

                    <motion.div variants={badgeVariants} className="flex flex-col">
                        <span className="text-[12px] font-medium text-text-muted mb-1 uppercase tracking-wider">{t('about.vector')}</span>
                        <span className="text-[15px] font-semibold text-text-primary">pgvector</span>
                    </motion.div>

                    <motion.div variants={badgeVariants} className="flex flex-col">
                        <span className="text-[12px] font-medium text-text-muted mb-1 uppercase tracking-wider">{t('about.dataCore')}</span>
                        <span className="text-[15px] font-semibold text-text-primary">PostgreSQL</span>
                    </motion.div>
                </div>
            </motion.div>

            {/* 底部版權 */}
            <motion.div variants={itemVariants} className="mt-6 text-center">
                <p className="text-[13px] font-medium text-text-muted">
                    {t('about.copyright')}
                </p>
            </motion.div>
        </motion.div>
    )
}
