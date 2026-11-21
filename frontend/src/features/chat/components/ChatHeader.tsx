import { useLayoutEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from '@/lib/gsapMotion'
import { readPx } from '@/lib/cssVars'
import { MQ_DESKTOP, useMediaQuery } from '@/lib/useMediaQuery'
import LensMenu from '@/components/ui/LensMenu'
import { useMenuTrigger } from '@/lib/menuDrag'
import GlassDock from '@/components/ui/GlassDock'
import { Check, ChevronDown, Edit2, Folder, Lock, PanelRight, Share, ShieldCheck, Trash2 } from '@/components/snow/icons'
import { useSidePanelStore } from '@/store/sidePanelStore'
import Tooltip from '@/components/ui/Tooltip'
import { SidebarIcon } from './ChatIcons'
import type { ModelItem } from '@/api/models'
import modelsApi from '@/api/models'
import { useSystemStore } from '@/store/systemStore'
import type { Conversation } from '@/types/chat'
import { useTranslation } from 'react-i18next'
import { popIn } from '@/lib/motionPresets'
import { useDismiss } from '@/lib/useDismiss'
import { getErrorMessage } from '@/lib/errors'
import { useScrollFade } from '@/lib/useScrollFade'
import { useUIStore } from '@/store/uiStore'
import { useToastStore } from '@/store/toastStore'
import { displayModelName, shortModelName } from '@/lib/modelName'

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
    handleUnshareConversation: (id: string) => void
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
    availableModels,
    currentConversation,
    handleShareConversation, handleUnshareConversation, handleRenameConversation,
    handleMoveToProject, handleVerifyChain, handleDeleteConversation
}: ChatHeaderProps) {
    const { t } = useTranslation()
    // 模型清單捲動區：不顯示捲軸，上下還有內容時邊緣淡出（全站捲動區同一套）
    const modelScrollRef = useScrollFade()
    // 每個模型是否已預先載入（來自 /health），用來在選單標示並在切換到未載入的大模型前確認
    const modelStates = useSystemStore((s) => s.health?.models) ?? NO_MODEL_STATES
    const showConfirm = useUIStore((s) => s.showConfirm)
    const toast = useToastStore()

    /** 換成「自己」用的模型（只影響自己，其他人不變） */
    const switchModel = async (model: ModelItem) => {
        try {
            setIsModelLoading(true)
            await modelsApi.selectModel(model.name)
            setSelectedModel(model)
            setModelDropdownOpen(false)
        } catch (err) {
            console.error('選擇模型失敗', err)
            toast.error(getErrorMessage(err))
        } finally {
            setIsModelLoading(false)
        }
    }
    // 模型選單：點外面由透明層處理，這裡補上 Esc 關閉
    // 按住模型鈕直接拖進選單、放大鏡選取（lib/menuDrag）
    const trigger = useMenuTrigger()
    const modelTrigger = trigger(modelDropdownOpen, () => setModelDropdownOpen(true), () => setModelDropdownOpen(false))
    useDismiss(modelDropdownOpen, () => setModelDropdownOpen(false), [], { outside: false })
    // 手機：模型選單（寬 --sz-340）靠右對齊按鈕會往左超出螢幕 → 打開時量按鈕位置：
    // 放得下就照電腦版靠右對齊；放不下就撐滿畫面，左右各留 --sp-12（不歪一邊、文字也不被擠到換行）
    const isDesktop = useMediaQuery(MQ_DESKTOP)
    const modelGroupRef = useRef<HTMLDivElement>(null)
    const [phoneMenuBox, setPhoneMenuBox] = useState<{ right: number; width: number } | null>(null)
    useLayoutEffect(() => {
        const group = modelGroupRef.current
        if (!modelDropdownOpen || isDesktop || !group) { setPhoneMenuBox(null); return }
        const edge = readPx('--sp-12')
        const vw = window.innerWidth
        const buttonRight = group.getBoundingClientRect().right
        const fits = buttonRight - readPx('--sz-340') >= edge
        setPhoneMenuBox(fits ? null : { right: buttonRight - (vw - edge), width: vw - 2 * edge })
    }, [modelDropdownOpen, isDesktop])
    // Mobile RWD: gap + min-w-0 for truncation; hide Corphia title on small screens; shorter model abbrev
    return (
        <header className="shrink-0 w-full p-3 md:pt-[var(--sp-21)] md:pb-4 md:px-[var(--sp-21)] chat-head flex items-center justify-between gap-2 z-30 bg-transparent sticky top-0">
            <div className="flex items-center gap-2 md:gap-3 min-w-0">
                <button
                    onClick={toggleSidebar}
                    data-tour="sidebar-toggle"
                    aria-label={t('ui.sidebar.expand')}
                    className={`p-2 -ml-1 rounded-full  transition-colors md:hidden shrink-0 ${sidebarOpen ? 'opacity-0 pointer-events-none' : 'text-text-secondary'}`}
                >
                    <SidebarIcon className="w-5 h-5" />
                </button>

                {/* 品牌字標移到側欄（展開＝完整字標、收合＝C 星芒）；這裡只留給讀螢幕軟體的標題 */}
                <h1 className="sr-only">Corphia</h1>
            </div>

            <div className="flex items-center gap-2 min-w-0 shrink">
                {/* 右側：GGUF 模型選擇下拉選單（自己一條膠囊：內距 2、按鈕高 46、外框圓角 25，同心） */}
                <div ref={modelGroupRef} data-tour="model" className="btn-group btn-group-36 relative min-w-0">
                    <button
                        onPointerDown={isModelLoading ? undefined : modelTrigger.onPointerDown}
                        onClick={modelTrigger.onClick}
                        disabled={isModelLoading}
                        aria-haspopup="listbox"
                        aria-expanded={modelDropdownOpen}
                        className="touch-none flex items-center gap-1.5 md:gap-2 h-[var(--top-in)] px-3.5 rounded-full text-text-primary transition-[background-color,transform] duration-200 active:scale-[0.97] disabled:opacity-50 max-w-[var(--sz-180)] md:max-w-none"
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
                                        {shortModelName(selectedModel.name)}
                                    </span>
                                    <span className="hidden md:inline truncate" title={selectedModel.name}>{displayModelName(selectedModel.name)}</span>
                                </>
                            ) : <span aria-label={t('common.loading')} className="skel align-middle h-[0.78em] w-[12em]" style={{ display: 'inline-block' }} />}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-text-muted opacity-80 transition-transform shrink-0 ${modelDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {modelDropdownOpen && <div className="fixed inset-0 z-40" onClick={() => setModelDropdownOpen(false)} />}
                    <AnimatePresence>
                        {modelDropdownOpen && (
                                <motion.div
                                    key="model-menu"
                                    {...popIn}
                                    // 圓角和上面的模型膠囊按鈕一樣（--grp-r 是按鈕群組的圓角，選單在群組裡面直接繼承）；
                                    // 裡面的列＝圓角－內距（同心）。不用 LensMenu 依列高自動算的大圓角
                                    className="model-menu absolute right-0 top-full mt-2 origin-top-right w-[var(--sz-340)] paper paper-solid overflow-hidden z-50 p-[var(--sp-8)]"
                                    style={phoneMenuBox ?? undefined}
                                >
                                    <LensMenu className="" fitCard={false}>
                                    <div ref={modelScrollRef} className="glass-scroll max-h-[var(--sz-300)]">
                                        {availableModels.length === 0 ? (
                                            <div className="p-4 text-center text-[length:var(--fs-15)] leading-[var(--lh-20)] text-text-secondary">{t('ui.header.noModels')}</div>
                                        ) : (
                                            availableModels.map(model => {
                                                const loadState = modelStates.find(m => m.name === model.name)?.state
                                                const preloaded = loadState === 'ready'
                                                return (
                                                <button
                                                    key={model.name}
                                                    onClick={() => {
                                                        if (isModelLoading) return
                                                        // 選到目前的模型：和一般下拉一樣，直接收起來
                                                        if (selectedModel?.name === model.name) { setModelDropdownOpen(false); return }
                                                        // 沒有預先載入的大模型（如 14B）切換要等很久，先用共用確認框確認，避免誤點
                                                        if (!preloaded) {
                                                            setModelDropdownOpen(false)
                                                            showConfirm(t('ui.header.confirmSwitch', { name: model.name, size: model.size_gb.toFixed(1) }), () => switchModel(model), undefined, { tone: 'default' })
                                                            return
                                                        }
                                                        void switchModel(model)
                                                    }}
                                                    className={`model-row ${selectedModel?.name === model.name ? 'is-current' : ''}`}
                                                >
                                                    <div className="flex flex-col min-w-0 pr-3">
                                                        <span className="model-row-title" title={model.name}>{displayModelName(model.name)}</span>
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
                                    {/* 以前最下面有「掃描最新模型庫…」：使用者要求拿掉；要重新掃描到後台「模型」頁 */}
                                    </LensMenu>
                                </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* 旁邊面板的開關：對話裡有可以放大看的成品（HTML／SVG、執行結果、附加的 HTML）才出現 */}
                <SidePanelToggle />

                {/* 右側：玻璃選單鈕（規範右下選單的邏輯：點一下展開圖示；長按或直接往下滑才出現文字與放大鏡） */}
                <GlassDock
                    aria-label={t('ui.header.convOptions')}
                    // 新對話首頁還沒有對話：分享、重新命名、刪除都沒有對象，選單鈕變淡、按不開
                    disabled={!currentConversation}
                    items={[
                        { id: 'share', label: t('chat.shareChat'), icon: <Share />, onSelect: () => { if (currentConversation) handleShareConversation(currentConversation.id) } },
                        // 分享過的對話才有「取消分享」
                        ...(currentConversation?.settings?.shared ? [{ id: 'unshare', label: t('ui.chat.unshare'), icon: <Lock />, onSelect: () => handleUnshareConversation(currentConversation.id) }] : []),
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

/** 右上角的面板開關（一直都在，位置固定不會忽隱忽現）：開著就關；關著就打開「這個對話的檔案」清單，沒有檔案時清單會說明 */
function SidePanelToggle() {
    const { t } = useTranslation()
    const open = useSidePanelStore((s) => s.open)
    const showList = useSidePanelStore((s) => s.showList)
    const close = useSidePanelStore((s) => s.close)
    const label = t(open ? 'ui.chat.sidePanel.close' : 'ui.chat.sidePanel.files')
    return (
        <Tooltip label={label}>
            <button
                type="button"
                onClick={() => (open ? close() : showList())}
                aria-label={label}
                aria-pressed={open}
                className={`btn-icon !w-[var(--top-btn)] !h-[var(--top-btn)] [--R:calc(var(--top-btn)/2)] shrink-0 ${open ? 'is-current text-accent' : 'text-text-secondary'}`}
            >
                <PanelRight className="w-[var(--sz-20)] h-[var(--sz-20)]" />
            </button>
        </Tooltip>
    )
}
