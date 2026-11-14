/**
 * 對話側邊欄元件
 * 
 * 從 Chat.tsx 拆分出來，負責渲染：
 * - Logo 與收合按鈕
 * - 新對話 / 新資料夾 按鈕
 * - 一般/專案模式切換
 * - 對話列表（一般聊天 + 專案資料夾樹狀清單）
 * - 底部使用者卡片
 */

import { useScrollFade } from '@/lib/useScrollFade'
import { beginMenuDrag, useMenuTrigger } from '@/lib/menuDrag'
import { Folder, MessageSquare, Plus, Search, SlidersHorizontal, Trash2 } from '@/components/snow/icons'
import ProjectInstructionsModal from './ProjectInstructionsModal'
import GlassSegmented from '@/components/ui/GlassSegmented'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { useChatStore } from '@/store/chatStore'
import { motion, AnimatePresence } from '@/lib/gsapMotion'
import { CorphiaLogo, CorphiaWordmark } from '@/components/icons/CorphiaIcons'
import { SidebarIcon } from './ChatIcons'
import ConversationRow from './ConversationRow'
import Tooltip from '@/components/ui/Tooltip'

import type { Conversation } from '@/types/chat'
import { DEFAULT_FOLDER } from '../hooks/chatHelpers'
import { pageSlide } from '@/lib/motionPresets'
import ListLens from '@/components/ui/ListLens'
import SearchField from '@/components/ui/SearchField'
import { conversationsApi } from '@/api/conversations'

/** 搜尋舊對話：打字後停多久才查（毫秒）、最多列幾筆 */
const SEARCH_DEBOUNCE_MS = 250
const SEARCH_PAGE_SIZE = 50
import { MQ_DESKTOP, useMediaQuery } from '@/lib/useMediaQuery'

interface ChatSidebarProps {
    /** 對話列表 */
    conversations: Conversation[]
    /** 目前選取的對話 */
    currentConversationId: string | null
    /** 聊天模式 */
    chatMode: 'general' | 'project'
    setChatMode: (mode: 'general' | 'project') => void
    /** 資料夾 */
    savedFolders: string[]
    selectedFolder: string | null
    expandedFolders: Set<string>
    setExpandedFolders: React.Dispatch<React.SetStateAction<Set<string>>>
    /** 動作 */
    selectConversation: (conv: Conversation) => void
    createNewConversation: () => void
    createConvInFolder: (folderName: string, e: React.MouseEvent) => void
    handleDeleteFolder: (folderName: string, e: React.MouseEvent) => void
    handleOpenMenu: (e: React.MouseEvent, convId: string) => void
    closeMenu: () => void
    setSelectedFolder: (folder: string | null) => void
    openNewFolderModal: () => void
    /** 選單下拉是否開啟 */
    activeMenuConvId: string | null
}

