import { ChatMinimap, ScrollToBottomButton, ChatSidebar, ChatHeader, ChatInputArea, ConversationContextMenu, RenameModal, MoveToProjectModal, NewFolderModal, MessageBubble } from '../components/chat'
import { PlusIcon } from '../components/chat/ChatIcons'
import { useChatLogic } from '../hooks/useChatLogic'

export default function Chat() {
    const { sidebarProps, headerProps, inputProps, modalProps, mainProps } = useChatLogic()

    return (
        // 主畫面全區背景 (使用 fixed inset-0 完全鎖定在視窗內部，防止 iOS Safari 整頁回彈拖拉)
        <div className="flex fixed inset-0 w-full h-[100dvh] bg-bg-surface text-text-primary overflow-hidden font-sans selection:bg-accent relative transition-colors">
            
            {/* --- Mobile Sidebar Overlay --- */}
            <div 
                className={`fixed inset-0 bg-black/10 dark:bg-black/40 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ${
                    sidebarProps.sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                }`}
                onClick={sidebarProps.toggleSidebar}
            />

            {/* 左側邊欄 Sidebar */}
            <ChatSidebar {...sidebarProps} />

            {/* --- 右側主聊天視窗 Main Section --- */}
            <main className="flex-1 flex flex-col min-w-0 h-full relative transition-all duration-300 bg-bg-surface z-10">
                {/* 固定的頂部 Header (Top Bar) */}
                <ChatHeader {...headerProps} />

                {/* 內容區：滑動區域（根據空狀態或聊天動態渲染） */}
                {mainProps.selectedFolder ? (
                    // 專案管理頁面 Folder View
                    <div className="flex-1 overflow-hidden flex flex-col px-6 pt-6 mb-8 md:px-10 max-w-4xl mx-auto w-full pb-8">
                        <div className="mb-8 pl-2 shrink-0">
                            <h2 className="text-[22px] font-bold text-text-primary flex items-center gap-3">
                                <svg className="w-8 h-8 text-corphia-bronze" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                </svg>
                                {mainProps.selectedFolder}
                            </h2>
                            <p className="mt-2 text-[15px] text-text-secondary">管理來源文獻，Corphia 將會依據您勾選的檔案作為參考資料回答對話</p>
                        </div>
                        
                        <div className="bg-bg-base rounded-[20px] shadow-sm border border-border-subtle flex flex-col flex-1 min-h-0">
                            <div className="px-6 py-4 border-b border-border-subtle flex justify-between items-center bg-bg-base/50 /50 shrink-0">
                                <h3 className="font-semibold text-text-primary">來源文件 ({mainProps.folderDocuments.length})</h3>
                                <button 
                                    onClick={() => mainProps.fileInputRef.current?.click()}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-accent bg-accent text-text-primary rounded-full transition-all shadow-sm shadow-accent/20 hover:shadow-accent/40 text-sm font-medium"
                                >
                                    <PlusIcon /> <span className="mr-1">新增來源</span>
                                </button>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                {mainProps.folderDocuments.length === 0 ? (
                                    <div className="p-16 text-center h-full flex flex-col items-center justify-center">
                                    <svg className="w-16 h-16 mx-auto text-text-secondary mb-4 stroke-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                                    </svg>
                                    <p className="text-[17px] font-semibold text-text-secondary mb-1">尚無文獻來源</p>
                                    <p className="text-[14px] text-text-muted">點擊右上角新增，建立專案護城河</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-border-subtle dark:divide-border-subtle">
                                    {mainProps.folderDocuments.map((doc: any) => (
                                        <div key={doc.id} className="p-4 px-6 flex items-center justify-between hover:bg-bg-base transition-colors group">
                                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                                <label className="relative flex cursor-pointer items-center rounded-full" htmlFor={`checkbox-${doc.id}`}>
                                                    <input 
                                                        type="checkbox" 
                                                        id={`checkbox-${doc.id}`}
                                                        className="before:content[''] peer relative h-5 w-5 cursor-pointer appearance-none rounded-md border border-border-subtle transition-all before:absolute before:top-2/4 before:left-2/4 before:block before:h-12 before:w-12 before:-translate-y-2/4 before:-translate-x-2/4 before:rounded-full before:bg-bg-surface before:opacity-0 before:transition-opacity checked:border-corphia-bronze checked:bg-accent checked:before:bg-accent dark:checked:border-accent dark:checked:bg-accent dark:checked:before:bg-accent hover:before:opacity-10"
                                                        checked={Boolean(doc.doc_metadata?.isActive ?? true)}
                                                        onChange={() => mainProps.handleToggleDocActive(doc)}
                                                    />
                                                    <div className="pointer-events-none absolute top-2/4 left-2/4 -translate-y-2/4 -translate-x-2/4 text-text-primary opacity-0 transition-opacity peer-checked:opacity-100">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" stroke="currentColor" strokeWidth="1">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                                                        </svg>
                                                    </div>
                                                </label>
                                                
                                                <div className="flex flex-col min-w-0">
                                                    <span className="font-medium text-[15px] text-text-primary truncate">{doc.filename ||"Unknown"}</span>
                                                    <span className="text-[13px] text-text-secondary mt-0.5">
                                                        {new Date(doc.created_at).toLocaleString()} • {Math.round((doc.size_bytes || 0) / 1024)} KB
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-4">
                                                <span className={`text-[12px] px-2.5 py-1 rounded-full font-medium ${
                                                    doc.status === 'completed' ? 'bg-green-100 text-green-700 ' :
                                                    doc.status === 'failed' ? 'bg-red-100 text-red-700 ' :
                                                    'bg-bg-surface text-text-secondary '
                                                }`}>
                                                    {doc.status === 'completed' ? '已處理' : doc.status === 'failed' ? '失敗' : '處理中'}
                                                </span>
                                                
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
                                                    className="p-2 text-text-muted hover:text-red-500 rounded-full hover:bg-red-50 md:opacity-0 group-hover:opacity-100 transition-all"
                                                    title="刪除"
                                                >
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            </div>
                        </div>
                        
                        {/* 專案上傳進度 */}
                        {mainProps.isUploading && mainProps.selectedFolder && (
                            <div className="mt-6 p-4 bg-accent /10 rounded-[20px] border border-corphia-bronze/20 flex items-center justify-between shadow-sm animate-fade-in-up shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-5 h-5 rounded-full border-2 border-corphia-bronze border-t-transparent animate-spin" />
                                    <span className="text-corphia-bronze text-[15px] font-medium">正在上傳並進行語意分析與 Chunking...</span>
                                </div>
                                <span className="text-corphia-bronze font-semibold">{mainProps.uploadProgress}%</span>
                            </div>
                        )}
                        
                        {/* New Chat Button at exactly Folder View */}
                        <div className="mt-8 flex justify-center shrink-0">
                            <button
                                onClick={mainProps.createNewConversation}
                                className="flex items-center gap-2 px-6 py-3 bg-bg-surface border-border-subtle border text-text-primary rounded-full hover:shadow-lg hover:-translate-y-0.5 transition-all font-semibold"
                            >
                                {mainProps.t('chat.askFromSource')}
                            </button>
                        </div>
                    </div>
                ) : (
                <div className="relative flex-1 overflow-hidden h-full flex flex-col">
                    {/* 右側小地圖與置底按鈕 */}
                    <ChatMinimap messages={mainProps.messages} containerRef={mainProps.scrollContainerRef} />
                    <ScrollToBottomButton containerRef={mainProps.scrollContainerRef} dependsOn={mainProps.messages} />
                    
                    <div ref={mainProps.scrollContainerRef} className="flex-1 overflow-y-auto w-full custom-scrollbar pt-6 pb-4 relative">
                        {/* 頂部感應器：無限捲動 */}
                        <div ref={mainProps.topObserverRef} className="w-full h-px opacity-0" />
                        {mainProps.isLoadingMore && (
                            <div className="flex justify-center items-center py-2 text-text-secondary">
                                <span className="animate-spin rounded-full h-4 w-4 border-2 border-border-subtle border-t-text-primary"></span>
                            </div>
                        )}
                        {mainProps.messages.length === 0 ? (
                            // 空狀態：改為置頂與上方留白，讓內容可以自然向上滾動，不要用 flex-center 死鎖
                            <div className="w-full max-w-3xl mx-auto px-4 md:px-0 pb-8 pt-[10vh]">
                                {/* Greeting */}
                                <h2 className="text-[22px] md:text-[26px] font-semibold mb-8 text-text-primary tracking-tight text-center leading-snug">
                                    {mainProps.t('chat.emptyGreeting', { name: mainProps.user?.name || 'User' })}
                                </h2>

                                {/* Suggested Prompts */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full px-2 md:px-0">
                                    {(() => {
                                        const suggestions = (mainProps.t('chat.suggestions', { returnObjects: true }) as { title: string, desc: string }[]) || [
                                            { title:"摘要文件", desc:"幫我整理出一份簡單的重點摘要" },
                                            { title:"翻譯內容", desc:"將這段文字翻譯成通順的在地語言" },
                                            { title:"撰寫 Email", desc:"以專業用語撰寫一封商務合作信件" },
                                            { title:"說明程式碼", desc:"幫我詳細解釋這段程式碼的邏輯" }
                                        ];
                                        const icons = [
                                            <svg className="w-5 h-5 text-accent mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
                                            <svg className="w-5 h-5 text-accent mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 15h2.498M15 15l2.498-5L20 15" /></svg>,
                                            <svg className="w-5 h-5 text-accent mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
                                            <svg className="w-5 h-5 text-accent mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                                        ];
                                        return suggestions.map((item: any, index: number) => (
                                            <button 
                                                key={index}
                                                onClick={() => mainProps.setInput(item.desc)}
                                                className="text-left p-4 rounded-[20px] bg-bg-base border border-border-subtle shadow-lg border-accent hover:-translate-y-[2px] transition-all duration-200 group active:scale-[0.98]"
                                            >
                                                {icons[index % icons.length]}
                                                <div className="font-semibold text-[13px] mb-1.5 text-text-primary text-accent transition-colors">{item.title}</div>
                                                <div className="text-[12px] text-text-secondary text-text-primary leading-relaxed">{item.desc}</div>
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
        </div>
    )
}
