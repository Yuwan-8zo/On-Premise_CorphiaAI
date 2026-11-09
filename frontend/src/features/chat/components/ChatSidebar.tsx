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

import { ChevronRight, Folder, MessageSquare, MoreHorizontal, Plus, Trash2 } from '@/components/snow/icons'
import GlassSegmented from '@/components/ui/GlassSegmented'
import { useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { motion, AnimatePresence } from '@/lib/gsapMotion'
import { CorphiaLogo } from '@/components/icons/CorphiaIcons'
import { SidebarIcon } from './ChatIcons'
import Tooltip from '@/components/ui/Tooltip'

// 預設資料夾名稱常數
const DEFAULT_FOLDER = '新資料夾'

interface ChatSidebarProps {
    /** 對話列表 */
    conversations: Array<{
        id: string
        title: string
        settings?: Record<string, unknown>
    }>
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
    selectConversation: (conv: { id: string; title: string; settings?: Record<string, unknown> }) => void
    createNewConversation: () => void
    createConvInFolder: (folderName: string, e: React.MouseEvent) => void
    handleDeleteFolder: (folderName: string, e: React.MouseEvent) => void
    handleOpenMenu: (e: React.MouseEvent, convId: string) => void
    setSelectedFolder: (folder: string | null) => void
    setCurrentConversation: (conv: null) => void
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
    setCurrentConversation,
    openNewFolderModal,
    activeMenuConvId,
}: ChatSidebarProps) {
    const { t } = useTranslation()
    const { user } = useAuthStore()
    const { sidebarOpen, toggleSidebar, setSidebarOpen, setSettingsOpen } = useUIStore()

    const [isSidebarHovered, setIsSidebarHovered] = useState(false)

    /*
     * 「飄浮選取膠囊」狀態
     * ─────────────────────────────────────────────────────────────
     * 原本每個 item 自帶 ::before 偽元素當左側藍色短線，切換對話時是「啪」
     * 一下換到下一個 item，沒有平移動畫。改成 scroll 容器裡放一個 absolute
     * 定位的單一膠囊，依當前 currentConversationId 對應 item 的位置滑動。
     *
     * 為什麼用 scroll 容器而不是 list 容器：
     *   - General 跟 Project 兩個 tab 是 motion.div 切換的兄弟節點
     *   - Project 模式下對話又巢狀在資料夾的展開區
     *   - 把膠囊提升到「最近的共同祖先」 = scroll container
     *     兩種模式都能共用同一顆膠囊
     *
     * 為什麼用 getBoundingClientRect + scrollTop：
     *   - offsetTop 走 offsetParent 鏈，巢狀 motion.div + 多層 div 計算麻煩
     *   - getBoundingClientRect 給絕對視窗座標，差一下就是相對位置，乾淨
     *   - 加 scrollTop 補上「已捲動」量 → 膠囊定位在 scroll-content 的絕對位置，
     *     列表捲動時膠囊會一起被推上去，不需要監聽 scroll 事件
     */
    const itemRefs = useRef<Record<string, HTMLDivElement | null>>({})
    const scrollRef = useRef<HTMLDivElement>(null)
    const [activePillTop, setActivePillTop] = useState(0)
    const [activePillLeft, setActivePillLeft] = useState(0)
    const [activePillHeight, setActivePillHeight] = useState(0)
    const [pillVisible, setPillVisible] = useState(false)

    useLayoutEffect(() => {
        // 取出計算邏輯成一個函式，可被多個觸發點重用：
        //   1) effect deps 變化（initial run）
        //   2) requestAnimationFrame 在 paint 後再算一次（catch layout shift）
        //   3) ResizeObserver 偵測到 list 容器 / item 高度變化
        //
        // 為什麼需要多次算：useLayoutEffect 在 commit 後跑，但這時瀏覽器還沒做完整 layout pass。
        // 新對話被 prepend 時，舊對話 DOM 被 React 用 insertBefore 移動，但 getBoundingClientRect
        // 在某些瀏覽器（特別是 Chrome 跟 Safari）會回傳「移動前的快照值」 → 膠囊定到錯位置。
        // 補一次 rAF callback，在 paint 前再算 → 拿到 settle 後的真實值。
        const compute = () => {
            if (!currentConversationId) {
                setPillVisible(false)
                return
            }
            const el = itemRefs.current[currentConversationId]
            const scroll = scrollRef.current
            if (!el || !scroll) {
                setPillVisible(false)
                return
            }
            const elRect = el.getBoundingClientRect()
            // 高度 0 通常表示元素被 display:none 或 unmount 中（折疊資料夾、切換 tab 中）
            if (elRect.height === 0) {
                setPillVisible(false)
                return
            }
            const scrollRect = scroll.getBoundingClientRect()
            const itemH = elRect.height
            // 膠囊高度 = item 高度的 50%，最小 16px（避免太矮）
            const pillH = Math.max(16, itemH * 0.5)
            const visibleTop = elRect.top - scrollRect.top
            const visibleLeft = elRect.left - scrollRect.left
            const top = visibleTop + scroll.scrollTop + (itemH - pillH) / 2
            // 膠囊靠在 item 左邊緣往左 6px：剛好「貼著但不疊到 rounded-[14px] 圓角」，
            // 視覺上是獨立的 indicator，又不會跟 bubble 距離過遠。
            const left = visibleLeft + scroll.scrollLeft - 6
            setActivePillTop(top)
            setActivePillLeft(left)
            setActivePillHeight(pillH)
            setPillVisible(true)
        }

        // Pass 1：立刻算（initial / dep change）
        compute()
        // Pass 2：rAF 後再算，捕捉新增對話時 React reorder DOM 帶來的 layout shift
        const rafId = requestAnimationFrame(() => {
            compute()
            // Pass 3：再 rAF 一次，給 motion.div / transition 完整一個 frame settle
            requestAnimationFrame(compute)
        })

        // ResizeObserver：當 scroll 容器尺寸或內容尺寸變動時也重算
        // （視窗 resize、items 增減、長標題換行等）
        const scroll = scrollRef.current
        let ro: ResizeObserver | null = null
        if (scroll && typeof ResizeObserver !== 'undefined') {
            ro = new ResizeObserver(() => compute())
            ro.observe(scroll)
            // 也觀察當前 active item，捕捉其本身高度變化（例如 hover 動畫導致高度微變）
            const activeEl = currentConversationId
                ? itemRefs.current[currentConversationId]
                : null
            if (activeEl) ro.observe(activeEl)
        }

        // 切換一般／專案時清單會從旁邊滑入（約 0.3 秒），側邊欄開合也有 0.3 秒動畫；
        // 動畫中量到的位置會偏移，所以在動畫結束後再量一次，避免直線疊到文字上
        const timers = [350, 700].map(ms => window.setTimeout(compute, ms))
        const aside = scroll?.closest('aside')
        const onAnimEnd = () => compute()
        aside?.addEventListener('transitionend', onAnimEnd)
        aside?.addEventListener('animationend', onAnimEnd)

        return () => {
            cancelAnimationFrame(rafId)
            timers.forEach(id => window.clearTimeout(id))
            aside?.removeEventListener('transitionend', onAnimEnd)
            aside?.removeEventListener('animationend', onAnimEnd)
            ro?.disconnect()
        }
    }, [currentConversationId, conversations, chatMode, expandedFolders, sidebarOpen])

    return (
        <aside
            className={`${sidebarOpen 
                ? 'w-[75vw] max-w-[260px] md:w-[280px] translate-x-0' 
                : 'w-[75vw] max-w-[260px] md:w-[72px] -translate-x-full md:translate-x-0'
                } paper rounded-l-none ${sidebarOpen ? 'md:rounded-[35px]' : 'rail-capsule md:rounded-[36px]'} transition-[width,transform] duration-300 ease-in-out shrink-0 flex flex-col z-50 absolute md:relative h-full md:h-[calc(100vh-32px)] md:my-4 md:ml-4`}
        >
            {/* 側邊欄頂部 Header (Logo + 收合按鈕) */}
            <div className={`flex items-center w-full p-4 pb-1 h-[60px] shrink-0 transition-opacity duration-300 ${sidebarOpen ? 'justify-between' : 'justify-center md:px-0'}`}>
                <div className={`flex items-center overflow-hidden transition-all duration-300 ${sidebarOpen ? 'w-10 opacity-100 mr-2 md:w-10 md:px-1' : 'w-10 opacity-100 mr-2 md:w-0 md:opacity-0 md:mr-0 md:px-0'}`}>
                    <CorphiaLogo className="w-8 h-8 shrink-0 rounded-[7px] md:rounded-full overflow-hidden text-text-primary" />
                </div>
                <Tooltip label={sidebarOpen ?"收合側邊欄" :"開啟側邊欄"}>
                    <button
                        onClick={toggleSidebar}
                        onMouseEnter={() => setIsSidebarHovered(true)}
                        onMouseLeave={() => setIsSidebarHovered(false)}
                        className="btn-icon btn-icon-plain hidden md:inline-flex !w-11 !h-11 text-text-secondary"
                    >
                    {sidebarOpen || isSidebarHovered ? (
                        <SidebarIcon className="w-[20px] h-[20px]" />
                    ) : (
                        <CorphiaLogo className="w-[30px] h-[30px] rounded-[7px] text-text-primary" />
                    )}
                    </button>
                </Tooltip>
            </div>

            {/* 頂端控制區（包含新對話按鈕與切換器） */}
            <div className={`w-full transition-all duration-300 lg:p-4 p-3 flex flex-col gap-4 py-4 ${!sidebarOpen ? 'items-center' : ''}`}>
                
                {/* 一般 / 專案 切換膠囊 (比照 Login.tsx)
                  容器底色：
                    - light：bg-black/5 → 5% 黑，輕微陰影感
                    - dark： 原本是 bg-black/20，比 sidebar 底色暗一截，
                            視覺上會出現一塊深色方塊，跟 sidebar 不融合
                            → 改用 bg-white/5（在深色面板上加一層淡白），
                              跟 sidebar 同色階更柔和，但仍保留可見的容器邊界
                */}
                {sidebarOpen ? (
                    <GlassSegmented
                        data-tour="mode-toggle"
                        className="w-full shrink-0 h-[44px]"
                        pad={5}
                        value={chatMode}
                        onChange={(v) => setChatMode(v)}
                        options={[
                            { value: 'general', label: t('chat.general') },
                            { value: 'project', label: t('chat.project') },
                        ]}
                    />
                ) : (
                    <div
                        data-tour="mode-toggle"
                        className="seg-track relative rounded-full cursor-pointer shrink-0"
                        style={{ width: '46px', height: '86px' }}
                        onClick={(e) => {
                            // 依點的位置決定模式（上半＝一般、下半＝專案），不要用「切換」：
                            // 否則已在專案模式時點專案圖示反而會切回一般
                            const rect = e.currentTarget.getBoundingClientRect()
                            const next = e.clientY - rect.top < rect.height / 2 ? 'general' : 'project'
                            setChatMode(next)
                            // 收合狀態下看不到資料夾清單；切到專案時自動展開側邊欄
                            if (next === 'project') setSidebarOpen(true)
                        }}
                    >
                        <div className="absolute snow-knob rounded-full"
                            style={{
                                width: '40px', height: '40px', top: '3px', left: '3px',
                                transform: `translateY(${chatMode === 'general' ? '0px' : '40px'})`,
                                transition: 'transform 0.55s cubic-bezier(0.23, 1, 0.32, 1)', zIndex: 1,
                            }}
                        />
                        <div className={`absolute flex items-center justify-center z-10 transition-colors duration-300 ${chatMode === 'general' ? 'text-text-primary ' : 'text-text-secondary '}`}
                            style={{ top: '3px', left: '3px', width: '40px', height: '40px' }}>
                            <MessageSquare className="w-[20px] h-[20px]" />
                        </div>
                        <div className={`absolute flex items-center justify-center z-10 transition-colors duration-300 ${chatMode === 'project' ? 'text-text-primary ' : 'text-text-secondary '}`}
                            style={{ top: '43px', left: '3px', width: '40px', height: '40px' }}>
                            <Folder className="w-[20px] h-[20px]" />
                        </div>
                    </div>
                )}

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
                    className={`relative flex items-center bg-accent border border-transparent text-text-on-accent transition-all  overflow-hidden group ${sidebarOpen ? 'w-full h-[44px] px-4 justify-start rounded-full gap-3' : 'w-12 h-12 justify-center rounded-full shrink-0 gap-0'}`}
                >
                    <div className="w-[28px] h-[28px] rounded-full flex items-center justify-center shrink-0 bg-transparent text-[#F6F4F0]">
                        <Plus className="w-[20px] h-[20px]" />
                    </div>
                    {sidebarOpen && (
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-[15px] truncate text-left m-0 leading-none text-[#F6F4F0]">{chatMode === 'project' ? t('chat.newFolder') : t('chat.newChat')}</p>
                        </div>
                    )}
                </button>
            </div>

            {/* 對話列表 — overflow-x-hidden 避免長資料夾名稱撐出水平捲軸 */}
            <div ref={scrollRef} className={`flex-1 overflow-y-auto overflow-x-hidden mt-2 custom-scrollbar w-full transition-opacity duration-300 relative ${sidebarOpen ? 'opacity-100 px-4' : 'opacity-0 px-0 overflow-hidden pointer-events-none'}`}>
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
                <div
                    aria-hidden
                    className="absolute z-[1] w-[3px] bg-accent rounded-full pointer-events-none"
                    style={{
                        top: 0,
                        left: 0,
                        height: activePillHeight,
                        transform: `translate(${activePillLeft}px, ${activePillTop}px)`,
                        opacity: pillVisible ? 1 : 0,
                        transition: 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1), height 220ms ease-out, opacity 200ms ease-out',
                    }}
                />
                <AnimatePresence mode="wait">
                    {chatMode === 'general' ? (
                        <motion.div
                            key="general"
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 20, opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            className="absolute inset-0 px-4"
                        >
                            <div className="mb-2 pl-3 mt-1">
                                <span className="text-[12px] text-text-secondary tracking-wider font-medium">{t('chat.generalChat')}</span>
                            </div>
                            <div className="space-y-1 transition-colors px-2">
                                {(() => {
                                    const filtered = conversations.filter(c => !c.settings?.isProject)
                                    if (filtered.length === 0) return <p className="text-text-muted text-[13px] py-4 pl-3">{t('chat.noChats')}</p>
                                    return filtered.map((conv) => (
                                        <div key={conv.id}
                                            ref={(el) => { itemRefs.current[conv.id] = el }}
                                            onClick={() => selectConversation(conv)}
                                            className={`relative w-full flex items-center justify-between text-left px-3 py-2.5 rounded-[14px] text-[14px] transition-colors group cursor-pointer ${currentConversationId === conv.id
                                                ? 'bg-[var(--chip)] text-text-primary font-semibold'
                                                : 'text-text-secondary  '}`}
                                        >
                                            <span className="truncate pr-2">{conv.title}</span>
                                            <div className={`flex items-center gap-1 transition-opacity ${activeMenuConvId === conv.id ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'}`}>
                                                <Tooltip label="選項">
                                                    <button onClick={(e) => handleOpenMenu(e, conv.id)}
                                                        className={`p-1.5 rounded-full  ${activeMenuConvId === conv.id ? 'bg-[var(--chip)] text-text-primary' : 'text-text-muted'}`}>
                                                        <MoreHorizontal className="w-4 h-4" />
                                                    </button>
                                                </Tooltip>
                                            </div>
                                        </div>
                                    ))
                                })()}
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="project"
                            initial={{ x: 20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -20, opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            className="absolute inset-0 px-4"
                        >
                            <div className="mb-2 pl-3 mt-1">
                                <span className="text-[12px] text-text-muted tracking-wider font-medium">{t('chat.projectFolderLabel')}</span>
                            </div>
                            {(() => {
                                const convFolders = conversations
                                    .filter(c => Boolean(c.settings?.isProject))
                                    .map(c => (c.settings?.folderName as string) || DEFAULT_FOLDER)
                                const allFolders = Array.from(new Set([...savedFolders, ...convFolders]))

                                if (allFolders.length === 0) {
                                    return (
                                        <div className="px-2 space-y-1 transition-colors">
                                            <p className="text-text-muted text-[13px] py-4 pl-3">{t('chat.noProjects')}</p>
                                        </div>
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
                                    <div className="px-2 space-y-2 mt-2">
                                        {allFolders.map((folderName) => {
                                            const isExpanded = expandedFolders.has(folderName)
                                            return (
                                                <div key={folderName} className="flex flex-col">
                                                    <div
                                                        onClick={() => {
                                                            // 切換到資料夾管理視圖；
                                                            // 注意：不清掉 currentConversation，這樣在背景串流中的對話可以繼續，
                                                            // 使用者切回該對話時不會中斷 AI 思考。
                                                            setSelectedFolder(folderName)
                                                            setExpandedFolders(prev => new Set(prev).add(folderName))
                                                            if (window.innerWidth < 768) setSidebarOpen(false)
                                                        }}
                                                        className={`flex items-center justify-between text-[14px] font-medium px-2 py-1.5 transition-colors cursor-pointer w-full text-left rounded-[10px] group ${selectedFolder === folderName ? 'bg-[var(--chip)] text-accent' : ' text-text-secondary '}`}
                                                    >
                                                        <div className="flex items-center gap-1 min-w-0">
                                                            <button onClick={(e) => { e.stopPropagation(); setExpandedFolders(prev => { const next = new Set(prev); if (next.has(folderName)) next.delete(folderName); else next.add(folderName); return next }) }}
                                                                className={`p-0.5 rounded-md  transition-colors ${isExpanded ? 'text-text-secondary' : 'text-text-muted'}`}>
                                                                <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                                                            </button>
                                                            <span className="truncate">{folderName}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                            <Tooltip label="在此資料夾新增對話">
                                                                <button onClick={(e) => createConvInFolder(folderName, e)} className="p-1 text-text-muted  rounded ">
                                                                    <Plus className="w-3.5 h-3.5" />
                                                                </button>
                                                            </Tooltip>
                                                            <Tooltip label="刪除資料夾及內容">
                                                                <button onClick={(e) => handleDeleteFolder(folderName, e)} className="p-1 text-text-muted  rounded ">
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </Tooltip>
                                                        </div>
                                                    </div>

                                                    {isExpanded && (
                                                        // 子對話清單：左邊加一條導引線，視覺上清楚「這些對話屬於上方那個資料夾」
                                                        // ml-3 對齊 chevron 中心；border-l 1px subtle；pl-3 給對話內容呼吸空間
                                                        <div className="ml-3 mt-1 pl-3 border-l border-[var(--paper-line)] space-y-0.5 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                                                            {(grouped[folderName] || []).map((conv) => (
                                                                <div key={conv.id} className="relative">
                                                                    <div
                                                                        ref={(el) => { itemRefs.current[conv.id] = el }}
                                                                        onClick={() => selectConversation(conv)}
                                                                        className={`relative w-full flex items-center justify-between text-left px-3 py-2 rounded-[14px] text-[13px] transition-colors group cursor-pointer border border-transparent ${currentConversationId === conv.id
                                                                            ? 'bg-[var(--chip)] text-text-primary font-semibold'
                                                                            : 'text-text-secondary  '}`}
                                                                    >
                                                                        <span className="truncate pr-2">{conv.title}</span>
                                                                        <div className={`flex items-center gap-1 transition-opacity ${activeMenuConvId === conv.id ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'}`}>
                                                                            <Tooltip label="選項">
                                                                                <button onClick={(e) => handleOpenMenu(e, conv.id)}
                                                                                    className={`p-1 rounded-full  ${activeMenuConvId === conv.id ? 'bg-[var(--chip)] text-text-primary' : 'text-text-muted'}`}>
                                                                                    <MoreHorizontal className="w-3.5 h-3.5" />
                                                                                </button>
                                                                            </Tooltip>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
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
            <div className={`w-full transition-all duration-300 p-3 mt-auto flex flex-col ${!sidebarOpen ? 'items-center' : ''}`}>
                <Tooltip label="前往設定">
                    <button
                        data-tour="settings-button"
                        onClick={() => setSettingsOpen(true)}
                        className={`relative flex items-center bg-transparent  transition-colors text-left overflow-hidden group ${sidebarOpen ? 'w-full px-3 py-2 justify-start rounded-full gap-3' : 'w-12 h-12 justify-center rounded-full shrink-0 gap-0'}`}
                    >
                    <div className="w-[32px] h-[32px] rounded-full bg-accent text-text-on-accent flex items-center justify-center shrink-0 font-bold text-[14px]">
                        {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    {sidebarOpen && (
                        <div className="flex-1 min-w-0">
                            {/*
                              fallback 從「Local User」改成 email → 「…」。
                              理由：「Local User」會誤導使用者以為系統有這個帳號（其實是 user
                              物件 race condition / refresh bug 導致暫時 null）。
                              優先順序：name → email → 「…」（載入中佔位）
                            */}
                            <p className="font-semibold text-[14px] text-text-primary truncate text-left m-0 leading-snug">
                                {user?.name || user?.email || '…'}
                            </p>
                        </div>
                    )}
                    </button>
                </Tooltip>
            </div>
        </aside>
    )
}
