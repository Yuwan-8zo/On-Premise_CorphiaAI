import { Check, ChevronRight, Code, Copy, FileText, Folder, Languages, Mail, Trash2 } from '@/components/snow/icons'
import { parseServerDate } from '@/lib/utils'
import { useEffect, useState } from 'react'

import OnboardingTour, { isOnboardingDone } from '@/components/onboarding/OnboardingTour'
import { ChatMinimap, ScrollToBottomButton, ChatSidebar, ChatHeader, ChatInputArea, ConversationContextMenu, RenameModal, MoveToProjectModal, NewFolderModal, MessageBubble } from '@/features/chat/components'
import { PlusIcon } from '@/features/chat/components/ChatIcons'
import { useChatLogic } from '@/features/chat/hooks/useChatLogic'
import { useUIStore } from '@/store/uiStore'
import Tooltip from '@/components/ui/Tooltip'

export default function Chat() {
    const { sidebarProps, headerProps, inputProps, modalProps, mainProps } = useChatLogic()

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

    useEffect(() => {
        // replay token 變動才開（>0 代表使用者按了重看）
        if (onboardingReplayToken > 0) {
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
                <svg className="absolute w-full h-full" preserveAspectRatio="none" viewBox="0 0 1440 900" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path className="fill-corphia-bronze dark:fill-white opacity-[0.03] dark:opacity-[0.02] transition-colors duration-300" d="M0,0 C400,400 1000,500 1440,200 L1440,900 L0,900 Z" />
                    <path className="fill-corphia-bronze dark:fill-white opacity-[0.06] dark:opacity-[0.03] transition-colors duration-300" d="M0,300 C500,800 1100,700 1440,400 L1440,900 L0,900 Z" />
                    <path className="fill-corphia-bronze dark:fill-white opacity-[0.02] dark:opacity-[0.01] transition-colors duration-300" d="M0,600 C600,900 1200,600 1440,700 L1440,900 L0,900 Z" />
                </svg>
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
                            <h2 className="text-[22px] font-bold text-text-primary flex items-center gap-3">
                                <Folder className="w-8 h-8 text-corphia-bronze" />
                                {mainProps.selectedFolder}
                            </h2>
                            <p className="mt-2 text-[15px] text-text-secondary">管理來源文獻，Corphia 將會依據您勾選的檔案作為參考資料回答對話</p>
                        </div>
                        
                        <div className="paper !rounded-[25px] flex flex-col flex-1 min-h-0 overflow-hidden">
                            <div className="px-6 py-4 border-b border-[var(--paper-line)] flex justify-between items-center shrink-0">
                                <h3 className="font-semibold text-text-primary">來源文件 ({mainProps.folderDocuments.length})</h3>
                                <button 
                                    onClick={() => mainProps.fileInputRef.current?.click()}
                                    className="btn btn-primary !h-9 !px-4 !text-[14px] gap-1.5"
                                >
                                    <PlusIcon /> <span className="mr-1">新增來源</span>
                                </button>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                {mainProps.folderDocuments.length === 0 ? (
                                    <div className="p-16 text-center h-full flex flex-col items-center justify-center">
                                    <Copy className="w-16 h-16 mx-auto text-text-secondary mb-4 stroke-1" />
                                    <p className="text-[17px] font-semibold text-text-secondary mb-1">尚無文獻來源</p>
                                    <p className="text-[14px] text-text-muted">點擊右上角新增，建立專案護城河</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-border-subtle dark:divide-border-subtle">
                                    {mainProps.folderDocuments.map((doc: any) => (
                                        <div key={doc.id} className="p-4 px-6 flex items-center justify-between  transition-colors group">
                                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                                <label className="relative flex cursor-pointer items-center rounded-full" htmlFor={`checkbox-${doc.id}`}>
                                                    <input 
                                                        type="checkbox" 
                                                        id={`checkbox-${doc.id}`}
                                                        className="before:content[''] peer relative h-5 w-5 cursor-pointer appearance-none rounded-md border border-[var(--paper-line)] transition-all before:absolute before:top-2/4 before:left-2/4 before:block before:h-12 before:w-12 before:-translate-y-2/4 before:-translate-x-2/4 before:rounded-full before:bg-[var(--chip)] before:opacity-0 before:transition-opacity checked:border-corphia-bronze checked:bg-accent checked:before:bg-accent dark:checked:border-accent dark:checked:bg-accent dark:checked:before:bg-accent "
                                                        checked={Boolean(doc.doc_metadata?.isActive ?? true)}
                                                        onChange={() => mainProps.handleToggleDocActive(doc)}
                                                    />
                                                    <div className="pointer-events-none absolute top-2/4 left-2/4 -translate-y-2/4 -translate-x-2/4 text-text-primary opacity-0 transition-opacity peer-checked:opacity-100">
                                                        <Check className="h-3.5 w-3.5" />
                                                    </div>
                                                </label>
                                                
                                                <div className="flex flex-col min-w-0">
                                                    <span className="font-medium text-[15px] text-text-primary truncate">{doc.original_filename || doc.filename || "Unknown"}</span>
                                                    <span className="text-[13px] text-text-secondary mt-0.5">
                                                        {parseServerDate(doc.created_at).toLocaleString()} • {(() => {
                                                            const bytes = doc.file_size || doc.size_bytes || 0
                                                            if (bytes < 1024) return `${bytes} B`
                                                            if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
                                                            return `${(bytes / 1024 / 1024).toFixed(2)} MB`
                                                        })()}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-4">
                                                <span className={`text-[12px] px-2.5 py-1 rounded-full font-medium ${
                                                    doc.status === 'completed' ? 'bg-green-100 text-green-700 ' :
                                                    doc.status === 'failed' ? 'bg-red-100 text-red-700 ' :
                                                    'bg-[var(--chip)] text-text-secondary '
                                                }`}>
                                                    {doc.status === 'completed' ? '已處理' : doc.status === 'failed' ? '失敗' : '處理中'}
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
                            <div className="mt-6 p-4 glass-chip rounded-[18px] flex items-center justify-between animate-fade-in-up shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-5 h-5 rounded-full border-2 border-corphia-bronze border-t-transparent animate-spin" />
                                    <span className="text-corphia-bronze text-[15px] font-medium">正在上傳並進行語意分析與 Chunking...</span>
                                </div>
                                <span className="text-corphia-bronze font-semibold">{mainProps.uploadProgress}%</span>
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
                    <div ref={mainProps.scrollContainerRef} className="flex-1 overflow-y-auto w-full scrollbar-none pt-6 pb-4 relative">
                        {/* 頂部感應器：無限捲動 */}
                        <div ref={mainProps.topObserverRef} className="w-full h-px opacity-0" />
                        {mainProps.isLoadingMore && (
                            <div className="flex justify-center items-center py-2 text-text-secondary">
                                <span className="animate-spin rounded-full h-4 w-4 border-2 border-[var(--paper-line)] border-t-text-primary"></span>
                            </div>
                        )}
                        {mainProps.messages.length === 0 ? (
                            // 空狀態：改為置頂與上方留白，讓內容可以自然向上滾動，不要用 flex-center 死鎖
                            <div className="w-full max-w-3xl mx-auto px-4 md:px-0 pb-8 pt-[8vh] md:pt-[10vh]">
                                {/* Greeting: mobile uses smaller font + 截斷超長使用者名（>16 字補 …），
                                    避免 tour-test-1777806224995 之類的長 ID 把標題撐到 3 行 */}
                                <h2 className="text-[18px] sm:text-[24px] md:text-[34px] font-bold mb-2 text-text-primary tracking-[-0.02em] text-center leading-[1.3] md:leading-tight break-words">
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
                                        return suggestions.map((item: any, index: number) => (
                                            <button
                                                key={index}
                                                onClick={() => mainProps.setInput(item.desc)}
                                                /* 2×2 玻璃卡：圓角 25、內距 16 → 圖示方塊圓角 10（25−16=9，範本最小 10） */
                                                className="paper !rounded-[25px] p-4 w-full text-left flex flex-col gap-3 cursor-pointer transition-transform duration-200 active:scale-[0.97]"
                                            >
                                                <span className="snow-row-icon !rounded-[10px]">{icons[index % icons.length]}</span>
                                                <span className="min-w-0">
                                                    <span className="block font-semibold text-[15px] text-text-primary">{item.title}</span>
                                                    <span className="block text-[13px] leading-snug text-text-secondary mt-1">{item.desc}</span>
                                                </span>
                                            </button>
                                        ));
                                    })()}
                                </div>
                            </div>
                        ) : (
                            // 聊天紀錄
                            <div className="max-w-3xl mx-auto space-y-6 w-full px-4 md:px-0">
                                {mainProps.messages.map((message: any, index: number) => {
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
