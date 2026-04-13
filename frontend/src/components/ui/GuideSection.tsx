import { motion } from 'framer-motion'

export default function GuideSection() {
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
            className="space-y-6 pr-2 custom-scrollbar overflow-y-auto h-full pb-8"
        >
            <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">系統使用說明書</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                    歡迎使用 Corphia AI Platform！本指南將協助您快速熟悉系統各項資源與專屬功能。
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
                    身份與權限管理
                </h4>
                <div className="bg-white dark:bg-ios-dark-gray4 border border-gray-200 dark:border-white/5 rounded-[20px] p-4 text-[14px]">
                    <ul className="space-y-4">
                        <li className="flex gap-3">
                            <span className="w-20 font-medium text-gray-700 dark:text-gray-300 shrink-0">Engineer</span>
                            <span className="text-gray-600 dark:text-gray-400">系統最高權限，可建立與指派所有「租戶 (Tenants)」，並存取完整日誌紀錄。</span>
                        </li>
                        <li className="border-t border-gray-100 dark:border-white/5 pt-3 flex gap-3">
                            <span className="w-20 font-medium text-gray-700 dark:text-gray-300 shrink-0">Admin</span>
                            <span className="text-gray-600 dark:text-gray-400">專屬租戶管理員，可管理租戶內部成員名單並負責資料環境的基本設置。</span>
                        </li>
                        <li className="border-t border-gray-100 dark:border-white/5 pt-3 flex gap-3">
                            <span className="w-20 font-medium text-gray-700 dark:text-gray-300 shrink-0">User</span>
                            <span className="text-gray-600 dark:text-gray-400">一般使用者，能執行一般聊天、查閱專案並建立個人化的知識萃取專案。</span>
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
                    專案模式與知識庫建立
                </h4>
                <div className="bg-white dark:bg-ios-dark-gray4 border border-gray-200 dark:border-white/5 rounded-[20px] p-5 text-[14px] space-y-3 text-gray-600 dark:text-gray-400 leading-relaxed">
                    <p>您可以將介面由左上方切換為 <strong className="text-black dark:text-white">專案模式</strong>，這將會開啟獨立的知識庫資料夾架構：</p>
                    <ol className="list-decimal pl-5 space-y-2">
                        <li>點擊左側的新增專案圖示，為您的研究或專案命名一個資料夾（例如：「財務報表分析」）。</li>
                        <li>進入該資料夾點擊上傳按鈕，支援上傳 <strong className="text-black dark:text-white">.txt, .md, .csv 或 .pdf</strong> 文件。</li>
                        <li>系統後台會自動將文件送入切片處理程序（Chunking）寫入企業向量資料庫（ChromaDB）。</li>
                        <li>處理完成後，您點選「基於此來源開始提問」，AI 便會針對您的文件內容給予答覆與精準溯源。</li>
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
                    高效對話與導覽操作
                </h4>
                <div className="bg-white dark:bg-ios-dark-gray4 border border-gray-200 dark:border-white/5 rounded-[20px] p-5 text-[14px] space-y-3 text-gray-600 dark:text-gray-400 leading-relaxed">
                    <ul className="list-disc pl-5 space-y-3">
                        <li>
                            <strong className="text-black dark:text-white font-medium block mb-1">聊天節點小地圖 (Scroll Minimap)</strong>
                            當您輸入大量對話後，畫面右側的滾動條將會出現指示藍灰方塊，這代表整段畫佈中每一句發言的比例位置；<strong className="text-ios-blue-light dark:text-ios-blue-dark">停懸滑鼠並點擊</strong> 即可迅速將畫面躍動至對應節點。
                        </li>
                        <li>
                            <strong className="text-black dark:text-white font-medium block mb-1">懸浮置底按鈕</strong>
                            如果您正在往上翻閱過去的紀錄，畫面右下方會於一段距離後悄悄浮現一個往下箭頭。點擊它能讓您一秒內滑降回到最新回應處。
                        </li>
                        <li>
                            <strong className="text-black dark:text-white font-medium block mb-1">改名與全域刪除</strong>
                            將游標 Hover 到左側導覽列的任一對話上，會顯示出設定彈出式選單，您可以進行「修改標題」、「移轉專案目錄」或是立刻「刪除整個對話紀錄」。
                        </li>
                    </ul>
                </div>
            </motion.section>

        </motion.div>
    )
}
