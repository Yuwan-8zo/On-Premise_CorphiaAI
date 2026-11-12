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
            toast.error('建立資料夾失敗')
        }
        setChatMode('project')
        // 清空目前選取的對話，顯示空資料夾內容
        setCurrentConversation(null)
        setMessages([])
    }

    // ── 分享、完整性驗證 ──
    const handleShareConversation = async (convId: string) => {
        const link = `${window.location.origin}/share/${convId}`
        if (await copyText(link)) toast.success('已成功複製對話分享連結！')
        else toast.error('複製失敗，請手動複製連結：' + link)
    }

    const handleVerifyChain = async (convId: string) => {
        try {
            const res = await conversationsApi.verifyChain(convId)
            // 展示時要讓評審看清楚：通過停留 6 秒、失敗 8 秒
            if (res.valid) toast.add(`對話完整性驗證通過：共 ${res.total_messages} 則訊息皆未被竄改（雜湊鏈）`, 'success', 6000)
            else toast.add(`對話紀錄遭竄改！第 ${res.first_broken_index} 則訊息的雜湊鏈斷裂`, 'error', 8000)
        } catch (err) {
            console.error('驗證失敗', err)
            toast.error('無法進行對話完整性驗證')
        }
    }

    return {
        activeMenu, menuRef, handleOpenMenu, closeMenu,
        renameModal, setRenameModal, renameInput, setRenameInput, renameInputRef, handleRenameConversation, submitRename,
        moveModal, setMoveModal, moveInput, setMoveInput, handleMoveToProject, submitMove,
        newFolderModal, setNewFolderModal, newFolderInput, setNewFolderInput, newFolderInputRef, openNewFolderModal, submitNewFolder,
        handleShareConversation, handleVerifyChain,
    }
}
