import { motion, AnimatePresence } from 'framer-motion'
import { SidebarIcon } from './ChatIcons'
import { CorphiaLogo } from '../icons/CorphiaIcons'
import type { ModelItem } from '../../api/models'
import modelsApi from '../../api/models'
import type { Conversation } from '../../types/chat'

interface ChatHeaderProps {
    sidebarOpen: boolean
    toggleSidebar: () => void
    
    // 模型選單狀態
    modelDropdownOpen: boolean
    setModelDropdownOpen: (open: boolean) => void
    isModelLoading: boolean
    setIsModelLoading: (loading: boolean) => void
    selectedModel: ModelItem | null
    setSelectedModel: (model: ModelItem) => void
    availableModels: ModelItem[]
    setAvailableModels: (models: ModelItem[]) => void
    
    // 三個點選單狀態
    headerMenuOpen: boolean
    setHeaderMenuOpen: (open: boolean) => void
    currentConversation: Conversation | null
    
    // 動作
    handleShareConversation: (id: string) => void
    handleRenameConversation: (id: string) => void
    handleMoveToProject: (id: string) => void
    handleVerifyChain: (id: string) => void
    handleDeleteConversation: (id: string, e: React.MouseEvent) => void
}

export default function ChatHeader({
    sidebarOpen, toggleSidebar,
    modelDropdownOpen, setModelDropdownOpen,
    isModelLoading, setIsModelLoading,
    selectedModel, setSelectedModel,
    availableModels, setAvailableModels,
    headerMenuOpen, setHeaderMenuOpen,
    currentConversation,
    handleShareConversation, handleRenameConversation,
    handleMoveToProject, handleVerifyChain, handleDeleteConversation
}: ChatHeaderProps) {
    return (
        <header className="shrink-0 w-full p-4 md:px-6 flex items-center justify-between z-30 bg-corphia-main dark:bg-corphia-obsidian transition-colors">
            <div className="flex items-center gap-3">
                <button
                    onClick={toggleSidebar}
                    className={`p-2 -ml-2 rounded-full hover:bg-gray-200/50 dark:hover:bg-ios-dark-gray4 transition-colors md:hidden ${sidebarOpen ? 'opacity-0 pointer-events-none' : 'text-gray-600 dark:text-gray-300'}`}
                >
                    <SidebarIcon className="w-5 h-5" />
                </button>
                
                {/* 左側：Corphia Logo 與文字 */}
                <h1 className={`text-[20px] font-bold text-gray-800 dark:text-gray-200 tracking-wide flex items-center gap-3 transition-opacity ${sidebarOpen ? 'max-md:opacity-0' : 'opacity-100'}`}>
                    Corphia
                </h1>
            </div>

            <div className="flex items-center gap-2">
                {/* 右側：GGUF 模型選擇下拉選單 */}
                <div className="relative">
                    <button 
                        onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                        disabled={isModelLoading}
                        className="flex items-center gap-2 transition-opacity px-3 py-1.5 rounded-full hover:bg-gray-100/80 dark:hover:bg-ios-dark-gray4 text-gray-600 dark:text-gray-300 border border-transparent hover:border-gray-200 dark:hover:border-white/5 active:bg-gray-200 dark:active:bg-ios-dark-gray3 disabled:opacity-50"
                    >
                        <span className="text-[14px] font-semibold font-mono tracking-tight sm:max-w-none text-gray-500 dark:text-gray-400 flex items-center gap-2">
                            {isModelLoading ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                                    <span className="hidden md:inline">正在處理模型...</span>
                                    <span className="md:hidden">載入中...</span>
                                </>
                            ) : selectedModel ? (
                                <>
                                    <span className="md:hidden truncate max-w-[120px]">
                                        {(() => {
                                            const name = selectedModel.name.toLowerCase();
                                            if (name.includes('qwen') && name.includes('2.5') && name.includes('7b')) {
                                                if (name.includes('q5_k_m')) return 'Q2.5-7B-Q5KM';
                                                if (name.includes('q4_k_m')) return 'Q2.5-7B-Q4KM';
                                                return 'Q2.5-7B';
                                            }
                                            if (name.includes('llama') && name.includes('3')) return 'Llama3';
                                            return selectedModel.name.split('.')[0].substring(0, 12);
                                        })()}
                                    </span>
                                    <span className="hidden md:inline">{selectedModel.name}</span>
                                </>
                            ) : 'Loading Models...'}
                        </span>
                        <svg className={`w-4 h-4 text-gray-400 opacity-80 transition-transform ${modelDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path></svg>
                    </button>

                    <AnimatePresence>
                        {modelDropdownOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setModelDropdownOpen(false)} />
                                <motion.div
                                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                    transition={{ duration: 0.2, ease: 'easeOut' }}
                                    className="absolute right-0 top-full mt-2 w-[340px] bg-corphia-ivory dark:bg-corphia-obsidian rounded-[20px] shadow-xl border border-ios-light-gray5 dark:border-white/5 overflow-hidden z-50 p-2"
                                >
                                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                                        {availableModels.length === 0 ? (
                                            <div className="p-4 text-center text-sm text-gray-500">無可用模型，請掃描目錄。</div>
                                        ) : (
                                            availableModels.map(model => (
                                                <button
                                                    key={model.name}
                                                    onClick={async () => {
                                                        if (isModelLoading) return;
                                                        try {
                                                            setIsModelLoading(true);
                                                            await modelsApi.selectModel(model.name);
                                                            setSelectedModel(model);
                                                            setModelDropdownOpen(false);
                                                        } catch (err) {
                                                            console.error('選擇模型失敗', err);
                                                        } finally {
                                                            setIsModelLoading(false);
                                                        }
                                                    }}
                                                    className={`w-full text-left px-4 py-3 mb-1 rounded-full flex items-center justify-between transition-colors ${selectedModel?.name === model.name ? 'bg-corphia-beige dark:bg-corphia-espresso' : 'hover:bg-corphia-beige dark:hover:bg-ios-dark-gray4'}`}
                                                >
                                                    <div className="flex flex-col min-w-0 pr-3">
                                                        <span className={`font-semibold text-[14px] break-all ${selectedModel?.name === model.name ? 'text-corphia-ink dark:text-corphia-ivory' : 'text-gray-700 dark:text-gray-300'}`}>{model.name}</span>
                                                        <span className="text-[12px] text-gray-500 mt-1 flex items-center gap-2">
                                                            <span>{model.size_gb.toFixed(1)} GB</span>
                                                            {model.quantization && (
                                                                <span className="bg-gray-200/50 dark:bg-corphia-obsidian px-1.5 py-0.5 rounded-full text-[10px] uppercase">{model.quantization}</span>
                                                            )}
                                                        </span>
                                                    </div>
                                                    {selectedModel?.name === model.name && (
                                                        <svg className="w-5 h-5 ml-2 text-corphia-bronze dark:text-ios-blue-dark shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>
                                                    )}
                                                </button>
                                            ))
                                        )}
                                    </div>
                                    
                                    <div className="mt-2 pt-2 border-t border-ios-light-gray5 dark:border-white/5">
                                        <button 
                                            onClick={async () => {
                                                if (isModelLoading) return;
                                                try {
                                                    setIsModelLoading(true);
                                                    const res = await modelsApi.refreshModels();
                                                    setAvailableModels(res.models);
                                                } catch (err) {
                                                    console.error('重新掃描失敗', err);
                                                } finally {
                                                    setIsModelLoading(false);
                                                }
                                            }}
                                            className="w-full text-left px-4 py-3 rounded-full flex items-center gap-3 transition-colors hover:bg-corphia-beige dark:hover:bg-ios-dark-gray4 text-gray-600 dark:text-gray-400 group"
                                        >
                                            <svg className="w-5 h-5 group-active:rotate-180 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                                            <span className="font-semibold text-[14px]">掃描最新模型庫...</span>
                                        </button>
                                    </div>
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                </div>

                {/* 右側：三個點選單 */}
                <div className="relative">
                    <button 
                        onClick={() => setHeaderMenuOpen(!headerMenuOpen)}
                        className={`p-2 hover:bg-gray-100 dark:hover:bg-ios-dark-gray4 rounded-full transition-colors ${headerMenuOpen ? 'text-gray-800 dark:text-corphia-ivory bg-gray-100 dark:bg-corphia-espresso' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="5" cy="12" r="1.5" fill="currentColor"></circle>
                            <circle cx="12" cy="12" r="1.5" fill="currentColor"></circle>
                            <circle cx="19" cy="12" r="1.5" fill="currentColor"></circle>
                        </svg>
                    </button>

                    <AnimatePresence>
                        {headerMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setHeaderMenuOpen(false)} />
                                <motion.div
                                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                    transition={{ duration: 0.2, ease: 'easeOut' }}
                                    className="absolute right-0 top-full mt-2 w-[180px] bg-corphia-ivory dark:bg-corphia-obsidian rounded-[20px] shadow-xl border border-ios-light-gray5 dark:border-white/5 overflow-hidden z-50 p-1.5 flex flex-col gap-0.5 text-black dark:text-gray-200"
                                >
                                    <button 
                                        onClick={() => { setHeaderMenuOpen(false); if(currentConversation) handleShareConversation(currentConversation.id) }}
                                        className="w-full text-left px-3 py-2.5 rounded-[8px] flex items-center gap-3 transition-colors hover:bg-gray-100 dark:hover:bg-ios-dark-gray4 active:bg-gray-200 dark:active:bg-corphia-ivory/10"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                        <span className="font-medium text-[15px]">分享</span>
                                    </button>
                                    <button 
                                        onClick={() => { setHeaderMenuOpen(false); if(currentConversation) handleRenameConversation(currentConversation.id) }}
                                        className="w-full text-left px-3 py-2.5 rounded-[8px] flex items-center gap-3 transition-colors hover:bg-gray-100 dark:hover:bg-ios-dark-gray4 active:bg-gray-200 dark:active:bg-corphia-ivory/10"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                                        <span className="font-medium text-[15px]">重新命名</span>
                                    </button>
                                    <button 
                                        onClick={() => { setHeaderMenuOpen(false); if(currentConversation) handleMoveToProject(currentConversation.id) }}
                                        className="w-full text-left px-3 py-2.5 rounded-[8px] flex items-center gap-3 transition-colors hover:bg-gray-100 dark:hover:bg-ios-dark-gray4 active:bg-gray-200 dark:active:bg-corphia-ivory/10"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                                        <span className="font-medium text-[15px]">移至專案</span>
                                    </button>
                                    <button 
                                        onClick={() => { setHeaderMenuOpen(false); if(currentConversation) handleVerifyChain(currentConversation.id) }}
                                        className="w-full text-left px-3 py-2.5 rounded-[8px] flex items-center gap-3 transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 active:bg-emerald-100 dark:active:bg-emerald-500/20"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                                            <path d="M9 12l2 2 4-4"></path>
                                        </svg>
                                        <span className="font-medium text-[15px]">驗證防篡改鏈</span>
                                    </button>
                                    <div className="my-1 border-t border-ios-light-gray5 dark:border-white/5" />
                                    <button 
                                        onClick={(e) => { 
                                            setHeaderMenuOpen(false); 
                                            if(currentConversation) {
                                                handleDeleteConversation(currentConversation.id, e)
                                            } 
                                        }}
                                        className="w-full text-left px-3 py-2.5 rounded-[8px] flex items-center gap-3 transition-colors hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 active:bg-red-100 dark:active:bg-red-500/20"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                        <span className="font-medium text-[15px]">刪除</span>
                                    </button>
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </header>
    )
}
