/**
 * 後台「資料夾」：清單、新增／編輯視窗的表單、路徑檢查、啟用／停用、取消連接
 *
 * 路徑檢查：打字停下來 0.5 秒（或從「瀏覽」選好）就請後端檢查一次，
 * 結果（可不可以接、裡面有多少檔案）顯示在路徑欄下面；檢查通過才能儲存。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { connectedFoldersApi, type ConnectedFolder, type ConnectedFolderInput, type FolderCheck } from '@/api/connectedFolders'
import { getErrorMessage } from '@/lib/errors'
import { useToastStore } from '@/store/toastStore'
import { useUIStore } from '@/store/uiStore'
import i18n from '@/i18n'

/** 打字停多久才檢查路徑（毫秒） */
const CHECK_DEBOUNCE_MS = 500

const EMPTY_FORM: ConnectedFolderInput = {
    name: '',
    path: '',
    description: '',
    allowed_roles: ['user', 'admin'],
    write_mode: 'output',
    include_subfolders: true,
    scan_interval_min: 10,
    is_enabled: true,
}

export function useAdminFolders() {
    const toast = useToastStore()
    const showConfirm = useUIStore((s) => s.showConfirm)

    const [folders, setFolders] = useState<ConnectedFolder[]>([])
    const [loaded, setLoaded] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [editing, setEditing] = useState<ConnectedFolder | null>(null)
    const [form, setForm] = useState<ConnectedFolderInput>(EMPTY_FORM)
    const [check, setCheck] = useState<FolderCheck | null>(null)
    const [checking, setChecking] = useState(false)
    const checkSeq = useRef(0)

    /** 讀不到清單時的原因（顯示在分頁裡、附「重試」，不跳通知） */
    const [loadError, setLoadError] = useState('')

    // 不依賴 toast 物件：每跳一則通知它就換一個，放進依賴會讓「載入失敗 → 跳通知 → 重新載入」無限循環
    const loadFolders = useCallback(async () => {
        try {
            setFolders(await connectedFoldersApi.list())
            setLoadError('')
        } catch (err) {
            setLoadError(getErrorMessage(err))
        } finally {
            setLoaded(true)
        }
    }, [])

    // 路徑或「包含子資料夾」改了就重新檢查（只在視窗開著時）
    useEffect(() => {
        if (!isModalOpen) return
        const path = form.path.trim()
        if (!path) {
            setCheck(null)
            setChecking(false)
            return
        }
        const seq = ++checkSeq.current
        setChecking(true)
        const id = window.setTimeout(async () => {
            try {
                const res = await connectedFoldersApi.check(path, form.include_subfolders)
                if (seq === checkSeq.current) setCheck(res)
            } catch (err) {
                if (seq === checkSeq.current) setCheck({ ok: false, message: getErrorMessage(err), file_count: 0, total_bytes: 0, by_type: {}, unsupported_count: 0, skipped_sensitive: 0, samples: [], truncated: false })
            } finally {
                if (seq === checkSeq.current) setChecking(false)
            }
        }, CHECK_DEBOUNCE_MS)
        return () => window.clearTimeout(id)
    }, [form.path, form.include_subfolders, isModalOpen])

    const openAdd = () => {
        setEditing(null)
        setForm(EMPTY_FORM)
        setCheck(null)
        setIsModalOpen(true)
    }

    const openEdit = (item: ConnectedFolder) => {
        setEditing(item)
        setForm({
            name: item.name, path: item.path, description: item.description || '', allowed_roles: item.allowed_roles,
            write_mode: item.write_mode, include_subfolders: item.include_subfolders, scan_interval_min: item.scan_interval_min, is_enabled: item.is_enabled,
        })
        setCheck(null)
        setIsModalOpen(true)
    }

    /** 能不能儲存：名稱、至少一個角色、路徑檢查通過（檢查中不行） */
    const canSubmit = !!form.name.trim() && form.allowed_roles.length > 0 && !checking && !!check?.ok

    const submit = async (event: React.FormEvent) => {
        event.preventDefault()
        if (!canSubmit) return
        setIsSubmitting(true)
        try {
            const data = { ...form, name: form.name.trim(), path: form.path.trim(), description: form.description?.trim() || undefined }
            if (editing) await connectedFoldersApi.update(editing.id, data)
            else await connectedFoldersApi.create(data)
            setIsModalOpen(false)
            toast.success(i18n.t(editing ? 'admin.folders.saved' : 'admin.folders.connected', { name: data.name }))
            loadFolders()
        } catch (err) {
            toast.error(getErrorMessage(err))
        } finally {
            setIsSubmitting(false)
        }
    }

    const toggleEnabled = async (item: ConnectedFolder) => {
        // 先改畫面（開關不要等網路），失敗再改回來
        setFolders((list) => list.map((f) => (f.id === item.id ? { ...f, is_enabled: !f.is_enabled } : f)))
        try {
            await connectedFoldersApi.update(item.id, { is_enabled: !item.is_enabled })
        } catch (err) {
            setFolders((list) => list.map((f) => (f.id === item.id ? { ...f, is_enabled: item.is_enabled } : f)))
            toast.error(getErrorMessage(err))
        }
    }

    /** 取消連接：只移除設定與索引，資料夾裡的檔案不會被刪 */
    const disconnect = (item: ConnectedFolder) => {
        showConfirm(i18n.t('admin.folders.confirmDisconnect', { name: item.name }), async () => {
            try {
                await connectedFoldersApi.remove(item.id)
                toast.success(i18n.t('admin.folders.disconnected', { name: item.name }))
                loadFolders()
            } catch (err) {
                toast.error(getErrorMessage(err))
            }
        }, i18n.t('admin.folders.disconnectHint'))
    }

    return {
        folders, loaded, loadError, loadFolders,
        isModalOpen, setIsModalOpen, isSubmitting, editing, form, setForm, check, checking, canSubmit,
        openAdd, openEdit, submit, toggleEnabled, disconnect,
    }
}