export default function ChatSidebar({
    conversations,
    currentConversationId,
    chatMode,
    setChatMode,
    savedFolders,
    selectedFolder,
    expandedFolders,
    setExpandedFolders,
    selectConversation,
    createNewConversation,
    createConvInFolder,
    handleDeleteFolder,
    handleOpenMenu,
    closeMenu,
    setSelectedFolder,
    openNewFolderModal,
    activeMenuConvId,
}: ChatSidebarProps) {
    const { t } = useTranslation()
    const { user } = useAuthStore()
    const { sidebarOpen, toggleSidebar, setSidebarOpen, setSettingsOpen } = useUIStore()

    const [isSidebarHovered, setIsSidebarHovered] = useState(false)

    // 對話列的 DOM 參考（捲動到目前對話用）
    // 長按對話列 0.32 秒直接拉出選單（不用先找右邊的「⋯」）；移動超過 6px 視為捲動，取消長按
    const longPress = useRef<{ timer: number; x: number; y: number; pid: number; fired: boolean } | null>(null)
    const pressHandlers = (convId: string) => ({
        onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
            if (e.button > 0) return
            const row = e.currentTarget
            const x = e.clientX, y = e.clientY
            const pid = e.pointerId
            longPress.current = {
                x, y, pid, fired: false,
                timer: window.setTimeout(() => {
                    if (!longPress.current) return
                    longPress.current.fired = true
                    // 手指還按著：交給選單接手，不放開直接滑到項目上＝放大鏡選取
                    beginMenuDrag({ pointerId: pid, clientX: x, clientY: y, button: 0 }, { trigger: row, close: closeMenu })
                    const anchorEl = row.querySelector<HTMLElement>('button[data-conv-menu]') || row
                    handleOpenMenu({ stopPropagation() {}, currentTarget: anchorEl } as unknown as React.MouseEvent, convId)
                }, 320),
            }
        },
        onPointerMove: (e: React.PointerEvent) => {
            const lp = longPress.current
            if (lp && !lp.fired && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 6) { clearTimeout(lp.timer); longPress.current = null }
        },
        onPointerUp: () => { const lp = longPress.current; if (lp && !lp.fired) { clearTimeout(lp.timer); longPress.current = null } },
        onPointerCancel: () => { const lp = longPress.current; if (lp) clearTimeout(lp.timer); longPress.current = null },
        onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    })
    // 「⋯」按下就打開選單；不放開直接拖進選單＝放大鏡跟著手指、放開選取（lib/menuDrag，全站選單同一套）
    const menuTrigger = useMenuTrigger()
    const menuButtonProps = (convId: string) => {
        const tp = menuTrigger(activeMenuConvId === convId, (el) => handleOpenMenu({ stopPropagation() {}, currentTarget: el } as unknown as React.MouseEvent, convId), closeMenu)
        return {
            ...tp,
            // 不要讓整列的長按計時也開始（按的是「⋯」）
            onPointerDown: (e: React.PointerEvent<HTMLElement>) => { e.stopPropagation(); tp.onPointerDown(e) },
        }
    }
    // 長按已經拉出選單時，放開不要再當成「點一下選取對話」
    const consumeLongPress = () => {
        if (longPress.current?.fired) { longPress.current = null; return true }
        return false
    }
    // 收合／展開＝變形（不是淡入淡出）：外框寬度、切換軌道（橫↔直）、新對話鈕（膠囊↔圓鈕）、頭像列同時過渡 0.3 秒
    //   每個元件都固定在左邊同一個位置，只有寬高在變；文字被收進去
    const desktop = useMediaQuery(MQ_DESKTOP)
    // 視窗從電腦寬度縮成手機寬度（縮小桌面版視窗、摺疊手機闔上）：原本展開的側欄會變成蓋住整個畫面的抽屜，
    // 而且開關按鈕在抽屜開著時是隱藏的——使用者會卡住。變窄的那一刻自動收起來
    const wasDesktop = useRef(desktop)
    useEffect(() => {
        if (wasDesktop.current && !desktop && useUIStore.getState().sidebarOpen) useUIStore.getState().setSidebarOpen(false)
        wasDesktop.current = desktop
    }, [desktop])
    const wide = sidebarOpen
    const itemRefs = useRef<Record<string, HTMLDivElement | null>>({})
    // 哪些對話正在生成（背景中的也算）→ 清單上顯示小圓點
    const streamingIds = useChatStore((s) => s.streamingIds)

    const renderRow = (conv: Conversation) => (
        <ConversationRow
            key={conv.id}
            conv={conv}
            isCurrent={!selectedFolder && currentConversationId === conv.id}
            isMenuOpen={activeMenuConvId === conv.id}
            isBusy={Boolean(streamingIds[conv.id])}
            rowRef={(el) => { itemRefs.current[conv.id] = el }}
            pressProps={pressHandlers(conv.id)}
            onSelect={() => { if (consumeLongPress()) return; selectConversation(conv) }}
            menuButtonProps={menuButtonProps(conv.id)}
        />
    )
    const listScrollRef = useScrollFade()

    // 搜尋舊對話：按清單標題右邊的放大鏡 → 標題那一列換成搜尋欄；打字後停一下才查（標題或訊息內容）
    const [searching, setSearching] = useState(false)
    const [query, setQuery] = useState('')
    /** 查到的對話；null＝還沒有結果（剛開始打字、或沒在搜尋） */
    const [found, setFound] = useState<Conversation[] | null>(null)
    /** 這次查詢失敗了（連線問題）：要和「找不到」分開說，不然使用者會以為真的沒有 */
    const [searchFailed, setSearchFailed] = useState(false)
    const searchRef = useRef<HTMLInputElement>(null)
    useEffect(() => { if (searching) searchRef.current?.focus() }, [searching])
    useEffect(() => {
        const q = query.trim()
        if (!searching || !q) { setFound(null); setSearchFailed(false); return }
        let stale = false
        const id = window.setTimeout(() => {
            conversationsApi.list(1, SEARCH_PAGE_SIZE, q)
                .then((r) => { if (!stale) { setFound(r.data.filter((c) => !c.settings?.isProject)); setSearchFailed(false) } })
                .catch(() => { if (!stale) { setFound([]); setSearchFailed(true) } })
        }, SEARCH_DEBOUNCE_MS)
        return () => { stale = true; window.clearTimeout(id) }
    }, [searching, query])
    const closeSearch = () => { setSearching(false); setQuery('') }

    // 專案指示：正在設定哪一個專案資料夾（null＝沒開）
    const [instructionsFolder, setInstructionsFolder] = useState<string | null>(null)

    return (
        <aside
            // 手機上收起的側欄只是移到畫面外：設成 inert，鍵盤和讀螢幕軟體才不會走到看不見的按鈕
            inert={!desktop && !sidebarOpen}
            className={`${sidebarOpen 
                ? 'w-[75vw] max-w-[var(--sz-260)] md:w-[var(--sz-280)] translate-x-0' 
                : 'w-[75vw] max-w-[var(--sz-260)] md:w-[var(--sz-72)] -translate-x-full md:translate-x-0'
                } paper ${sidebarOpen ? 'md:rounded-[var(--r-36)]' : 'rail-capsule md:rounded-[var(--r-36)]'} transition-[width,transform] duration-300 ease-apple shrink-0 flex flex-col overflow-hidden z-50 absolute md:relative h-full chat-side md:h-[calc(100%-2*var(--sp-16))] md:my-4 md:ml-4`}
        >
                        <div className="flex flex-col h-full min-h-0 w-full shrink-0">
            {/* 側邊欄頂部 Header (Logo + 收合按鈕) */}
            {/* 收合時固定排在最左邊 72 寬的範圍裡置中：寬度縮的過程中位置不動（往左收合，不會先置中再移動） */}
            <div className={`flex items-center p-4 pb-1 h-[var(--sz-60)] shrink-0 transition-opacity duration-300 ${wide ? 'w-full justify-between md:pr-[var(--sp-16)]' : 'w-full md:w-[var(--sz-72)] justify-center md:px-0'}`}>
                {/* 品牌圖示：展開時的位置和收合時一致（圖示中心離側欄左緣 36＝收合直條的正中間） */}
                {/* 展開＝完整字標（C 星芒＋orphia，星星跟強調色）；收合＝只剩右邊按鈕上的 C 星芒（下方 CorphiaLogo） */}
                {wide && (
                    <div className="flex items-center min-w-0 mr-2 md:ml-[var(--sp-12)]">
                        {/* 字標圖片下方留了 p 的下伸空間：負邊距讓看得到的字和右邊的收合鈕上下置中 */}
                        <span className="-mt-[var(--sp-2)] -mb-[var(--sp-14)] flex">
                            <CorphiaWordmark className="h-[var(--sz-44)] w-auto object-contain object-left pointer-events-none select-none" />
                        </span>
                        <span className="sr-only">Corphia</span>
                    </div>
                )}
                <button
                        onClick={toggleSidebar}
                        aria-label={sidebarOpen ? t('ui.sidebar.collapse') : t('ui.sidebar.expand')}
                        // 只有滑鼠移入才換成「展開」圖示；手指點的時候不換，不然 iPhone 會把第一下當成懸停、要點兩下才打開
                        onPointerEnter={(e) => { if (e.pointerType === 'mouse') setIsSidebarHovered(true) }}
                        onPointerLeave={(e) => { if (e.pointerType === 'mouse') setIsSidebarHovered(false) }}
                        className="btn-icon btn-icon-plain !hidden md:!inline-flex !w-11 !h-11 text-text-secondary"
                    >
                    {wide || isSidebarHovered ? (
                        <SidebarIcon className="w-[var(--sz-20)] h-[var(--sz-20)]" />
                    ) : (
                        <CorphiaLogo className="!w-[var(--sz-28)] !h-[var(--sz-28)] shrink-0 rounded-full overflow-hidden text-text-primary" />
                    )}
                    </button>
            </div>

            {/* 頂端控制區（包含新對話按鈕與切換器） */}
            <div className="w-full px-[var(--sp-14)] py-4 flex flex-col items-start gap-4">
                
                {/* 一般 / 專案 切換膠囊 (比照 Login.tsx)
                  容器底色：
                    - light：bg-black/5 → 5% 黑，輕微陰影感
                    - dark： 原本是 bg-black/20，比 sidebar 底色暗一截，
                            視覺上會出現一塊深色方塊，跟 sidebar 不融合
                            → 改用 bg-white/5（在深色面板上加一層淡白），
                              跟 sidebar 同色階更柔和，但仍保留可見的容器邊界
                */}
                <div
                    className="side-morph shrink-0"
                    style={{ width: wide ? 232 : 50, height: wide ? 44 : 110, marginLeft: wide ? 0 : -3 }}
                >
                    <GlassSegmented
                        vertical={!wide}
                        data-tour="mode-toggle"
                        className="w-full h-full"
                        pad={wide ? '--seg-pad-lg' : '--seg-pad-xs'}
                        growLong={wide ? '--lens-over' : '--lens-over-x'}
                        growCross={wide ? '--lens-over' : '--lens-over-y'}
                        value={chatMode}
                        onChange={(v) => setChatMode(v)}
                        options={wide ? [
                            { value: 'general', label: t('chat.general') },
                            { value: 'project', label: t('chat.project') },
                        ] : [
                            { value: 'general', name: t('chat.general'), label: <MessageSquare className="w-[var(--sz-27)] h-[var(--sz-27)]" strokeWidth={1.6} /> },
                            { value: 'project', name: t('chat.project'), label: <Folder className="w-[var(--sz-27)] h-[var(--sz-27)]" strokeWidth={1.6} /> },
                        ]}
                    />
                </div>

                {/* 新對話 / 新資料夾 按鈕 (比照 Login.tsx 的 Input) */}
                <button
                    data-tour="new-chat"
                    onClick={() => {
                        if (chatMode === 'project') {
                            openNewFolderModal()
                        } else {
                            createNewConversation()
                        }
                    }}
                    aria-label={chatMode === 'project' ? t('chat.newFolder') : t('chat.newChat')}
                    className="side-morph relative flex items-center h-[var(--sz-44)] pl-[var(--sp-8)] gap-3 rounded-full overflow-hidden shrink-0 bg-accent-fill text-text-on-accent"
                    style={{ width: wide ? 232 : 44 }}
                >
                    <div className="w-[var(--sz-28)] h-[var(--sz-28)] rounded-full flex items-center justify-center shrink-0 bg-transparent text-[#F6F4F0]">
                        <Plus className="w-[var(--sz-20)] h-[var(--sz-20)]" />
                    </div>
                    <span className="whitespace-nowrap font-medium text-[length:var(--fs-15)] leading-none text-[#F6F4F0]">{chatMode === 'project' ? t('chat.newFolder') : t('chat.newChat')}</span>
                </button>
            </div>

            {/* 對話列表 — overflow-x-hidden 避免長資料夾名稱撐出水平捲軸 */}
            {/* 標題（一般聊天／專案資料夾）固定不動，只有下面的清單捲動 */}
            <div className={`flex-1 min-h-0 mt-2 w-full relative overflow-hidden transition-opacity duration-300 ${wide ? 'opacity-100' : 'hidden'}`}>
                {/*
                  共享飄浮選取膠囊：absolute 定位在 scroll container 裡，跟著
                  currentConversationId 對應的 item（可能在 general 清單或 project
                  資料夾內）滑動。general/project 兩個 motion.div 是兄弟節點，
                  把膠囊放外層當共同背景，切換 tab 時膠囊會直接從舊位置滑到新位置。

                  Top + Left 都是動態的（基於 item.getBoundingClientRect()）：
                  - General 對話：bubble 在 ~24px 處（motion.div px-4 + list px-2）
                  - Project 巢狀：bubble 在 ~48px 處（再加上 ml-3 + pl-3 縮排）
                  膠囊 left = item 左邊緣 - 6px，視覺上是獨立的小膠囊「黏」在 bubble 左側。
                  rounded-full（兩端圓）讓它變成真正的 pill shape，不是 rounded-r 的半邊。
                */}
                <AnimatePresence mode="wait">
                    {chatMode === 'general' ? (
                        <motion.div
                            key="general"
                            {...pageSlide(-1)}
                            className="absolute inset-0 px-4 flex flex-col"
                        >
                            {searching ? (
                                // 搜尋中：標題那一列換成搜尋欄。清空後失去焦點、或空的時候按 Esc＝結束搜尋
                                <div className="shrink-0 mb-[var(--sp-8)]" onBlur={() => { if (!query.trim()) closeSearch() }}>
                                    <SearchField
                                        ref={searchRef}
                                        value={query}
                                        onChange={setQuery}
                                        placeholder={t('chat.searchPlaceholder')}
                                        label={t('chat.searchChats')}
                                        onKeyDown={(e) => { if (e.key === 'Escape' && !query) { e.preventDefault(); closeSearch() } }}
                                    />
                                </div>
                            ) : (
                                <div className="flex items-center shrink-0">
                                    <span className="side-header flex-1 min-w-0">{t('chat.generalChat')}</span>
                                    <Tooltip label={t('chat.searchChats')}>
                                        <button type="button" onClick={() => setSearching(true)} aria-label={t('chat.searchChats')} className="icon-tap text-text-secondary mr-[var(--sp-2)]">
                                            <Search className="h-4 w-4" />
                                        </button>
                                    </Tooltip>
                                </div>
                            )}
                            <div ref={listScrollRef} className="glass-scroll relative lens-list flex-1 min-h-0 -mx-4 px-4 pb-[var(--sp-8)] space-y-0.5">
                                <ListLens watch={`${selectedFolder ?? ''}|${currentConversationId ?? ''}`} />
                                {(() => {
                                    const note = (text: string) => <p className="text-text-secondary text-[length:var(--fs-13)] py-3 px-[var(--sp-10)]">{text}</p>
                                    // 搜尋中且已經打了字：顯示查到的對話（還在查就先留白，不閃「找不到」）
                                    if (searching && query.trim()) {
                                        if (found === null) return null
                                        if (searchFailed) return note(t('chat.searchFailed'))
                                        return found.length === 0 ? note(t('chat.searchEmpty')) : found.map(renderRow)
                                    }
                                    const filtered = conversations.filter(c => !c.settings?.isProject)
                                    return filtered.length === 0 ? note(t('chat.noChats')) : filtered.map(renderRow)
                                })()}
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="project"
                            {...pageSlide(1)}
                            className="absolute inset-0 px-4 flex flex-col"
                        >
                            <span className="side-header shrink-0">{t('chat.projectFolderLabel')}</span>
                            <div ref={listScrollRef} className="glass-scroll relative lens-list flex-1 min-h-0 -mx-4 px-4 pb-[var(--sp-8)]">
                                <ListLens watch={`${selectedFolder ?? ''}|${currentConversationId ?? ''}`} />
                            {(() => {
                                const convFolders = conversations
                                    .filter(c => Boolean(c.settings?.isProject))
                                    .map(c => (c.settings?.folderName as string) || DEFAULT_FOLDER)
                                const allFolders = Array.from(new Set([...savedFolders, ...convFolders]))

                                if (allFolders.length === 0) {
                                    return (
                                        <p className="text-text-secondary text-[length:var(--fs-13)] py-3 px-[var(--sp-10)]">{t('chat.noProjects')}</p>
                                    )
                                }

                                const grouped: Record<string, typeof conversations> = {}
                                conversations
                                    .filter(c => Boolean(c.settings?.isProject))
                                    .forEach(conv => {
                                        const folder = (conv.settings?.folderName as string) || DEFAULT_FOLDER
                                        if (!grouped[folder]) grouped[folder] = []
                                        grouped[folder].push(conv)
                                    })

                                return (
                                    <div className="space-y-0.5">
                                        {allFolders.map((folderName) => {
                                            const isExpanded = expandedFolders.has(folderName)
                                            return (
                                                <div key={folderName} className="flex flex-col">
                                                    {/* 資料夾列（沒有展開箭頭）：點一下選取並展開；再點一次已選取的資料夾就收合 */}
                                                    <div
                                                        onClick={() => {
                                                            // 切換到資料夾管理視圖；
                                                            // 注意：不清掉 currentConversation，這樣在背景串流中的對話可以繼續，
                                                            // 使用者切回該對話時不會中斷 AI 思考。
                                                            if (selectedFolder === folderName) {
                                                                // 再點一次：收合；收合中就展開，並收起其他資料夾（一次只展開一個）
                                                                setExpandedFolders(prev => (prev.has(folderName) ? new Set() : new Set([folderName])))
                                                                return
                                                            }
                                                            setSelectedFolder(folderName)
                                                            // 點到別的資料夾：只展開這一個，其他的自動收起
                                                            setExpandedFolders(new Set([folderName]))
                                                            if (!desktop) setSidebarOpen(false)
                                                        }}
                                                        aria-expanded={isExpanded}
                                                        className={`side-item group ${selectedFolder === folderName ? 'is-current' : ''}`}
                                                    >
                                                        <Folder className="side-icon" />
                                                        <span className="flex-1 min-w-0 truncate">{folderName}</span>
                                                        <div className="side-actions hover-reveal gap-0.5">
                                                            <Tooltip label={t('ui.sidebar.newInFolder')}>
                                                                <button onClick={(e) => createConvInFolder(folderName, e)} aria-label={t('ui.sidebar.newInFolder')} className="icon-tap text-text-secondary">
                                                                    <Plus className="w-3.5 h-3.5" />
                                                                </button>
                                                            </Tooltip>
                                                            <Tooltip label={t('chat.instructionsTitle')}>
                                                                <button onClick={(e) => { e.stopPropagation(); setInstructionsFolder(folderName) }} aria-label={t('chat.instructionsTitle')} className="icon-tap text-text-secondary">
                                                                    <SlidersHorizontal className="w-3.5 h-3.5" />
                                                                </button>
                                                            </Tooltip>
                                                            <Tooltip label={t('ui.sidebar.deleteFolder')}>
                                                                <button onClick={(e) => handleDeleteFolder(folderName, e)} aria-label={t('ui.sidebar.deleteFolder')} className="icon-tap text-text-secondary">
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </Tooltip>
                                                        </div>
                                                    </div>

                                                    {/* 子對話：縮排到資料夾名稱的起點（Apple 側欄），不畫導引線；展開／收合有高度動畫 */}
                                                    <div className={`side-collapse ${isExpanded ? 'is-open' : ''}`} aria-hidden={!isExpanded}>
                                                        <div className="side-children space-y-0.5">
                                                            {(grouped[folderName] || []).map((conv) => (
                                                                <div key={conv.id} className="relative">
                                                                    {renderRow(conv)}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )
                            })()}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* 底部：使用者卡片 */}
            <div className="w-full px-[var(--sp-14)] pb-[var(--sp-14)] mt-auto flex flex-col items-start">
                
                    <button
                        data-tour="settings-button"
                        // 手機：先收起側欄再開設定，關掉設定（或從後台回來）時看到的是對話，不是蓋住畫面的側欄
                        onClick={() => { if (!desktop) setSidebarOpen(false); setSettingsOpen(true) }}
                        aria-label={user?.name || user?.email || t('settings.title')}
                        className="side-morph relative flex items-center h-[var(--sz-44)] pl-[var(--sp-6)] gap-3 rounded-full overflow-hidden shrink-0 text-left bg-transparent"
                        style={{ width: wide ? 232 : 44 }}
                    >
                    <div className="w-[var(--sz-32)] h-[var(--sz-32)] rounded-full bg-accent-fill text-text-on-accent flex items-center justify-center shrink-0 font-bold text-[length:var(--fs-14)]">
                        {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    {(
                        <div className="flex-1 min-w-0">
                            {/*
                              fallback 從「Local User」改成 email → 「…」。
                              理由：「Local User」會誤導使用者以為系統有這個帳號（其實是 user
                              物件 race condition / refresh bug 導致暫時 null）。
                              優先順序：name → email → 「…」（載入中佔位）
                            */}
                            <p className="font-semibold text-[length:var(--fs-14)] text-text-primary truncate text-left m-0 leading-snug">
                                {user?.name || user?.email || '…'}
                            </p>
                        </div>
                    )}
                    </button>
                
            </div>
            </div>
            <ProjectInstructionsModal folder={instructionsFolder} onClose={() => setInstructionsFolder(null)} />
        </aside>
    )
}
