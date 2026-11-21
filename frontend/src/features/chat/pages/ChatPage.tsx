import { formatBytes } from '@/lib/formatBytes'
import { Check, Code, Copy, FileText, Folder, Languages, Mail, Trash2 } from '@/components/snow/icons'
import { parseServerDate } from '@/lib/utils'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useScrollFade } from '@/lib/useScrollFade'

import OnboardingTour from '@/components/onboarding/OnboardingTour'
import { isOnboardingDone } from '@/components/onboarding/onboardingFlag'
import { ChatMinimap, ScrollToBottomButton, ChatSidebar, ChatHeader, ChatInputArea, ConversationContextMenu, RenameModal, MoveToProjectModal, NewFolderModal, MessageBubble } from '@/features/chat/components'
import { PlusIcon } from '@/features/chat/components/ChatIcons'
import SidePanel from '@/features/chat/components/SidePanel'
import ExportDialog from '@/features/chat/components/ExportDialog'
import { useChatLogic } from '@/features/chat/hooks/useChatLogic'
import { useChatHotkeys } from '@/features/chat/hooks/useChatHotkeys'
import { useReadProgress } from '@/features/chat/hooks/useReadProgress'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import { useChatStore } from '@/store/chatStore'
import i18n from '@/i18n'
import { useSidePanelStore } from '@/store/sidePanelStore'
import Tooltip from '@/components/ui/Tooltip'
import RegionBoundary from '@/components/ui/RegionBoundary'
import WaveBackground from '@/components/ui/WaveBackground'
import { SkelMessages } from '@/components/ui/Skeleton'
import { dayPartOf, useNow } from '@/lib/dayPart'

