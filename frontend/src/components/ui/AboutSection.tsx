import { motion } from 'framer-motion'

const RobotIcon = () => (
    <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15M14.25 3.104c.251.023.501.05.75.082M19.8 15l-2.4 2.4m0 0-2.4 2.4M19.8 15l2.4 2.4m-2.4-2.4-2.4-2.4M9 9h.01M15 9h.01M9 12h6M7.5 19.5h9" />
    </svg>
)

export default function AboutSection() {
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
                    <RobotIcon />
                </div>
            </motion.div>

            {/* 系統標題 */}
            <motion.div variants={itemVariants} className="text-center mb-6">
                <h3 className="text-[28px] font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 tracking-tight leading-tight mb-2">
                    Corphia AI Platform
                </h3>
                <div className="flex items-center justify-center gap-2">
                    <span className="px-2.5 py-1 text-xs font-semibold bg-gray-100 dark:bg-ios-dark-gray4 text-gray-600 dark:text-gray-300 rounded-lg">
                        版本 2.2.0
                    </span>
                    <span className="px-2.5 py-1 text-xs font-semibold bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400 rounded-lg flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                        系統穩定
                    </span>
                </div>
            </motion.div>

            {/* 描述 */}
            <motion.p variants={itemVariants} className="text-[15px] text-gray-500 dark:text-gray-400 text-center max-w-sm leading-relaxed mb-8">
                企業級私有部署 AI 問答系統，支援本地大型語言模型與 RAG 企業知識庫精準檢索技術。
            </motion.p>

            {/* 技術棧標籤卡塊 */}
            <motion.div variants={itemVariants} className="w-full bg-gray-50/50 dark:bg-ios-dark-gray6/30 border border-gray-100 dark:border-white/5 rounded-[24px] p-6 backdrop-blur-sm">
                <div className="grid grid-cols-2 gap-y-5 gap-x-4">
                    <motion.div variants={badgeVariants} className="flex flex-col">
                        <span className="text-[12px] font-medium text-gray-400 dark:text-gray-500 mb-1 uppercase tracking-wider">Frontend / API</span>
                        <span className="text-[15px] font-semibold text-gray-800 dark:text-gray-200">React + FastAPI</span>
                    </motion.div>
                    
                    <motion.div variants={badgeVariants} className="flex flex-col">
                        <span className="text-[12px] font-medium text-gray-400 dark:text-gray-500 mb-1 uppercase tracking-wider">Inference Engine</span>
                        <span className="text-[15px] font-semibold text-gray-800 dark:text-gray-200">llama.cpp</span>
                    </motion.div>

                    <motion.div variants={badgeVariants} className="flex flex-col">
                        <span className="text-[12px] font-medium text-gray-400 dark:text-gray-500 mb-1 uppercase tracking-wider">Vector Storage</span>
                        <span className="text-[15px] font-semibold text-gray-800 dark:text-gray-200">ChromaDB</span>
                    </motion.div>

                    <motion.div variants={badgeVariants} className="flex flex-col">
                        <span className="text-[12px] font-medium text-gray-400 dark:text-gray-500 mb-1 uppercase tracking-wider">Data Core</span>
                        <span className="text-[15px] font-semibold text-gray-800 dark:text-gray-200">PostgreSQL</span>
                    </motion.div>
                </div>
            </motion.div>

            {/* 底部版權 */}
            <motion.div variants={itemVariants} className="mt-6 text-center">
                <p className="text-[13px] font-medium text-gray-400 dark:text-gray-500/80">
                    &copy; 2024 Corphia AI. MIT License.
                </p>
            </motion.div>
        </motion.div>
    )
}
