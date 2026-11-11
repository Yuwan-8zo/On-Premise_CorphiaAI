import { motion, AnimatePresence } from '@/lib/gsapMotion'
import LensMenu from '@/components/ui/LensMenu'
import GlassDock from '@/components/ui/GlassDock'
import { CorphiaWordmark } from '@/components/icons/CorphiaIcons'
import { Check, ChevronDown, Edit2, Folder, RefreshCw, Share, ShieldCheck, Trash2 } from '@/components/snow/icons'
import { SidebarIcon } from './ChatIcons'
import type { ModelItem } from '@/api/models'
import modelsApi from '@/api/models'
import { useSystemStore } from '@/store/systemStore'
import type { Conversation } from '@/types/chat'
import { useTranslation } from 'react-i18next'

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

const NO_MODEL_STATES: Array<{ name: string; state: string }> = []

export default function ChatHeader({
    sidebarOpen, toggleSidebar,
    modelDropdownOpen, setModelDropdownOpen,
    isModelLoading, setIsModelLoading,
    selectedModel, setSelectedModel,
    availableModels, setAvailableModels,
    currentConversation,
    handleShareConversation, handleRenameConversation,
    handleMoveToProject, handleVerifyChain, handleDeleteConversation
}: ChatHeaderProps) {
    const { t } = useTranslation()
    // 每個模型是否已預先載入（來自 /health），用來在選單標示並在切換到未載入的大模型前確認
    const modelStates = useSystemStore((s) => s.health?.models) ?? NO_MODEL_STATES
    // Mobile RWD: gap + min-w-0 for truncation; hide Corphia title on small screens; shorter model abbrev
    return (
        <header className="shrink-0 w-full p-3 md:pt-[var(--sp-21)] md:pb-4 md:px-[var(--sp-21)] chat-head flex items-center justify-between gap-2 z-30 bg-transparent sticky top-0">
            <div className="flex items-center gap-2 md:gap-3 min-w-0">
                <button
                    onClick={toggleSidebar}
                    aria-label={t('ui.sidebar.expand')}
                    className={`p-2 -ml-1 rounded-full  transition-colors md:hidden shrink-0 ${sidebarOpen ? 'opacity-0 pointer-events-none' : 'text-text-secondary'}`}
                >
                    <SidebarIcon className="w-5 h-5" />
                </button>

                {/* Left: Corphia title - hidden on mobile to give space to model selector */}
                {/* 品牌字：和登入頁同一個字標（含星星） */}
                <h1 className={`hidden sm:flex items-center transition-opacity ${sidebarOpen ? 'max-md:opacity-0' : 'opacity-100'}`}>
                    {/* 字標圖片上下有留白：圖高 63、看得到的字（含 p 的下伸）＝40，跟右側按鈕同高同位；負邊距加在外層（星星那層跟著圖片對齊），讓排版仍佔 40 */}
                    <span className="-mt-[var(--sp-2)] -mb-[var(--sp-21)] flex"><CorphiaWordmark className="h-[var(--sz-63)] w-auto object-contain object-left pointer-events-none select-none" /></span>
                    <span className="sr-only">Corphia</span>
                </h1>
            </div>

            <div className="flex items-center gap-2 min-w-0 shrink">
                {/* 右側：GGUF 模型選擇下拉選單（自己一條膠囊：內距 2、按鈕高 46、外框圓角 25，同心） */}
                <div className="btn-group btn-group-36 relative min-w-0">
                    <button
                        onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                        disabled={isModelLoading}
                        className="flex items-center gap-1.5 md:gap-2 h-[var(--sz-36)] px-3.5 rounded-full text-text-primary transition-[background-color,transform] duration-200 active:scale-[0.97] disabled:opacity-50 max-w-[var(--sz-180)] md:max-w-none"
                    >
                        <span className="text-[length:var(--fs-12)] md:text-[length:var(--fs-14)] font-semibold tabular-nums tracking-tight transition-colors flex items-center gap-2 min-w-0">
                            {isModelLoading ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-[var(--paper-line)] border-t-transparent rounded-full animate-spin shrink-0" />
                                    <span className="hidden md:inline">{t('ui.header.processingModel')}</span>
                                    <span className="md:hidden">{t('common.loading')}</span>
                                </>
                            ) : selectedModel ? (
                                <>
                                    {/* Mobile: short abbreviation to avoid overflow */}
                                    <span className="md:hidden truncate max-w-[var(--sz-110)]">
                                        {(() => {
                                            const name = selectedModel.name.toLowerCase();
                                            if (name.includes('qwen') && name.includes('2.5') && name.includes('7b')) {
                                                if (name.includes('q5_k_m')) return 'Qwen2.5·Q5';
                                                if (name.includes('q4_k_m')) return 'Qwen2.5·Q4';
                                                return 'Qwen2.5·7B';
                                            }
                                            if (name.includes('llama') && name.includes('3')) return 'Llama3';
                                            return selectedModel.name.split('.')[0].substring(0, 10);
                                        })()}
                                    </span>
                                    <span className="hidden md:inline truncate">{selectedModel.name}</span>
                                </>
                            ) : <span aria-label={t('common.loading')} className="skel align-middle h-[0.78em] w-[12em]" style={{ display: 'inline-block' }} />}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-text-muted opacity-80 transition-transform shrink-0 ${modelDropdownOpen ? 'rotate-180' : ''}`} />
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
                                    className="absolute right-0 top-full mt-2 w-[var(--sz-340)] paper overflow-hidden z-50 p-2"
                                >
                                    <LensMenu className="">
                                    <div className="max-h-[var(--sz-300)] overflow-y-auto custom-scrollbar">
                                        {availableModels.length === 0 ? (
                                            <div className="p-4 text-center text-sm text-text-secondary">{t('ui.header.noModels')}</div>
                                        ) : (
                                            availableModels.map(model => {
                                                const loadState = modelStates.find(m => m.name === model.name)?.state
                                                const preloaded = loadState === 'ready'
                                                return (
                                                <button
                                                    key={model.name}
                                                    onClick={async () => {
                                                        if (isModelLoading) return;
                                                        // 沒有預先載入的大模型（如 14B）切換要等很久，先確認避免展示時誤點
                                                        if (!preloaded && selectedModel?.name !== model.name &&
                                                            !window.confirm(t('ui.header.confirmSwitch', { name: model.name, size: model.size_gb.toFixed(1) }))) return;
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
                                                    className={`model-row ${selectedModel?.name === model.name ? 'is-current' : ''}`}
                                                >
                                                    <div className="flex flex-col min-w-0 pr-3">
                                                        <span className="model-row-title">{model.name}</span>
                                                        <span className="model-row-sub">
                                                            {[
                                                                `${model.size_gb.toFixed(1)} GB`,
                                                                model.quantization,
                                                                loadState ? t(preloaded ? 'ui.header.preloaded' : loadState === 'loading' ? 'ui.header.loadingModel' : 'ui.header.notPreloaded') : null,
                                                            ].filter(Boolean).join('・')}
                                                        </span>
                                                    </div>
                                                    {selectedModel?.name === model.name && (
                                                        <Check className="w-5 h-5 ml-2 text-accent shrink-0" />
                                                    )}
                                                </button>
                                                )
                                            })
                                        )}
                                    </div>
                                    
                                    <div className="mt-2 pt-2 border-t border-[var(--paper-line)]">
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
                                            className="w-full text-left px-4 py-3 rounded-full flex items-center gap-3 transition-colors  text-text-secondary group"
                                        >
                                            <RefreshCw className="w-5 h-5 group-active:rotate-180 transition-transform duration-300" />
                                            <span className="font-semibold text-[length:var(--fs-14)]">{t('ui.header.scanModels')}</span>
                                        </button>
                                    </div>
                                    </LensMenu>
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                </div>

                {/* 右側：玻璃選單鈕（規範右下選單的邏輯：點一下展開圖示；長按或直接往下滑才出現文字與放大鏡） */}
                <GlassDock
                    aria-label={t('ui.header.convOptions')}
                    items={[
                        { id: 'share', label: t('chat.shareChat'), icon: <Share />, onSelect: () => { if (currentConversation) handleShareConversation(currentConversation.id) } },
                        { id: 'rename', label: t('chat.renameChat'), icon: <Edit2 />, onSelect: () => { if (currentConversation) handleRenameConversation(currentConversation.id) } },
                        { id: 'move', label: t('chat.moveToProject'), icon: <Folder />, onSelect: () => { if (currentConversation) handleMoveToProject(currentConversation.id) } },
                        { id: 'verify', label: t('ui.header.verifyChain'), tone: 'success', icon: <ShieldCheck />, onSelect: () => { if (currentConversation) handleVerifyChain(currentConversation.id) } },
                        {
                            id: 'delete', label: t('common.delete'), tone: 'danger', icon: <Trash2 />,
                            onSelect: () => { if (currentConversation) handleDeleteConversation(currentConversation.id, { stopPropagation() {} } as unknown as React.MouseEvent) },
                        },
                    ]}
                />
            </div>
        </header>
    )
}
