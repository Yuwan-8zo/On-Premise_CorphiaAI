/**
 * 對話 Modal 集合
 * 
 * 從 Chat.tsx 拆分出來，包含：
 * - ConversationContextMenu（右鍵選單）
 * - RenameModal（重新命名對話）
 * - MoveToProjectModal（移至專案資料夾）
 * - NewFolderModal（新建資料夾）
 */

import StyledSelect from '@/components/ui/StyledSelect'
import LensMenu from '@/components/ui/LensMenu'
import { ChevronRight, Edit2, Folder, Share, Trash2 } from '@/components/snow/icons'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from '@/lib/gsapMotion'

import { DEFAULT_FOLDER } from '../hooks/chatHelpers'

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
                    transition={{ duration: 0.3 }}
                    className="fixed z-[100] w-max min-w-[190px] paper !rounded-[20px] overflow-hidden p-1.5 text-text-primary"
                    style={{ left: activeMenu.x, top: Math.min(activeMenu.y, window.innerHeight - 300) }}
                >
                    <LensMenu className="">
                    <button className="menu-item"
                        onClick={(e) => { e.stopPropagation(); const id = activeMenu.convId; onClose(); setTimeout(() => onShare(id), 50) }}>
                        <Share />
                        分享
                    </button>
                    <button className="menu-item"
                        onClick={(e) => { e.stopPropagation(); const id = activeMenu.convId; onClose(); setTimeout(() => onRename(id), 50) }}>
                        <Edit2 />
                        重新命名
                    </button>
                    <button className="menu-item"
                        onClick={(e) => { e.stopPropagation(); const id = activeMenu.convId; onClose(); setTimeout(() => onMove(id), 50) }}>
                        <Folder />
                        <span className="flex-1">{conversations.find(c => c.id === activeMenu.convId)?.settings?.isProject ? t('chat.moveToGeneralChat') : t('chat.moveToProject')}</span>
                        <ChevronRight className="set-chevron !w-[14px] !h-[14px] -mr-1" />
                    </button>
                    <div className="menu-sep" />
                    <button 
                        onClick={(e) => { e.stopPropagation(); const id = activeMenu.convId; onClose(); setTimeout(() => onDelete(id, e as unknown as React.MouseEvent), 50) }}
                        className="menu-item is-danger">
                        <Trash2 />
                        刪除
                    </button>
                    </LensMenu>
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
                <motion.div
                    key="rename-backdrop"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
                    className="fixed inset-0 z-[200] bg-black/20 dark:bg-black/45 backdrop-blur-md" onClick={onClose}
                />
            )}
            {renameModal && (
                <motion.div
                    key="rename-modal"
                    initial={{ scale: 0.93, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.93, opacity: 0 }}
                    transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                    className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none"
                >
                    <div className="dialog-sheet w-[360px] max-w-[calc(100vw-32px)] pointer-events-auto" onClick={e => e.stopPropagation()}>
                        <div className="px-2">
                            <h3 className="dialog-title !px-0 mb-4">重新命名</h3>
                            <input ref={renameInputRef} type="text" value={renameInput}
                                onChange={e => setRenameInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') onClose() }}
                                className="snow-input w-full text-[15px] text-text-primary placeholder:text-text-muted"
                                placeholder="對話名稱" autoComplete="off" />
                        </div>
                        <div className="dialog-actions">
                            <button onClick={onClose} className="btn btn-lg btn-secondary">取消</button>
                            <button onClick={submitRename} className="btn btn-lg btn-primary">確定</button>
                        </div>
                    </div>
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
                <motion.div
                    key="move-backdrop"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
                    className="fixed inset-0 z-[200] bg-black/20 dark:bg-black/45 backdrop-blur-md" onClick={onClose}
                />
            )}
            {moveModal && (
                <motion.div
                    key="move-modal"
                    initial={{ scale: 0.93, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.93, opacity: 0 }}
                    transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                    className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none"
                >
                    <div className="dialog-sheet w-[360px] max-w-[calc(100vw-32px)] pointer-events-auto" onClick={e => e.stopPropagation()}>
                        {moveModal.isProject ? (
                            <>
                                <div className="px-2">
                                    <h3 className="dialog-title !px-0 mb-2">{t('chat.moveToGeneralChat')}</h3>
                                    <p className="text-[14px] text-text-secondary">{t('chat.confirmMoveToGeneral', { folder: moveModal.folderName })}</p>
                                </div>
                                <div className="dialog-actions">
                            <button onClick={onClose} className="btn btn-lg btn-secondary">取消</button>
                            <button onClick={() => submitMove()} className="btn btn-lg btn-primary">確定</button>
                        </div>
                            </>
                        ) : (
                            <>
                                <div className="px-2">
                                    <h3 className="dialog-title !px-0 mb-4">移至專案</h3>
                                    {(() => {
                                        const allFolders = Array.from(new Set([...savedFolders, ...conversations.filter(c => Boolean(c.settings?.isProject)).map(c => (c.settings?.folderName as string) || DEFAULT_FOLDER)]))
                                        if (allFolders.length > 0) {
                                            return (
                                                <div className="mb-4">
                                                    <p className="text-[13px] text-text-secondary mb-2">選擇現有專案：</p>
                                                    <StyledSelect
                                                        value={allFolders.includes(moveInput) ? moveInput : ''}
                                                        onChange={setMoveInput}
                                                        placeholder="請選擇專案..."
                                                        options={allFolders.map((folder) => ({ value: folder, label: folder }))}
                                                    />
                                                </div>
                                            )
                                        }
                                        return null
                                    })()}
                                    <p className="text-[13px] text-text-secondary mb-3">或輸入新專案名稱：</p>
                                    <input type="text" value={moveInput} onChange={e => setMoveInput(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') submitMove(); if (e.key === 'Escape') onClose() }}
                                        className="snow-input w-full text-[15px] text-text-primary placeholder:text-text-muted"
                                        placeholder="新資料夾" autoFocus autoComplete="off" />
                                </div>
                                <div className="dialog-actions">
                            <button onClick={onClose} className="btn btn-lg btn-secondary">取消</button>
                            <button onClick={() => submitMove()} className="btn btn-lg btn-primary">確定</button>
                        </div>
                            </>
                        )}
                    </div>
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
                <motion.div
                    key="folder-backdrop"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
                    className="fixed inset-0 z-[200] bg-black/20 dark:bg-black/45 backdrop-blur-md" onClick={onClose}
                />
            )}
            {show && (
                <motion.div
                    key="folder-modal"
                    initial={{ scale: 0.93, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.93, opacity: 0 }}
                    transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                    className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none"
                >
                    <div className="dialog-sheet w-[360px] max-w-[calc(100vw-32px)] pointer-events-auto" onClick={e => e.stopPropagation()}>
                        <div className="px-2">
                            <h3 className="dialog-title !px-0 mb-1">新建資料夾</h3>
                            <p className="text-[13px] text-text-secondary mb-4">建立資料夾並自動加入一筆新對話</p>
                            <input ref={inputRef} type="text" value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') onSubmit(); if (e.key === 'Escape') onClose() }}
                                className="snow-input w-full text-[15px] text-text-primary placeholder:text-text-muted"
                                placeholder="資料夾名稱" autoComplete="off" />
                        </div>
                        <div className="dialog-actions">
                            <button onClick={onClose} className="btn btn-lg btn-secondary">取消</button>
                            <button onClick={onSubmit} className="btn btn-lg btn-primary">建立</button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
