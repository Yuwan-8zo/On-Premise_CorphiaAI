/**
 * 對話的「⋯」選單與彈出視窗：重新命名、移至專案、新增資料夾，以及分享連結、完整性驗證
 */
import { useRef, useState } from 'react'
import { conversationsApi } from '@/api/conversations'
import { foldersApi } from '@/api/folders'
import { copyText } from '@/lib/clipboard'
import { useChatStore } from '@/store/chatStore'
import { useToastStore } from '@/store/toastStore'
import { DEFAULT_FOLDER, folderOf } from './chatHelpers'
import { useDismiss } from '@/lib/useDismiss'
import i18n from '@/i18n'
import { getErrorMessage } from '@/lib/errors'

type ChatMode = 'general' | 'project'

/** 等彈窗畫出來再把游標放進輸入框 */
const focusSoon = (ref: React.RefObject<HTMLInputElement | null>) => setTimeout(() => ref.current?.focus(), 100)

export function useConversationDialogs({
    setChatMode,
    loadFolders,
}: {
    setChatMode: (mode: ChatMode) => void
    loadFolders: () => Promise<void>
}) {
    const toast = useToastStore()
    const { conversations, updateConversation, setCurrentConversation, setMessages } = useChatStore()

    // ── 「⋯」選單 ──
    const [activeMenu, setActiveMenu] = useState<{ convId: string; x: number; y: number } | null>(null)
    const menuRef = useRef<HTMLDivElement>(null)

    // 點外面、按 Esc 關閉。按在「⋯」本身不算點外面：它是按下就打開、可以直接拖到項目上的觸發鈕
    // （用 data-conv-menu 認，不用會隨語言改變的 aria-label）；capture 階段：比其他 onClick 先觸發
    useDismiss(!!activeMenu, () => setActiveMenu(null), [menuRef], { ignore: '[data-conv-menu]', capture: true })

    const handleOpenMenu = (e: React.MouseEvent, convId: string) => {
        e.stopPropagation()
        const rect = e.currentTarget.getBoundingClientRect()
        setActiveMenu({ convId, x: rect.left, y: rect.bottom + 4 }) // 放在按鈕正下方
    }
    const closeMenu = () => setActiveMenu(null)

    // ── 重新命名 ──
    const [renameModal, setRenameModal] = useState<{ convId: string; title: string } | null>(null)
    const [renameInput, setRenameInput] = useState('')
    const renameInputRef = useRef<HTMLInputElement>(null)

    const handleRenameConversation = (convId: string) => {
        const conv = conversations.find((c) => c.id === convId)
        if (!conv) return
        setRenameInput(conv.title)
        setRenameModal({ convId, title: conv.title })
        focusSoon(renameInputRef)
    }

    const submitRename = async () => {
        if (!renameModal) return
        const newTitle = renameInput.trim()
        if (newTitle && newTitle !== renameModal.title) {
            try {
                await conversationsApi.update(renameModal.convId, { title: newTitle })
                updateConversation(renameModal.convId, { title: newTitle })
            } catch (error) {
                console.error('Rename failed:', error)
            }
        }
        setRenameModal(null)
    }

    // ── 移至專案／移回一般聊天 ──
    const [moveModal, setMoveModal] = useState<{ convId: string; isProject: boolean; folderName: string } | null>(null)
    const [moveInput, setMoveInput] = useState('')

    const handleMoveToProject = (convId: string) => {
        const conv = conversations.find((c) => c.id === convId)
        if (!conv) return
        const isProject = Boolean(conv.settings?.isProject)
        const folderName = folderOf(conv.settings)
        setMoveInput(isProject ? '' : folderName)
        setMoveModal({ convId, isProject, folderName })
    }

    const submitMove = async (targetFolder?: string) => {
        if (!moveModal) return
        const base = conversations.find((c) => c.id === moveModal.convId)?.settings
        const toGeneral = moveModal.isProject && !targetFolder
        const newSettings = toGeneral
            ? { ...base, isProject: false }
            : { ...base, isProject: true, folderName: (targetFolder || moveInput).trim() || DEFAULT_FOLDER }
        try {
            await conversationsApi.update(moveModal.convId, { settings: newSettings })
            updateConversation(moveModal.convId, { settings: newSettings })
            setChatMode(toGeneral ? 'general' : 'project')
        } catch (error) {
            console.error('Move failed:', error)
        }
        setMoveModal(null)
    }

    // ── 新增資料夾 ──
    const [newFolderModal, setNewFolderModal] = useState(false)
    const [newFolderInput, setNewFolderInput] = useState('')
    const newFolderInputRef = useRef<HTMLInputElement>(null)

    const openNewFolderModal = () => {
        setNewFolderInput('')
        setNewFolderModal(true)
        focusSoon(newFolderInputRef)
    }

    const submitNewFolder = async () => {
        const folderName = newFolderInput.trim() || DEFAULT_FOLDER
        setNewFolderModal(false)
        setNewFolderInput('')
        try {
            await foldersApi.create(folderName)
            await loadFolders()
        } catch (err) {
            console.error('Failed to create folder:', err)
            toast.error(i18n.t('ui.chat.folderCreateFailed'))
        }
        setChatMode('project')
        // 清空目前選取的對話，顯示空資料夾內容
        setCurrentConversation(null)
        setMessages([])
    }

    // ── 分享、完整性驗證 ──
    const handleShareConversation = async (convId: string) => {
        const link = `${window.location.origin}/share/${convId}`
        // 先開啟分享（同租戶的人才看得到），再複製連結
        try {
            await conversationsApi.share(convId)
            setShared(convId, true)
        } catch (err) {
            toast.error(getErrorMessage(err))
            return
        }
        if (await copyText(link)) toast.success(i18n.t('ui.chat.shareCopied'))
        else toast.error(i18n.t('ui.chat.shareCopyFailed', { link }))
    }

    /** 取消分享：之後只有自己看得到 */
    const handleUnshareConversation = async (convId: string) => {
        try {
            await conversationsApi.unshare(convId)
            setShared(convId, false)
            toast.success(i18n.t('ui.chat.unshared'))
        } catch (err) {
            toast.error(getErrorMessage(err))
        }
    }

    /** 畫面上的分享狀態跟著改（選單才會顯示／隱藏「取消分享」） */
    const setShared = (convId: string, shared: boolean) => {
        const conv = useChatStore.getState().conversations.find((c) => c.id === convId)
        if (conv) updateConversation(convId, { settings: { ...(conv.settings ?? {}), shared } })
    }

    const handleVerifyChain = async (convId: string) => {
        try {
            const res = await conversationsApi.verifyChain(convId)
            // 展示時要讓評審看清楚：通過停留 6 秒、失敗 8 秒
            if (res.valid) toast.add(i18n.t('ui.chat.verifyOk', { n: res.total_messages }), 'success', 6000)
            // first_broken_index 從 0 開始算，給人看要 +1
            else toast.add(i18n.t('ui.chat.verifyBroken', { n: (res.first_broken_index ?? 0) + 1 }), 'error', 8000)
        } catch (err) {
            console.error('驗證失敗', err)
            toast.error(i18n.t('ui.chat.verifyFailed'))
        }
    }

    return {
        activeMenu, menuRef, handleOpenMenu, closeMenu,
        renameModal, setRenameModal, renameInput, setRenameInput, renameInputRef, handleRenameConversation, submitRename,
        moveModal, setMoveModal, moveInput, setMoveInput, handleMoveToProject, submitMove,
        newFolderModal, setNewFolderModal, newFolderInput, setNewFolderInput, newFolderInputRef, openNewFolderModal, submitNewFolder,
        handleShareConversation, handleUnshareConversation, handleVerifyChain,
    }
}
