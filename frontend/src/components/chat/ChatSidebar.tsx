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

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { motion } from 'framer-motion'
import { CorphiaLogo } from '../icons/CorphiaIcons'
import { SidebarIcon } from './ChatIcons'

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

    return (
        <aside
            className={`${sidebarOpen ? 'w-[75vw] max-w-[260px] md:w-[280px] translate-x-0' : 'w-0 -translate-x-full md:w-[72px] md:translate-x-0'
                } overflow-hidden bg-[#F5F3EF] dark:bg-corphia-obsidian rounded-r-[20px] md:rounded-[38px] md:border-r border-gray-200 dark:border-white/5 transition-[width,transform] duration-300 ease-in-out shrink-0 flex flex-col z-50 absolute md:relative h-full md:h-[calc(100vh-24px)] md:my-3 md:ml-3 shadow-sm dark:shadow-2xl dark:shadow-black`}
        >
            {/* 側邊欄頂部 Header (Logo + 收合按鈕) */}
            <div className={`flex items-center w-full p-4 pb-1 h-[60px] shrink-0 transition-opacity duration-300 ${sidebarOpen ? 'justify-between' : 'justify-center md:px-0'}`}>
                <div className={`flex items-center overflow-hidden transition-all duration-300 ${sidebarOpen ? 'w-10 opacity-100 mr-2 md:w-10 md:px-1' : 'w-10 opacity-100 mr-2 md:w-0 md:opacity-0 md:mr-0 md:px-0'}`}>
                    <CorphiaLogo className="w-8 h-8 shrink-0 rounded-[7px] md:rounded-full overflow-hidden" />
                </div>
                <button
                    onClick={toggleSidebar}
                    onMouseEnter={() => setIsSidebarHovered(true)}
                    onMouseLeave={() => setIsSidebarHovered(false)}
                    title={sidebarOpen ? "收合側邊欄" : "開啟側邊欄"}
                    className={`hidden md:flex rounded-full text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-white/5 transition-all duration-200 shrink-0 items-center justify-center ${
                        (!sidebarOpen && !isSidebarHovered) ? 'w-10 h-10 p-0' : 'w-10 h-10 p-2'
                    }`}
                >
                    {sidebarOpen || isSidebarHovered ? (
                        <SidebarIcon className="w-[20px] h-[20px]" />
                    ) : (
                        <CorphiaLogo className="w-[30px] h-[30px] rounded-[7px]" />
                    )}
                </button>
            </div>

            {/* 頂端控制區（包含新對話按鈕與切換器） */}
            <div className={`w-full transition-all duration-300 lg:p-4 p-3 flex flex-col gap-4 py-4 ${!sidebarOpen ? 'items-center' : ''}`}>
                
                {/* 一般 / 專案 切換膠囊 (比照 Login.tsx) */}
                {sidebarOpen ? (
                    <motion.div
                        layout
                        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                        className="relative flex rounded-full select-none cursor-pointer bg-[#EFECE7] dark:bg-[#120E0B] border border-transparent dark:border-white/5 transition-colors shrink-0 w-full"
                        style={{ padding: '5px' }}
                    >
                        <div
                            className="bg-white dark:bg-[#2A2420] shadow-sm rounded-full border border-gray-100 dark:border-white/5"
                            style={{
                                position: 'absolute', top: '5px',
                                left: chatMode === 'general' ? '5px' : 'calc(50% + 0px)',
                                width: 'calc(50% - 5px)', height: 'calc(100% - 10px)',
                                transition: 'left 0.55s cubic-bezier(0.23, 1, 0.32, 1)',
                                zIndex: 1,
                            }}
                        />
                        <button type="button" onClick={() => setChatMode('general')}
                            style={{ position: 'relative', zIndex: 2, WebkitTapHighlightColor: 'transparent' }}
                            className={`flex-1 py-1.5 text-[14px] text-center rounded-full font-semibold transition-colors duration-300 ${chatMode === 'general' ? 'text-corphia-ink dark:text-corphia-ivory' : 'text-corphia-warm-gray dark:text-gray-500 hover:text-corphia-ink dark:hover:text-gray-300'}`}
                        >{t('chat.general')}</button>
                        <button type="button" onClick={() => setChatMode('project')}
                            style={{ position: 'relative', zIndex: 2, WebkitTapHighlightColor: 'transparent' }}
                            className={`flex-1 py-1.5 text-[14px] text-center rounded-full font-semibold transition-colors duration-300 ${chatMode === 'project' ? 'text-corphia-ink dark:text-corphia-ivory' : 'text-corphia-warm-gray dark:text-gray-500 hover:text-corphia-ink dark:hover:text-gray-300'}`}
                        >{t('chat.project')}</button>
                    </motion.div>
                ) : (
                    <div 
                        className="relative bg-[#EFEAE4] dark:bg-[#120E0B] rounded-[24px] cursor-pointer shrink-0 transition-colors border border-transparent dark:border-white/5"
                        style={{ width: '48px', height: '88px' }}
                        onClick={() => setChatMode(chatMode === 'general' ? 'project' : 'general')}
                    >
                        <div className="absolute bg-white dark:bg-[#2A2420] rounded-full shadow-sm border border-gray-100 dark:border-white/5"
                            style={{
                                width: '40px', height: '40px', top: '3px', left: '3px',
                                transform: `translateY(${chatMode === 'general' ? '0px' : '40px'})`,
                                transition: 'transform 0.55s cubic-bezier(0.23, 1, 0.32, 1)', zIndex: 1,
                            }}
                        />
                        <div className={`absolute flex items-center justify-center z-10 transition-colors duration-300 ${chatMode === 'general' ? 'text-corphia-ink dark:text-corphia-ivory' : 'text-gray-500 dark:text-gray-500'}`}
                            style={{ top: '3px', left: '3px', width: '40px', height: '40px' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                        </div>
                        <div className={`absolute flex items-center justify-center z-10 transition-colors duration-300 ${chatMode === 'project' ? 'text-corphia-ink dark:text-corphia-ivory' : 'text-gray-500 dark:text-gray-500'}`}
                            style={{ top: '43px', left: '3px', width: '40px', height: '40px' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                        </div>
                    </div>
                )}

                {/* 新對話 / 新資料夾 按鈕 (比照 Login.tsx 的 Input) */}
                <button
                    onClick={() => {
                        if (chatMode === 'project') {
                            openNewFolderModal()
                        } else {
                            createNewConversation()
                        }
                    }}
                    className={`relative flex items-center bg-[#8B7355] dark:bg-[#8B7355] border border-transparent dark:border-ios-dark-gray3 text-[#FFFFFF] dark:text-[#FFFFFF] transition-all hover:bg-[#7A6348] dark:hover:bg-[#7A6348] overflow-hidden group ${sidebarOpen ? 'w-full px-4 py-2.5 justify-start rounded-full gap-3' : 'w-12 h-12 justify-center rounded-full shrink-0 gap-0'}`}
                >
                    <div className="w-[28px] h-[28px] rounded-full flex items-center justify-center shrink-0 bg-transparent text-[#FFFFFF]">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-[20px] h-[20px]">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                    </div>
                    {sidebarOpen && (
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-[15px] truncate text-left m-0 leading-none">{chatMode === 'project' ? t('chat.newFolder') : t('chat.newChat')}</p>
                        </div>
                    )}
                </button>
            </div>

            {/* 對話列表 */}
            <div className={`flex-1 overflow-y-auto mt-2 custom-scrollbar w-full transition-opacity duration-300 ${sidebarOpen ? 'opacity-100 px-4' : 'opacity-0 px-0 overflow-hidden pointer-events-none'}`}>
                {chatMode === 'general' ? (
                    <>
                        <div className="mb-2 pl-3 mt-1">
                            <span className="text-[12px] text-gray-500 tracking-wider font-medium">{t('chat.generalChat')}</span>
                        </div>
                        <div className="space-y-1 transition-colors px-2">
                            {(() => {
                                const filtered = conversations.filter(c => !c.settings?.isProject)
                                if (filtered.length === 0) return <p className="text-gray-400 text-[13px] py-4 pl-3">{t('chat.noChats')}</p>
                                return filtered.map((conv) => (
                                    <div key={conv.id} onClick={() => selectConversation(conv)}
                                        className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-xl text-[14px] transition-colors group cursor-pointer ${currentConversationId === conv.id
                                            ? 'bg-[#EFEAE4] dark:bg-corphia-espresso text-[#8B7355] dark:text-corphia-ivory font-medium'
                                            : 'text-[#6B6B6B] dark:text-gray-400 hover:bg-[#EFEAE4] dark:hover:bg-ios-dark-gray5 hover:text-[#8B7355] dark:hover:text-gray-200'}`}
                                    >
                                        <span className="truncate pr-2">{conv.title}</span>
                                        <div className={`flex items-center gap-1 transition-opacity ${activeMenuConvId === conv.id ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'}`}>
                                            <button onClick={(e) => handleOpenMenu(e, conv.id)}
                                                className={`p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-ios-dark-gray3 ${activeMenuConvId === conv.id ? 'bg-gray-200 dark:bg-ios-dark-gray3 text-corphia-ink dark:text-corphia-ivory' : 'text-gray-400'}`}
                                                title="選項">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                ))
                            })()}
                        </div>
                    </>
                ) : (
                    <>
                        <div className="mb-2 pl-3 mt-1">
                            <span className="text-[12px] text-gray-400 dark:text-gray-500 tracking-wider font-medium">{t('chat.projectFolderLabel')}</span>
                        </div>
                        {(() => {
                            const convFolders = conversations
                                .filter(c => Boolean(c.settings?.isProject))
                                .map(c => (c.settings?.folderName as string) || DEFAULT_FOLDER)
                            const allFolders = Array.from(new Set([...savedFolders, ...convFolders]))

                            if (allFolders.length === 0) {
                                return (
                                    <div className="px-2 space-y-1 transition-colors">
                                        <p className="text-gray-400 text-[13px] py-4 pl-3">{t('chat.noProjects')}</p>
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
                                                        setSelectedFolder(folderName)
                                                        setCurrentConversation(null)
                                                        setExpandedFolders(prev => new Set(prev).add(folderName))
                                                        if (window.innerWidth < 768) setSidebarOpen(false)
                                                    }}
                                                    className={`flex items-center justify-between text-[14px] font-medium px-2 py-1.5 transition-colors cursor-pointer w-full text-left rounded-lg group ${selectedFolder === folderName ? 'bg-[#EFEAE4] dark:bg-ios-blue-dark/20 text-[#8B7355] dark:text-corphia-bronze' : 'hover:bg-[#EFEAE4] dark:hover:bg-ios-dark-gray5 text-[#6B6B6B] hover:text-[#8B7355] dark:text-gray-300'}`}
                                                >
                                                    <div className="flex items-center gap-1 min-w-0">
                                                        <button onClick={(e) => { e.stopPropagation(); setExpandedFolders(prev => { const next = new Set(prev); if (next.has(folderName)) next.delete(folderName); else next.add(folderName); return next }) }}
                                                            className={`p-0.5 rounded-md hover:bg-gray-200 dark:hover:bg-corphia-ivory/10 transition-colors ${isExpanded ? 'text-gray-600 dark:text-gray-400' : 'text-gray-400 dark:text-gray-500'}`}>
                                                            <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                                                        </button>
                                                        <span className="truncate">{folderName}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                        <button onClick={(e) => createConvInFolder(folderName, e)} className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-ios-dark-gray4" title="在此資料夾新增對話">
                                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                                                        </button>
                                                        <button onClick={(e) => handleDeleteFolder(folderName, e)} className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 dark:hover:bg-red-900/20" title="刪除資料夾及內容">
                                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        </button>
                                                    </div>
                                                </div>

                                                {isExpanded && (
                                                    <div className="pl-6 pr-1 mt-1 space-y-0.5 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                                                        {(grouped[folderName] || []).map((conv) => (
                                                            <div key={conv.id} className="relative">
                                                                <div onClick={() => selectConversation(conv)}
                                                                    className={`w-full flex items-center justify-between text-left px-3 py-1.5 rounded-xl text-[13px] transition-colors group cursor-pointer border border-transparent ${currentConversationId === conv.id
                                                                        ? 'bg-[#EFEAE4] dark:bg-corphia-espresso text-[#8B7355] dark:text-corphia-ivory font-medium border-transparent'
                                                                        : 'text-[#6B6B6B] dark:text-gray-400 hover:text-[#8B7355] dark:hover:text-gray-200 hover:bg-[#EFEAE4] dark:hover:bg-ios-dark-gray3'}`}
                                                                >
                                                                    <span className="truncate pr-2">{conv.title}</span>
                                                                    <div className={`flex items-center gap-1 transition-opacity ${activeMenuConvId === conv.id ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'}`}>
                                                                        <button onClick={(e) => handleOpenMenu(e, conv.id)}
                                                                            className={`p-1 rounded-full hover:bg-gray-200 dark:hover:bg-ios-dark-gray2 ${activeMenuConvId === conv.id ? 'bg-gray-200 dark:bg-ios-dark-gray2 text-corphia-ink dark:text-corphia-ivory' : 'text-gray-400'}`}
                                                                            title="選項">
                                                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" /></svg>
                                                                        </button>
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
                    </>
                )}
            </div>

            {/* 底部：使用者卡片 */}
            <div className={`w-full transition-all duration-300 p-3 mt-auto flex flex-col ${!sidebarOpen ? 'items-center' : ''}`}>
                <button 
                    onClick={() => setSettingsOpen(true)}
                    title="前往設定"
                    className={`relative flex items-center bg-transparent hover:bg-gray-100 dark:hover:bg-ios-dark-gray4 transition-colors text-left overflow-hidden group ${sidebarOpen ? 'w-full px-3 py-2 justify-start rounded-full gap-3' : 'w-12 h-12 justify-center rounded-full shrink-0 gap-0'}`}
                >
                    <div className="w-[32px] h-[32px] rounded-full bg-[rgb(var(--color-ios-accent-light))] dark:bg-[rgb(var(--color-ios-accent-dark))] text-white flex items-center justify-center shrink-0 font-bold text-[14px]">
                        {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    {sidebarOpen && (
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-[14px] text-corphia-ink dark:text-gray-100 truncate text-left m-0 leading-snug">{user?.name || 'Local User'}</p>
                        </div>
                    )}
                </button>
            </div>
        </aside>
    )
}
