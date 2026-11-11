import { Check, Code, Copy, FileText, Folder, Languages, Mail, Trash2 } from '@/components/snow/icons'
import { parseServerDate } from '@/lib/utils'
import { useEffect, useRef, useState } from 'react'

import OnboardingTour, { isOnboardingDone } from '@/components/onboarding/OnboardingTour'
import { ChatMinimap, ScrollToBottomButton, ChatSidebar, ChatHeader, ChatInputArea, ConversationContextMenu, RenameModal, MoveToProjectModal, NewFolderModal, MessageBubble } from '@/features/chat/components'
import { PlusIcon } from '@/features/chat/components/ChatIcons'
import { useChatLogic } from '@/features/chat/hooks/useChatLogic'
import { useUIStore } from '@/store/uiStore'
import Tooltip from '@/components/ui/Tooltip'
import WaveBackground from '@/components/ui/WaveBackground'
import { SkelMessages } from '@/components/ui/Skeleton'

export default function Chat() {
    const { sidebarProps, headerProps, inputProps, modalProps, mainProps } = useChatLogic()
    // 來源文件卡片的拖曳放入狀態（dragDepth：子元素進出也會觸發 enter/leave，用計數判斷真的離開）
    const [dragOver, setDragOver] = useState(false)
    const dragDepth = useRef(0)

    // 第一次進入 chat 觸發引導；旗標寫在 localStorage，已看過就不再顯示
    // useUIStore 的 onboardingReplayToken 在「重看引導」按下時會 +1，這裡訂這個值來重新打開
    const onboardingReplayToken = useUIStore((s) => s.onboardingReplayToken)
    const [showOnboarding, setShowOnboarding] = useState(false)

    useEffect(() => {
        // 初次進入：沒看過才開
        if (!isOnboardingDone()) {
            setShowOnboarding(true)
        }
    }, [])

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
            className="flex fixed inset-0 w-full h-[100dvh] bg-bg-base text-text-primary overflow-hidden font-sans selection:bg-accent relative transition-colors"
            style={{
                paddingTop: 'env(safe-area-inset-top)',
                paddingBottom: 'env(safe-area-inset-bottom)',
            }}
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
            <ChatSidebar {...sidebarProps} />

            {/* --- 右側主聊天視窗 Main Section （透明，讓背景弧線 SVG 透出來）--- */}
            <main className="flex-1 flex flex-col min-w-0 h-full relative transition-all duration-300 bg-transparent z-10">
                {/* 固定的頂部 Header (Top Bar) */}
                <ChatHeader {...headerProps} />

                {/* 內容區：滑動區域（根據空狀態或聊天動態渲染） */}
                {mainProps.selectedFolder ? (
                    // 專案管理頁面 Folder View
                    <div className="flex-1 overflow-hidden flex flex-col px-6 pt-6 pb-6 md:px-10 max-w-4xl mx-auto w-full">
                        <div className="mb-8 pl-2 shrink-0">
                            <h2 className="text-[length:var(--fs-22)] font-bold text-text-primary flex items-center gap-3">
                                <Folder className="w-8 h-8 text-accent" />
                                {mainProps.selectedFolder}
                            </h2>
                            <p className="mt-2 text-[length:var(--fs-15)] text-text-secondary">管理來源文獻，Corphia 將會依據您勾選的檔案作為參考資料回答對話</p>
                        </div>
                        
                        {/* 整張卡片都可以把檔案拖進來；拖曳中顯示「放開即可加入」的提示 */}
                        <div
                            className="paper !rounded-[var(--r-37)] flex flex-col flex-1 min-h-0 overflow-hidden"
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
                                    <span>放開即可加入來源</span>
                                </div>
                            )}
                            <div className="px-[var(--sp-21)] py-[var(--sp-21)] border-b border-[var(--paper-line)] flex justify-between items-center shrink-0">
                                <h3 className="font-semibold text-text-primary">來源文件 ({mainProps.folderDocuments.length})</h3>
                                <button 
                                    onClick={() => mainProps.fileInputRef.current?.click()}
                                    className="btn btn-primary !h-9 !px-4 !text-[length:var(--fs-14)] gap-1.5"
                                >
                                    <PlusIcon /> <span className="mr-1">新增來源</span>
                                </button>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                {mainProps.folderDocuments.length === 0 ? (
                                    <div className="p-16 text-center h-full flex flex-col items-center justify-center">
                                    <Copy className="w-16 h-16 mx-auto text-text-secondary mb-4 stroke-1" />
                                    <p className="text-[length:var(--fs-17)] font-semibold text-text-secondary mb-1">尚無文獻來源</p>
                                    <p className="text-[length:var(--fs-14)] text-text-muted">把檔案拖曳到這裡，或點右上角「新增來源」</p>
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
                                                        className="before:content[''] peer relative h-5 w-5 cursor-pointer appearance-none rounded-[var(--r-8)] border border-[var(--paper-line)] transition-all before:absolute before:top-2/4 before:left-2/4 before:block before:h-12 before:w-12 before:-translate-y-2/4 before:-translate-x-2/4 before:rounded-full before:bg-[var(--chip)] before:opacity-0 before:transition-opacity checked:border-accent checked:bg-accent checked:before:bg-accent"
                                                        checked={Boolean(doc.doc_metadata?.isActive ?? true)}
                                                        onChange={() => mainProps.handleToggleDocActive(doc)}
                                                    />
                                                    <div className="pointer-events-none absolute top-2/4 left-2/4 -translate-y-2/4 -translate-x-2/4 text-text-primary opacity-0 transition-opacity peer-checked:opacity-100">
                                                        <Check className="h-3.5 w-3.5" />
                                                    </div>
                                                </label>
                                                
                                                <div className="flex flex-col min-w-0">
                                                    <span className="font-medium text-[length:var(--fs-15)] text-text-primary truncate">{doc.original_filename || doc.filename || "Unknown"}</span>
                                                    <span className="text-[length:var(--fs-13)] text-text-secondary mt-0.5">
                                                        {parseServerDate(doc.created_at).toLocaleString()} • {(() => {
                                                            const bytes = doc.file_size || 0
                                                            if (bytes < 1024) return `${bytes} B`
                                                            if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
                                                            return `${(bytes / 1024 / 1024).toFixed(2)} MB`
                                                        })()}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-4">
                                                <span className={`tag ${doc.status === 'completed' ? 'tag-green' : doc.status === 'failed' ? 'tag-red' : doc.status === 'pending' ? 'tag-orange' : 'tag-accent'}`}>
                                                    {doc.status === 'completed' ? '可讀取' : doc.status === 'failed' ? '讀取失敗' : doc.status === 'pending' ? '等待處理' : '處理中'}
                                                </span>
                                                
                                                <Tooltip label="刪除">
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
                                                        className="p-2 text-text-muted  rounded-full  md:opacity-0 group-hover:opacity-100 transition-all"
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
                                    <span className="text-accent text-[length:var(--fs-15)] font-medium">正在上傳並進行語意分析與 Chunking...</span>
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
                    <div ref={mainProps.scrollContainerRef} className="chat-scroll flex-1 overflow-y-auto w-full scrollbar-none pt-6 pb-4 relative">
                        {/* 頂部感應器：無限捲動 */}
                        <div ref={mainProps.topObserverRef} className="w-full h-px opacity-0" />
                        {mainProps.isLoadingMore && (
                            <SkelMessages count={2} className="w-full max-w-3xl mx-auto px-4 md:px-0 py-2" />
                        )}
                        {mainProps.messages.length === 0 ? (
                            // 空狀態：改為置頂與上方留白，讓內容可以自然向上滾動，不要用 flex-center 死鎖
                            <div className="w-full max-w-3xl mx-auto px-4 md:px-0 pb-8 pt-[8vh] md:pt-[10vh]">
                                {/* Greeting: mobile uses smaller font + 截斷超長使用者名（>16 字補 …），
                                    避免 tour-test-1777806224995 之類的長 ID 把標題撐到 3 行 */}
                                <h2 className="text-[length:var(--fs-18)] sm:text-[length:var(--fs-24)] md:text-[length:var(--fs-34)] font-bold mb-2 text-text-primary tracking-[-0.02em] text-center leading-[1.3] md:leading-tight break-words">
                                    {mainProps.t('chat.emptyGreeting', {
                                        name: (() => {
                                            const raw =
                                                mainProps.user?.name ||
                                                mainProps.user?.email?.split('@')[0] ||
                                                mainProps.t('common.user', 'User')
                                            return raw.length > 16 ? raw.slice(0, 14) + '…' : raw
                                        })(),
                                    })}
                                </h2>
                                {/* 已移除「已連線本地 …」副標題，主畫面更乾淨；模型名稱仍可在右上角下拉選單看到 */}
                                <div className="mb-8" />

                                {/* Suggested Prompts —— 齊寬卡片（同最寬內容）：
                                    父容器 w-max → 寬度 = 最寬子卡內容；
                                    grid 1fr 讓 N 個 cell 平均分這個寬度，於是所有卡同寬 = 最寬內容；
                                    桌機 sm:grid-cols-2 排兩欄，max-w-full 防超出視窗。 */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-[min(600px,100%)] mx-auto stagger-fade-in">
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
                                                onClick={() => mainProps.setInput(item.desc)}
                                                /* 2×2 玻璃卡：圓角 25、內距 16 → 圖示方塊圓角 10（25−16=9，範本最小 10） */
                                                className="paper !rounded-[var(--r-25)] p-4 w-full text-left flex flex-col gap-3 cursor-pointer transition-transform duration-200 active:scale-[0.97]"
                                            >
                                                <span className="snow-row-icon !rounded-[var(--r-10)]">{icons[index % icons.length]}</span>
                                                <span className="min-w-0">
                                                    <span className="block font-semibold text-[length:var(--fs-15)] text-text-primary">{item.title}</span>
                                                    <span className="block text-[length:var(--fs-13)] leading-snug text-text-secondary mt-1">{item.desc}</span>
                                                </span>
                                            </button>
                                        ));
                                    })()}
                                </div>
                            </div>
                        ) : (
                            // 聊天紀錄
                            <div className="max-w-3xl mx-auto space-y-6 w-full px-4 md:px-0">
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

                {/* 底部輸入區 Chat Input Area */}
                <ChatInputArea {...inputProps} />
            </main>
            {/* --- 彈出視窗 Modals --- */}
            <ConversationContextMenu
                activeMenu={modalProps.activeMenu}
                menuRef={modalProps.menuRef}
                conversations={sidebarProps.conversations}
                onRename={modalProps.handleRenameConversation}
                onMove={modalProps.handleMoveToProject}
                onShare={modalProps.handleShareConversation}
                onDelete={modalProps.handleDeleteConversation}
                onClose={modalProps.closeMenu}
            />

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
