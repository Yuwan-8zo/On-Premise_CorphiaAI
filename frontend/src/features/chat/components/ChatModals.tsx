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
import { ChevronRight, Edit2, Folder, Lock, Share, Trash2 } from '@/components/snow/icons'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from '@/lib/gsapMotion'
import DialogShell from '@/components/ui/DialogShell'
import { dialogSheet } from '@/lib/motionPresets'
import { useKeepInViewport } from '@/lib/useKeepInViewport'

import { DEFAULT_FOLDER } from '../hooks/chatHelpers'
import type { ConvMenuState } from '../hooks/useConversationDialogs'

/* ── Context Menu ── */

interface ContextMenuProps {
    activeMenu: ConvMenuState | null
    menuRef: React.RefObject<HTMLDivElement | null>
    conversations: Array<{ id: string; settings?: Record<string, unknown> }>
    onShare: (id: string) => void
    onUnshare: (id: string) => void
    onRename: (id: string) => void
    onMove: (id: string) => void
    onDelete: (id: string, e: React.MouseEvent) => void
    onClose: () => void
}

export function ConversationContextMenu({
    activeMenu, menuRef, conversations, onShare, onUnshare, onRename, onMove, onDelete, onClose,
}: ContextMenuProps) {
    const { t } = useTranslation()
    // 按鈕靠近螢幕右邊（手機側欄）時，選單往內推，不被切掉
    useKeepInViewport(menuRef, activeMenu, activeMenu?.anchor)

    return (
        <AnimatePresence>
            {activeMenu && (
                <motion.div 
                    ref={menuRef}
                    {...dialogSheet}
                    className="fixed z-[100] w-max min-w-[var(--sz-190)] paper !rounded-[var(--r-20)] overflow-hidden p-1.5 text-text-primary"
                    style={{ left: activeMenu.x, top: activeMenu.y }}
                >
                    <LensMenu className="">
                    <button className="menu-item"
                        onClick={(e) => { e.stopPropagation(); const id = activeMenu.convId; onClose(); setTimeout(() => onShare(id), 50) }}>
                        <Share />
                        {t('chat.shareChat', '分享')}
                    </button>
                    {/* 分享過的對話才有「取消分享」 */}
                    {Boolean(conversations.find((c) => c.id === activeMenu.convId)?.settings?.shared) && (
                        <button className="menu-item"
                            onClick={(e) => { e.stopPropagation(); const id = activeMenu.convId; onClose(); setTimeout(() => onUnshare(id), 50) }}>
                            <Lock />
                            {t('ui.chat.unshare')}
                        </button>
                    )}
                    <button className="menu-item"
                        onClick={(e) => { e.stopPropagation(); const id = activeMenu.convId; onClose(); setTimeout(() => onRename(id), 50) }}>
                        <Edit2 />
                        {t('chat.renameChat', '重新命名')}
                    </button>
                    <button className="menu-item"
                        onClick={(e) => { e.stopPropagation(); const id = activeMenu.convId; onClose(); setTimeout(() => onMove(id), 50) }}>
                        <Folder />
                        <span className="flex-1">{conversations.find(c => c.id === activeMenu.convId)?.settings?.isProject ? t('chat.moveToGeneralChat') : t('chat.moveToProject')}</span>
                        <ChevronRight className="set-chevron !w-[var(--sz-14)] !h-[var(--sz-14)] -mr-1" />
                    </button>
                    <div className="menu-sep" />
                    <button 
                        onClick={(e) => { e.stopPropagation(); const id = activeMenu.convId; onClose(); setTimeout(() => onDelete(id, e as unknown as React.MouseEvent), 50) }}
                        className="menu-item is-danger">
                        <Trash2 />
                        {t('common.delete', '刪除')}
                    </button>
                    </LensMenu>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

/* ── 對話框共用：寬度、輸入框、按鈕列（外殼用 DialogShell） ── */

const SHEET_W = 'w-[var(--sz-360)] max-w-[calc(100vw-32px)]'
const INPUT_CLASS = 'snow-input w-full text-[length:var(--fs-15)] text-text-primary placeholder:text-text-muted'

function DialogActions({ onCancel, onOk, okLabel }: { onCancel: () => void; onOk: () => void; okLabel?: string }) {
    const { t } = useTranslation()
    return (
        <div className="dialog-actions">
            <button onClick={onCancel} className="btn btn-lg btn-secondary">{t('common.cancel', '取消')}</button>
            <button onClick={onOk} className="btn btn-lg btn-primary">{okLabel ?? t('common.confirm', '確定')}</button>
        </div>
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
    const { t } = useTranslation()
    return (
        <DialogShell open={!!renameModal} onClose={onClose} layer="z-[200]" className={SHEET_W}>
            <div className="px-2">
                <h3 className="dialog-title !px-0 mb-4">{t('chat.renameChat', '重新命名')}</h3>
                <input ref={renameInputRef} type="text" value={renameInput}
                    onChange={e => setRenameInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') submitRename() }}
                    className={INPUT_CLASS}
                    placeholder={t('chat.conversationName', '對話名稱')} autoComplete="off" />
            </div>
            <DialogActions onCancel={onClose} onOk={submitRename} />
        </DialogShell>
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
    const allFolders = Array.from(new Set([
        ...savedFolders,
        ...conversations.filter(c => Boolean(c.settings?.isProject)).map(c => (c.settings?.folderName as string) || DEFAULT_FOLDER),
    ]))

    return (
        <DialogShell open={!!moveModal} onClose={onClose} layer="z-[200]" className={SHEET_W}>
            {moveModal?.isProject ? (
                <>
                    <div className="px-2">
                        <h3 className="dialog-title !px-0 mb-2">{t('chat.moveToGeneralChat')}</h3>
                        <p className="text-[length:var(--fs-14)] text-text-secondary">{t('chat.confirmMoveToGeneral', { folder: moveModal.folderName })}</p>
                    </div>
                    <DialogActions onCancel={onClose} onOk={() => submitMove()} />
                </>
            ) : (
                <>
                    <div className="px-2">
                        <h3 className="dialog-title !px-0 mb-4">{t('chat.moveToProject', '移至專案')}</h3>
                        {allFolders.length > 0 && (
                            <div className="mb-4">
                                <p className="text-[length:var(--fs-13)] text-text-secondary mb-2">{t('chat.chooseProject', '選擇現有專案：')}</p>
                                <StyledSelect
                                    value={allFolders.includes(moveInput) ? moveInput : ''}
                                    onChange={setMoveInput}
                                    placeholder={t('chat.chooseProjectPlaceholder', '請選擇專案...')}
                                    options={allFolders.map((folder) => ({ value: folder, label: folder }))}
                                />
                            </div>
                        )}
                        <p className="text-[length:var(--fs-13)] text-text-secondary mb-3">{t('chat.orNewProject', '或輸入新專案名稱：')}</p>
                        <input type="text" value={moveInput} onChange={e => setMoveInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') submitMove() }}
                            className={INPUT_CLASS}
                            placeholder={t('chat.newFolder', '新資料夾')} autoFocus autoComplete="off" />
                    </div>
                    <DialogActions onCancel={onClose} onOk={() => submitMove()} />
                </>
            )}
        </DialogShell>
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
    const { t } = useTranslation()
    return (
        <DialogShell open={show} onClose={onClose} layer="z-[200]" className={SHEET_W}>
            <div className="px-2">
                <h3 className="dialog-title !px-0 mb-1">{t('chat.newFolder', '新資料夾')}</h3>
                <p className="text-[length:var(--fs-13)] text-text-secondary mb-4">{t('chat.newFolderHint', '建立資料夾並自動加入一筆新對話')}</p>
                <input ref={inputRef} type="text" value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') onSubmit() }}
                    className={INPUT_CLASS}
                    placeholder={t('chat.folderName', '資料夾名稱')} autoComplete="off" />
            </div>
            <DialogActions onCancel={onClose} onOk={onSubmit} okLabel={t('chat.create', '建立')} />
        </DialogShell>
    )
}
