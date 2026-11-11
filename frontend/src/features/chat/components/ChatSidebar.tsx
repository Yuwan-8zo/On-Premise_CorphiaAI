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

import { Folder, MessageSquare, Plus, Trash2 } from '@/components/snow/icons'
import GlassSegmented from '@/components/ui/GlassSegmented'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { useChatStore } from '@/store/chatStore'
import { motion, AnimatePresence } from '@/lib/gsapMotion'
import { CorphiaLogo } from '@/components/icons/CorphiaIcons'
import { SidebarIcon } from './ChatIcons'
import ConversationRow from './ConversationRow'
import Tooltip from '@/components/ui/Tooltip'

import type { Conversation } from '@/types/chat'
import { DEFAULT_FOLDER } from '../hooks/chatHelpers'

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
    const longPress = useRef<{ timer: number; x: number; y: number; fired: boolean } | null>(null)
    const pressHandlers = (convId: string) => ({
        onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
            if (e.button > 0) return
            const row = e.currentTarget
            const x = e.clientX, y = e.clientY
            longPress.current = {
                x, y, fired: false,
                timer: window.setTimeout(() => {
                    if (!longPress.current) return
                    longPress.current.fired = true
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
    // 「⋯」按下就打開選單；不放開直接拖到項目上放開＝執行那一項（規範右下選單：按住拖曳、放開選取）
    const dragOpenMenu = (e: React.PointerEvent<HTMLButtonElement>, convId: string) => {
        if (e.button > 0) return
        e.stopPropagation()
        handleOpenMenu(e as unknown as React.MouseEvent, convId)
        const x0 = e.clientX, y0 = e.clientY
        let dragged = false
        let last: Element | null = null
        const itemAt = (x: number, y: number) => document.elementFromPoint(x, y)?.closest('.menu-item') ?? null
        const onMove = (ev: PointerEvent) => {
            if (!dragged && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 6) dragged = true
            const it = itemAt(ev.clientX, ev.clientY)
            if (it !== last) { last?.classList.remove('is-pressed'); it?.classList.add('is-pressed'); last = it }
        }
        const onUp = (ev: PointerEvent) => {
            window.removeEventListener('pointermove', onMove)
            window.removeEventListener('pointerup', onUp)
            last?.classList.remove('is-pressed')
            if (!dragged) return
            const it = itemAt(ev.clientX, ev.clientY) as HTMLElement | null
            it?.click()
        }
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
    }
    // 長按已經拉出選單時，放開不要再當成「點一下選取對話」
    const consumeLongPress = () => {
        if (longPress.current?.fired) { longPress.current = null; return true }
        return false
    }
    // 收合／展開＝變形（不是淡入淡出）：外框寬度、切換軌道（橫↔直）、新對話鈕（膠囊↔圓鈕）、頭像列同時過渡 0.3 秒
    //   每個元件都固定在左邊同一個位置，只有寬高在變；文字被收進去
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
            onMenuPointerDown={(e) => dragOpenMenu(e, conv.id)}
        />
    )
    const scrollRef = useRef<HTMLDivElement>(null)

    return (
        <aside
            className={`${sidebarOpen 
                ? 'w-[75vw] max-w-[var(--sz-260)] md:w-[var(--sz-280)] translate-x-0' 
                : 'w-[75vw] max-w-[var(--sz-260)] md:w-[var(--sz-72)] -translate-x-full md:translate-x-0'
                } paper rounded-l-none ${sidebarOpen ? 'md:rounded-[var(--r-36)]' : 'rail-capsule md:rounded-[var(--r-36)]'} transition-[width,transform] duration-300 ease-apple shrink-0 flex flex-col overflow-hidden z-50 absolute md:relative h-full chat-side md:h-[calc(100%-2*var(--sp-16))] md:my-4 md:ml-4`}
        >
                        <div className="flex flex-col h-full min-h-0 w-full shrink-0">
            {/* 側邊欄頂部 Header (Logo + 收合按鈕) */}
            {/* 收合時固定排在最左邊 72 寬的範圍裡置中：寬度縮的過程中位置不動（往左收合，不會先置中再移動） */}
            <div className={`flex items-center p-4 pb-1 h-[var(--sz-60)] shrink-0 transition-opacity duration-300 ${wide ? 'w-full justify-between md:pr-[var(--sp-16)]' : 'w-full md:w-[var(--sz-72)] justify-center md:px-0'}`}>
                {/* 品牌圖示：展開時的位置和收合時一致（圖示中心離側欄左緣 36＝收合直條的正中間） */}
                <div className={`flex items-center overflow-hidden ${wide ? 'w-10 mr-2 md:w-auto md:ml-[var(--sp-8)] md:px-0' : 'w-10 mr-2 md:hidden'}`}>
                    <CorphiaLogo className="w-[var(--sz-28)] h-[var(--sz-28)] shrink-0 rounded-[var(--r-7)] md:rounded-full overflow-hidden text-text-primary" />
                </div>
                <button
                        onClick={toggleSidebar}
                        aria-label={sidebarOpen ? t('ui.sidebar.collapse') : t('ui.sidebar.expand')}
                        onMouseEnter={() => setIsSidebarHovered(true)}
                        onMouseLeave={() => setIsSidebarHovered(false)}
                        className="btn-icon btn-icon-plain hidden md:inline-flex !w-11 !h-11 text-text-secondary"
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
            <div ref={scrollRef} className={`flex-1 overflow-y-auto overflow-x-hidden mt-2 custom-scrollbar w-full transition-opacity duration-300 relative ${wide ? 'opacity-100 px-4' : 'hidden'}`}>
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
                            initial={{ x: -14, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 14, opacity: 0 }}
                            transition={{ duration: 0.42 }}
                            className="absolute inset-0 px-4"
                        >
                            <span className="side-header">{t('chat.generalChat')}</span>
                            <div className="space-y-0.5">
                                {(() => {
                                    const filtered = conversations.filter(c => !c.settings?.isProject)
                                    if (filtered.length === 0) return <p className="text-text-secondary text-[length:var(--fs-13)] py-3 px-[var(--sp-10)]">{t('chat.noChats')}</p>
                                    return filtered.map(renderRow)
                                })()}
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="project"
                            initial={{ x: 14, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -14, opacity: 0 }}
                            transition={{ duration: 0.42 }}
                            className="absolute inset-0 px-4"
                        >
                            <span className="side-header">{t('chat.projectFolderLabel')}</span>
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
                                                                setExpandedFolders(prev => { const next = new Set(prev); if (next.has(folderName)) next.delete(folderName); else next.add(folderName); return next })
                                                                return
                                                            }
                                                            setSelectedFolder(folderName)
                                                            setExpandedFolders(prev => new Set(prev).add(folderName))
                                                            if (window.innerWidth < 768) setSidebarOpen(false)
                                                        }}
                                                        aria-expanded={isExpanded}
                                                        className={`side-item group ${selectedFolder === folderName ? 'is-current' : ''}`}
                                                    >
                                                        <Folder className="side-icon" />
                                                        <span className="flex-1 min-w-0 truncate">{folderName}</span>
                                                        <div className="side-actions gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                            <Tooltip label={t('ui.sidebar.newInFolder')}>
                                                                <button onClick={(e) => createConvInFolder(folderName, e)} aria-label={t('ui.sidebar.newInFolder')} className="p-1.5 rounded-full text-text-secondary">
                                                                    <Plus className="w-3.5 h-3.5" />
                                                                </button>
                                                            </Tooltip>
                                                            <Tooltip label={t('ui.sidebar.deleteFolder')}>
                                                                <button onClick={(e) => handleDeleteFolder(folderName, e)} aria-label={t('ui.sidebar.deleteFolder')} className="p-1.5 rounded-full text-text-secondary">
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
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* 底部：使用者卡片 */}
            <div className="w-full px-[var(--sp-14)] pb-[var(--sp-14)] mt-auto flex flex-col items-start">
                
                    <button
                        data-tour="settings-button"
                        onClick={() => setSettingsOpen(true)}
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
        </aside>
    )
}