export default function Chat() {
    const { sidebarProps, headerProps, inputProps, modalProps, mainProps } = useChatLogic()
    useChatHotkeys({
        isStreaming: inputProps.isStreaming,
        input: inputProps.input,
        setInput: inputProps.setInput,
        inputRef: inputProps.inputRef,
        lastUserText: () => [...mainProps.messages].reverse().find((m) => m.role === 'user')?.content,
        handleStop: inputProps.handleStop,
        createNewConversation: mainProps.createNewConversation,
        setSidebarOpen: useUIStore.getState().setSidebarOpen,
        toggleSidebar: sidebarProps.toggleSidebar,
    })
    // 專案模式、還沒進任何專案對話：引導選資料夾或建立新的，不顯示一般聊天的建議（翻譯、寫信…）
    const currentConversation = useChatStore((s) => s.currentConversation)
    const projectHome = sidebarProps.chatMode === 'project' && !currentConversation?.settings?.isProject
    // 首頁標題跟著時段換問候（早安／午安…）；仍是平實的問句，不加客套和名字
    const dayPart = dayPartOf(useNow())
    // 訊息列表：捲動時上下邊緣淡出；同一個元素也要給捲動邏輯用（scrollContainerRef）
    const fadeRef = useScrollFade()
    // 長對話：頂端一條閱讀進度（捲動時浮現）
    const { scrollRef: readRef, barRef: readBarRef } = useReadProgress()
    const { scrollContainerRef } = mainProps
    const chatScrollRef = useCallback((el: HTMLDivElement | null) => {
        ;(scrollContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = el
        fadeRef(el)
        readRef(el)
    }, [scrollContainerRef, fadeRef, readRef])
    // 來源文件卡片的拖曳放入狀態（dragDepth：子元素進出也會觸發 enter/leave，用計數判斷真的離開）
    const [dragOver, setDragOver] = useState(false)
    const dragDepth = useRef(0)
    // 旁邊的顯示面板開著時聊天欄變窄：整欄（訊息、輸入框）左右留邊，不然會貼到側欄和面板
    const panelOpen = useSidePanelStore((s) => s.open)

    // 每個帳號第一次進聊天頁（新註冊的帳號第一次登入）由小 AI 帶導覽；看過的標記每個帳號分開記（onboardingFlag）
    // useUIStore 的 onboardingReplayToken 在「重看引導」按下時會 +1，這裡訂這個值來重新打開
    const onboardingReplayToken = useUIStore((s) => s.onboardingReplayToken)
    const [showOnboarding, setShowOnboarding] = useState(false)

    const userId = useAuthStore((s) => s.user?.id)
    useEffect(() => {
        // 這個帳號還沒看過才開（等登入資料載好、知道是哪個帳號再判斷）
        if (userId && !isOnboardingDone(userId)) {
            setShowOnboarding(true)
        }
    }, [userId])

    // 只有「這次停留期間」重看次數又增加才打開。
    // 以前用 token > 0 判斷：按過一次重看後，從管理後台等頁面回來（頁面重新掛載）就會一直再跳出引導
    const seenReplayToken = useRef(onboardingReplayToken)
    useEffect(() => {
        if (onboardingReplayToken !== seenReplayToken.current) {
            seenReplayToken.current = onboardingReplayToken
            setShowOnboarding(true)
        }
    }, [onboardingReplayToken])

    return (
        // 主畫面全區背景 (使用 fixed inset-0 完全鎖定在視窗內部，防止 iOS Safari 整頁回彈拖拉)
        // 與 LoginPage / Admin 同款：bg-bg-base + 三條弧線 SVG，sidebar / main 玻璃化
        <div
            // 專案模式、資料夾頁：重新整理會回到一般聊天，這時不記骨架版面（見 lib/layoutSnapshot）
            data-skel-nosave={sidebarProps.chatMode === 'project' || !!mainProps.selectedFolder || undefined}
            className="edge-shell chat-shell flex fixed inset-0 bg-bg-base text-text-primary overflow-hidden font-sans selection:bg-accent transition-colors"
            style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
            {/* 背景弧線 SVG —— 跟登入/Admin 同款 */}
            <div aria-hidden className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                <WaveBackground />
            </div>

            {/* --- Mobile Sidebar Overlay --- */}
            <div 
                className={`fixed inset-0 bg-black/10 dark:bg-black/40 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ${
                    sidebarProps.sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                }`}
                onClick={sidebarProps.toggleSidebar}
            />

            {/* 左側邊欄 Sidebar */}
            <RegionBoundary name="sidebar" compact>
                <ChatSidebar {...sidebarProps} />
            </RegionBoundary>

            {/* --- 右側主聊天視窗 Main Section （透明，讓背景弧線 SVG 透出來）--- */}
            <main className={`flex-1 flex flex-col min-w-0 h-full relative bg-transparent z-10 ${panelOpen ? 'md:px-[var(--sp-16)]' : ''}`}>
                {/* 固定的頂部 Header (Top Bar) */}
                <ChatHeader {...headerProps} />

                {/* 內容區：滑動區域（根據空狀態或聊天動態渲染）；出錯時只有這一塊換成提示卡，換對話自動重試 */}
                <RegionBoundary name="content" resetKeys={[currentConversation?.id, mainProps.selectedFolder]}>
                {mainProps.selectedFolder ? (
                    // 專案管理頁面 Folder View
                    <div className="flex-1 overflow-hidden flex flex-col px-6 pt-6 pb-6 md:px-10 max-w-4xl mx-auto w-full">
                        <div className="mb-8 pl-2 shrink-0">
                            <h2 className="text-[length:var(--fs-22)] font-bold text-text-primary flex items-center gap-3">
                                <Folder className="w-8 h-8 text-accent" />
                                {mainProps.selectedFolder}
                            </h2>
                            <p className="mt-2 text-[length:var(--fs-15)] text-text-secondary">{mainProps.t('ui.folder.intro')}</p>
                        </div>
                        
                        {/* 整張卡片都可以把檔案拖進來；拖曳中顯示「放開即可加入」的提示 */}
                        <div
                            className="paper !rounded-[var(--r-37)] flex flex-col min-h-0 max-h-full overflow-hidden"
                            onDragEnter={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); dragDepth.current++; setDragOver(true) } }}
                            onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' } }}
                            onDragLeave={() => { dragDepth.current = Math.max(0, dragDepth.current - 1); if (dragDepth.current === 0) setDragOver(false) }}
                            onDrop={(e) => {
                                e.preventDefault(); dragDepth.current = 0; setDragOver(false)
                                mainProps.uploadFiles(Array.from(e.dataTransfer.files))
                            }}
                        >
                            {dragOver && (
                                <div className="drop-hint" aria-hidden>
                                    <PlusIcon />
                                    <span>{mainProps.t('ui.folder.dropHint')}</span>
                                </div>
                            )}
                            <div className="px-[var(--sp-21)] py-[var(--sp-21)] border-b border-[var(--paper-line)] flex justify-between items-center shrink-0">
                                <h3 className="font-semibold text-text-primary">
                                    {mainProps.t('ui.folder.sources')}
                                    <span className="ml-[var(--sp-8)] font-normal text-text-secondary tabular-nums">{mainProps.folderDocuments.length}</span>
                                </h3>
                                <button 
                                    onClick={() => mainProps.fileInputRef.current?.click()}
                                    className="btn btn-primary !h-9 !px-4 !text-[length:var(--fs-14)] gap-1.5"
                                >
                                    <PlusIcon /> <span className="mr-1">{mainProps.t('ui.folder.addSource')}</span>
                                </button>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                {mainProps.folderDocuments.length === 0 ? (
                                    <div className="p-16 text-center h-full flex flex-col items-center justify-center">
                                    <Copy className="w-16 h-16 mx-auto text-text-secondary mb-4 stroke-1" />
                                    <p className="text-[length:var(--fs-17)] font-semibold text-text-secondary mb-1">{mainProps.t('ui.folder.emptyTitle')}</p>
                                    <p className="text-[length:var(--fs-14)] text-text-muted">{mainProps.t('ui.folder.emptyHint')}</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-border-subtle dark:divide-border-subtle">
                                    {mainProps.folderDocuments.map((doc) => (
                                        <div key={doc.id} className="p-4 px-6 flex items-center justify-between  transition-colors group">
                                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                                <label className="relative flex cursor-pointer items-center rounded-full" htmlFor={`checkbox-${doc.id}`}>
                                                    <input 
                                                        type="checkbox" 
                                                        id={`checkbox-${doc.id}`}
                                                        className="before:content[''] peer relative h-5 w-5 cursor-pointer appearance-none rounded-[var(--r-8)] border border-[var(--paper-line)] transition-colors before:absolute before:top-2/4 before:left-2/4 before:block before:h-12 before:w-12 before:-translate-y-2/4 before:-translate-x-2/4 before:rounded-full before:bg-[var(--chip)] before:opacity-0 before:transition-opacity checked:border-accent checked:bg-accent checked:before:bg-accent"
                                                        checked={Boolean(doc.doc_metadata?.isActive ?? true)}
                                                        onChange={() => mainProps.handleToggleDocActive(doc)}
                                                    />
                                                    <div className="pointer-events-none absolute top-2/4 left-2/4 -translate-y-2/4 -translate-x-2/4 text-text-primary opacity-0 transition-opacity peer-checked:opacity-100">
                                                        <Check className="h-3.5 w-3.5" />
                                                    </div>
                                                </label>
                                                
                                                <div className="flex flex-col min-w-0">
                                                    <span className="font-medium text-[length:var(--fs-15)] text-text-primary truncate">{doc.original_filename || doc.filename || mainProps.t('ui.sources.unknownDoc')}</span>
                                                    <span className="text-[length:var(--fs-13)] text-text-secondary mt-0.5">
                                                        {/* 上傳日期只到「年月日」，時分秒對選檔沒有幫助 */}
                                                        {parseServerDate(doc.created_at).toLocaleDateString(i18n.language)} · {formatBytes(doc.file_size || 0)}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-4">
                                                <span className={`tag ${doc.status === 'completed' ? 'tag-green' : doc.status === 'failed' ? 'tag-red' : doc.status === 'pending' ? 'tag-orange' : 'tag-accent'}`}>
                                                    {mainProps.t(doc.status === 'completed' ? 'ui.folder.statusReady' : doc.status === 'failed' ? 'ui.folder.statusFailed' : doc.status === 'pending' ? 'ui.folder.statusPending' : 'ui.folder.statusProcessing')}
                                                </span>
                                                
                                                <Tooltip label={mainProps.t('common.delete')}>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            mainProps.showConfirm(mainProps.t('common.confirmDelete'), async () => {
                                                                try {
                                                                    await mainProps.documentsApi.delete(doc.id)
                                                                    if (mainProps.selectedFolder) mainProps.loadFolderDocuments(mainProps.selectedFolder)
                                                                } catch (error) {
                                                                    console.error('刪除文件失敗', error)
                                                                }
                                                            })
                                                        }}
                                                        aria-label={mainProps.t('common.delete')}
                                                        className="hover-reveal p-2 text-text-muted rounded-full"
                                                    >
                                                        <Trash2 className="w-5 h-5" />
                                                    </button>
                                                </Tooltip>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            </div>
                        </div>
                        
                        {/* 專案上傳進度 */}
                        {mainProps.isUploading && mainProps.selectedFolder && (
                            <div className="mt-6 p-4 glass-chip rounded-[var(--r-18)] flex items-center justify-between animate-fade-in-up shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                                    <span className="text-accent text-[length:var(--fs-15)] font-medium">{mainProps.t('ui.chat.uploadAnalyzing')}</span>
                                </div>
                                <span className="text-accent font-semibold">{mainProps.uploadProgress}%</span>
                            </div>
                        )}
                        
                    
                    </div>
                ) : (
                <div className="relative flex-1 overflow-hidden h-full flex flex-col">
                    {/* Minimap + scroll-to-bottom button.
                        Only render scroll-to-bottom when there are messages, otherwise it can
                        overlay on top of empty-state suggestion cards on narrow viewports. */}
                    <ChatMinimap messages={mainProps.messages} containerRef={mainProps.scrollContainerRef} />
                    {mainProps.messages.length > 0 && (
                        <ScrollToBottomButton containerRef={mainProps.scrollContainerRef} dependsOn={mainProps.messages} isStreaming={mainProps.isStreaming} />
                    )}
                    
                    {/*
                      訊息列表區：保留 overflow-y-auto 可滾動，但用 scrollbar-none 完全隱藏 scrollbar。
                      右側已有 ChatMinimap（縮圖式導覽）+ ScrollToBottomButton 處理視覺指引，
                      傳統 scrollbar 在這裡是噪音不是訊號。
                    */}
                    <div className="read-progress-host"><div ref={readBarRef} className="read-progress" aria-hidden /></div>
                    <div ref={chatScrollRef} className="scroll-fade chat-scroll flex-1 overflow-y-auto w-full scrollbar-none pt-6 pb-4 relative">
                        {/* 頂部感應器：無限捲動 */}
                        <div ref={mainProps.topObserverRef} className="w-full h-px -mb-px opacity-0" />
                        {mainProps.isLoadingMore && (
                            <SkelMessages count={2} className="w-full max-w-3xl mx-auto px-4 md:px-0 py-2" />
                        )}
                        {mainProps.messages.length === 0 ? (
                            // 空狀態：改為置頂與上方留白，讓內容可以自然向上滾動，不要用 flex-center 死鎖
                            // 上下留白是「可縮」的：螢幕夠高＝原本的 8vh／10vh；螢幕矮（橫拿的折疊手機）時先縮留白，卡片不被輸入框蓋住
                            <div className="w-full h-full max-w-3xl mx-auto px-4 md:px-0 flex flex-col">
                                <div aria-hidden className="min-h-0 basis-[8vh] md:basis-[10vh]" />
                                {/* 標題用平實的問句，不用「有什麼我可以幫忙的，某某？」這種客套招呼；
                                    下面一句說明資料留在公司內部（系統的重點是資安） */}
                                <h2 className="text-[length:var(--fs-22)] md:text-[length:var(--fs-34)] font-bold text-text-primary tracking-[-0.02em] text-center leading-[1.3] md:leading-tight text-balance">
                                    {mainProps.t(projectHome ? 'chat.projectEmptyTitle' : `chat.greet.${dayPart}`)}
                                </h2>
                                <p className="mt-[var(--sp-8)] text-center text-[length:var(--fs-15)] leading-[var(--lh-20)] text-text-secondary text-balance [word-break:keep-all]">
                                    {mainProps.t(projectHome ? 'chat.projectEmptyNote' : 'chat.emptyNote')}
                                </p>
                                <div className="mb-[var(--fluid-block)]" />
                                {projectHome ? (
                                    <button type="button" onClick={sidebarProps.openNewFolderModal} className="btn btn-primary mx-auto gap-[var(--sp-6)]">
                                        <PlusIcon /> {mainProps.t('chat.newFolder')}
                                    </button>
                                ) : (<>

                                {/* 建議的問題：一張實色卡片裡的清單（像 iOS 設定的分組列表），
                                    不用四張一樣大的「圖示＋粗體標題＋一句說明」卡片（看起來像套版） */}
                                <div className="suggest-list paper !rounded-[var(--r-25)] w-[min(560px,100%)] mx-auto stagger-fade-in">
                                    {(() => {
                                        const suggestions = (mainProps.t('chat.suggestions', { returnObjects: true }) as { title: string, desc: string }[]) || [
                                            { title:"摘要文件", desc:"幫我整理出一份簡單的重點摘要" },
                                            { title:"翻譯內容", desc:"將這段文字翻譯成通順的在地語言" },
                                            { title:"撰寫 Email", desc:"以專業用語撰寫一封商務合作信件" },
                                            { title:"說明程式碼", desc:"幫我詳細解釋這段程式碼的邏輯" }
                                        ];
                                        const icons = [
                                            <FileText className="w-5 h-5" />,
                                            <Languages className="w-5 h-5" />,
                                            <Mail className="w-5 h-5" />,
                                            <Code className="w-5 h-5" />
                                        ];
                                        return suggestions.map((item, index) => (
                                            <button
                                                key={index}
                                                type="button"
                                                onClick={() => mainProps.setInput(item.desc)}
                                                className="suggest-row"
                                            >
                                                <span className="suggest-row-icon">{icons[index % icons.length]}</span>
                                                <span className="suggest-row-text">
                                                    <span className="suggest-row-title">{item.title}</span>
                                                    <span className="suggest-row-desc">{item.desc}</span>
                                                </span>
                                            </button>
                                        ));
                                    })()}
                                </div>
                                </>)}
                                <div aria-hidden className="min-h-0 basis-[var(--sp-32)]" />
                            </div>
                        ) : (
                            // 聊天紀錄
                            <div className="msg-col max-w-3xl mx-auto space-y-6 w-full px-4 md:px-0">
                                {mainProps.messages.map((message, index) => {
                                    const isLastAssistant =
                                        message.role === 'assistant' &&
                                        index === mainProps.messages.length - 1
                                    return (
                                        <MessageBubble
                                            key={message.id}
                                            message={message}
                                            isStreaming={mainProps.isStreaming && isLastAssistant}
                                            onResubmit={mainProps.handleResubmit}
                                            onRegenerate={mainProps.handleRegenerate}
                                            onSearchAgain={mainProps.handleSearchAgain}
                                            onSwitchVersion={mainProps.handleSwitchVersion}
                                            busy={mainProps.isStreaming}
                                            showRAGDebug={mainProps.ragDebugMode && isLastAssistant && !mainProps.isStreaming}
                                        />
                                    )
                                })}
                                <div ref={mainProps.messagesEndRef} />
                            </div>
                        )}
                    </div>
                </div>
                )}
                </RegionBoundary>

                {/* 底部輸入區 Chat Input Area */}
                <RegionBoundary name="input" compact>
                    <ChatInputArea {...inputProps} />
                </RegionBoundary>
            </main>

            {/* 旁邊的顯示面板：AI 做的成品、執行程式的結果（沒有開啟時不佔位置） */}
            <RegionBoundary name="side-panel" compact>
                <SidePanel />
            </RegionBoundary>

            {/* --- 彈出視窗 Modals --- */}
            <ConversationContextMenu
                activeMenu={modalProps.activeMenu}
                menuRef={modalProps.menuRef}
                conversations={sidebarProps.conversations}
                onRename={modalProps.handleRenameConversation}
                onMove={modalProps.handleMoveToProject}
                onShare={modalProps.handleShareConversation}
                onUnshare={modalProps.handleUnshareConversation}
                onDelete={modalProps.handleDeleteConversation}
                onClose={modalProps.closeMenu}
            />

            <ExportDialog />

            <RenameModal
                renameModal={modalProps.renameModal}
                renameInput={modalProps.renameInput}
                renameInputRef={modalProps.renameInputRef}
                setRenameInput={modalProps.setRenameInput}
                submitRename={modalProps.submitRename}
                onClose={() => modalProps.setRenameModal(null)}
            />

            <MoveToProjectModal
                moveModal={modalProps.moveModal}
                moveInput={modalProps.moveInput}
                savedFolders={modalProps.savedFolders}
                conversations={sidebarProps.conversations}
                setMoveInput={modalProps.setMoveInput}
                submitMove={modalProps.submitMove}
                onClose={() => modalProps.setMoveModal(null)}
            />

            <NewFolderModal
                show={modalProps.newFolderModal}
                input={modalProps.newFolderInput}
                inputRef={modalProps.newFolderInputRef}
                setInput={modalProps.setNewFolderInput}
                onSubmit={modalProps.submitNewFolder}
                onClose={() => modalProps.setNewFolderModal(false)}
            />

            {/* 第一次使用引導 / 重看引導 */}
            <OnboardingTour
                isOpen={showOnboarding}
                onClose={() => setShowOnboarding(false)}
            />
        </div>
    )
}
