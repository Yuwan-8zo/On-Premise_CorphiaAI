/**
 * 對話 Modal 集合
 * 
 * 從 Chat.tsx 拆分出來，包含：
 * - ConversationContextMenu（右鍵選單）
 * - RenameModal（重新命名對話）
 * - MoveToProjectModal（移至專案資料夾）
 * - NewFolderModal（新建資料夾）
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'

const DEFAULT_FOLDER = '新資料夾'

/* ── Context Menu ── */

interface ContextMenuProps {
    activeMenu: { convId: string; x: number; y: number } | null
    menuRef: React.RefObject<HTMLDivElement | null>
    conversations: Array<{ id: string; settings?: Record<string, unknown> }>
    onShare: (id: string) => void
    onRename: (id: string) => void
    onMove: (id: string) => void
    onDelete: (id: string, e: React.MouseEvent) => void
    onClose: () => void
}

export function ConversationContextMenu({
    activeMenu, menuRef, conversations, onShare, onRename, onMove, onDelete, onClose,
}: ContextMenuProps) {
    const { t } = useTranslation()

    return (
        <AnimatePresence>
            {activeMenu && (
                <motion.div 
                    ref={menuRef}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.1 }}
                    className="fixed z-[100] w-[160px] bg-white dark:bg-ios-dark-gray5 border border-gray-100 dark:border-white/5 shadow-lg dark:shadow-2xl rounded-[16px] overflow-hidden p-1.5 text-[14px] font-medium text-gray-800 dark:text-gray-200"
                    style={{ left: activeMenu.x, top: Math.min(activeMenu.y, window.innerHeight - 300) }}
                >
                    <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[8px] hover:bg-gray-50 dark:hover:bg-ios-dark-gray4 transition-colors text-left"
                        onClick={(e) => { e.stopPropagation(); const id = activeMenu.convId; onClose(); setTimeout(() => onShare(id), 50) }}>
                        <svg className="w-4 h-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        分享
                    </button>
                    <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[8px] hover:bg-gray-50 dark:hover:bg-ios-dark-gray4 transition-colors text-left"
                        onClick={(e) => { e.stopPropagation(); const id = activeMenu.convId; onClose(); setTimeout(() => onRename(id), 50) }}>
                        <svg className="w-4 h-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        重新命名
                    </button>
                    <button className="w-full flex items-center justify-between px-3 py-2.5 rounded-[8px] hover:bg-gray-50 dark:hover:bg-ios-dark-gray4 transition-colors text-left group"
                        onClick={(e) => { e.stopPropagation(); const id = activeMenu.convId; onClose(); setTimeout(() => onMove(id), 50) }}>
                        <div className="flex items-center gap-3">
                            <svg className="w-4 h-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                            <span>{conversations.find(c => c.id === activeMenu.convId)?.settings?.isProject ? t('chat.moveToGeneralChat') : t('chat.moveToProject')}</span>
                        </div>
                        <svg className="w-4 h-4 opacity-0 group-hover:opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                    <div className="h-[1px] bg-gray-100 dark:bg-white/5 my-1 mx-3" />
                    <button 
                        onClick={(e) => { e.stopPropagation(); const id = activeMenu.convId; onClose(); setTimeout(() => onDelete(id, e as unknown as React.MouseEvent), 50) }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[8px] hover:bg-red-50 dark:hover:bg-red-900/40 text-red-500 transition-colors text-left group">
                        <svg className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        刪除
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

/* ── Rename Modal ── */

interface RenameModalProps {
    renameModal: { convId: string; title: string } | null
    renameInput: string
    renameInputRef: React.RefObject<HTMLInputElement | null>
    setRenameInput: (val: string) => void
    submitRename: () => void
    onClose: () => void
}

export function RenameModal({ renameModal, renameInput, renameInputRef, setRenameInput, submitRename, onClose }: RenameModalProps) {
    return (
        <AnimatePresence>
            {renameModal && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
                    <motion.div initial={{ scale: 0.93, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.93, opacity: 0 }}
                        transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                        className="bg-white dark:bg-ios-dark-gray5 rounded-[20px] shadow-2xl w-[340px] overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="px-6 pt-6 pb-4">
                            <h3 className="text-[17px] font-semibold text-gray-900 dark:text-white mb-4">重新命名</h3>
                            <input ref={renameInputRef} type="text" value={renameInput}
                                onChange={e => setRenameInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') onClose() }}
                                className="w-full px-4 py-2.5 bg-ios-light-gray6 dark:bg-ios-dark-gray4 border border-gray-200 dark:border-white/10 rounded-xl text-[15px] text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-ios-blue-light dark:focus:border-ios-blue-dark focus:ring-2 focus:ring-ios-blue-light/20 dark:focus:ring-ios-blue-dark/20 transition-all"
                                placeholder="對話名稱" autoComplete="off" />
                        </div>
                        <div className="flex border-t border-gray-100 dark:border-white/5">
                            <button onClick={onClose} className="flex-1 py-3.5 text-[16px] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors font-medium">取消</button>
                            <div className="w-px bg-gray-100 dark:bg-white/5" />
                            <button onClick={submitRename} className="flex-1 py-3.5 text-[16px] text-ios-blue-light dark:text-ios-blue-dark hover:bg-blue-50 dark:hover:bg-ios-blue-dark/10 transition-colors font-semibold">確定</button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

/* ── Move to Project Modal ── */

interface MoveModalProps {
    moveModal: { convId: string; isProject: boolean; folderName: string } | null
    moveInput: string
    setMoveInput: (val: string) => void
    savedFolders: string[]
    conversations: Array<{ id: string; settings?: Record<string, unknown> }>
    submitMove: (targetFolder?: string) => void
    onClose: () => void
}

export function MoveToProjectModal({ moveModal, moveInput, setMoveInput, savedFolders, conversations, submitMove, onClose }: MoveModalProps) {
    const { t } = useTranslation()

    return (
        <AnimatePresence>
            {moveModal && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
                    <motion.div initial={{ scale: 0.93, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.93, opacity: 0 }}
                        transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                        className="bg-white dark:bg-ios-dark-gray5 rounded-[20px] shadow-2xl w-[340px] overflow-hidden" onClick={e => e.stopPropagation()}>
                        {moveModal.isProject ? (
                            <>
                                <div className="px-6 pt-6 pb-4">
                                    <h3 className="text-[17px] font-semibold text-gray-900 dark:text-white mb-2">{t('chat.moveToGeneralChat')}</h3>
                                    <p className="text-[14px] text-gray-500 dark:text-gray-400">{t('chat.confirmMoveToGeneral', { folder: moveModal.folderName })}</p>
                                </div>
                                <div className="flex border-t border-gray-100 dark:border-white/5">
                                    <button onClick={onClose} className="flex-1 py-3.5 text-[16px] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors font-medium">取消</button>
                                    <div className="w-px bg-gray-100 dark:bg-white/5" />
                                    <button onClick={() => submitMove()} className="flex-1 py-3.5 text-[16px] text-ios-blue-light dark:text-ios-blue-dark hover:bg-blue-50 dark:hover:bg-ios-blue-dark/10 transition-colors font-semibold">確定</button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="px-6 pt-6 pb-4">
                                    <h3 className="text-[17px] font-semibold text-gray-900 dark:text-white mb-4">移至專案</h3>
                                    {(() => {
                                        const allFolders = Array.from(new Set([...savedFolders, ...conversations.filter(c => Boolean(c.settings?.isProject)).map(c => (c.settings?.folderName as string) || DEFAULT_FOLDER)]))
                                        if (allFolders.length > 0) {
                                            return (
                                                <div className="mb-4">
                                                    <p className="text-[13px] text-gray-500 dark:text-gray-400 mb-2">選擇現有專案：</p>
                                                    <div className="relative">
                                                        <select value={allFolders.includes(moveInput) ? moveInput : ''}
                                                            onChange={e => setMoveInput(e.target.value)}
                                                            className="w-full px-4 py-2.5 bg-ios-light-gray6 dark:bg-ios-dark-gray4 border border-gray-200 dark:border-white/10 rounded-xl text-[15px] text-gray-900 dark:text-white outline-none focus:border-ios-blue-light dark:focus:border-ios-blue-dark focus:ring-2 focus:ring-ios-blue-light/20 dark:focus:ring-ios-blue-dark/20 transition-all cursor-pointer appearance-none">
                                                            <option value="" disabled>請選擇專案...</option>
                                                            {allFolders.map(folder => (<option key={folder} value={folder}>{folder}</option>))}
                                                        </select>
                                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 dark:text-gray-400">
                                                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        }
                                        return null
                                    })()}
                                    <p className="text-[13px] text-gray-500 dark:text-gray-400 mb-3">或輸入新專案名稱：</p>
                                    <input type="text" value={moveInput} onChange={e => setMoveInput(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') submitMove(); if (e.key === 'Escape') onClose() }}
                                        className="w-full px-4 py-2.5 bg-ios-light-gray6 dark:bg-ios-dark-gray4 border border-gray-200 dark:border-white/10 rounded-xl text-[15px] text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-ios-blue-light dark:focus:border-ios-blue-dark focus:ring-2 focus:ring-ios-blue-light/20 dark:focus:ring-ios-blue-dark/20 transition-all"
                                        placeholder="新資料夾" autoFocus autoComplete="off" />
                                </div>
                                <div className="flex border-t border-gray-100 dark:border-white/5">
                                    <button onClick={onClose} className="flex-1 py-3.5 text-[16px] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors font-medium">取消</button>
                                    <div className="w-px bg-gray-100 dark:bg-white/5" />
                                    <button onClick={() => submitMove()} className="flex-1 py-3.5 text-[16px] text-ios-blue-light dark:text-ios-blue-dark hover:bg-blue-50 dark:hover:bg-ios-blue-dark/10 transition-colors font-semibold">確定</button>
                                </div>
                            </>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

/* ── New Folder Modal ── */

interface NewFolderModalProps {
    show: boolean
    input: string
    inputRef: React.RefObject<HTMLInputElement | null>
    setInput: (val: string) => void
    onSubmit: () => void
    onClose: () => void
}

export function NewFolderModal({ show, input, inputRef, setInput, onSubmit, onClose }: NewFolderModalProps) {
    return (
        <AnimatePresence>
            {show && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
                    <motion.div initial={{ scale: 0.93, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.93, opacity: 0 }}
                        transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                        className="bg-white dark:bg-ios-dark-gray5 rounded-[20px] shadow-2xl w-[340px] overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="px-6 pt-6 pb-4">
                            <h3 className="text-[17px] font-semibold text-gray-900 dark:text-white mb-1">新建資料夾</h3>
                            <p className="text-[13px] text-gray-500 dark:text-gray-400 mb-4">建立資料夾並自動加入一筆新對話</p>
                            <input ref={inputRef} type="text" value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') onSubmit(); if (e.key === 'Escape') onClose() }}
                                className="w-full px-4 py-2.5 bg-ios-light-gray6 dark:bg-ios-dark-gray4 border border-gray-200 dark:border-white/10 rounded-xl text-[15px] text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-ios-blue-light dark:focus:border-ios-blue-dark focus:ring-2 focus:ring-ios-blue-light/20 dark:focus:ring-ios-blue-dark/20 transition-all"
                                placeholder="資料夾名稱" autoComplete="off" />
                        </div>
                        <div className="flex border-t border-gray-100 dark:border-white/5">
                            <button onClick={onClose} className="flex-1 py-3.5 text-[16px] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors font-medium">取消</button>
                            <div className="w-px bg-gray-100 dark:bg-white/5" />
                            <button onClick={onSubmit} className="flex-1 py-3.5 text-[16px] text-ios-blue-light dark:text-ios-blue-dark hover:bg-blue-50 dark:hover:bg-ios-blue-dark/10 transition-colors font-semibold">建立</button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
