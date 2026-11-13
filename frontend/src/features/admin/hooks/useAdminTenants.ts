/**
 * 後台「租戶」：清單、新增／編輯彈窗的表單、啟用／停用
 */
import { useCallback, useMemo, useState } from 'react'
import { tenantsApi, type Tenant } from '@/api/tenants'
import { getErrorMessage } from '@/lib/errors'
import { useToastStore } from '@/store/toastStore'
import { useUIStore } from '@/store/uiStore'
import i18n from '@/i18n'

export interface TenantForm {
    name: string
    slug: string
    description: string
    is_active: boolean
    /** 對外搜尋每次先問使用者才搜（false，預設）還是自動搜尋不用確認（true） */
    web_search_auto: boolean
}

const EMPTY_FORM: TenantForm = { name: '', slug: '', description: '', is_active: true, web_search_auto: false }

export function useAdminTenants() {
    const toast = useToastStore()
    const showConfirm = useUIStore((s) => s.showConfirm)

    const [tenants, setTenants] = useState<Tenant[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [editing, setEditing] = useState<Tenant | null>(null)
    const [form, setForm] = useState<TenantForm>(EMPTY_FORM)

    const loadTenants = useCallback(async () => {
        setIsLoading(true)
        try {
            const data = await tenantsApi.listTenants({ page_size: 100 })
            setTenants(data.data)
        } catch (err) {
            console.error('Failed to load tenants:', err)
        } finally {
            setIsLoading(false)
        }
    }, [])

    const activeTenants = useMemo(() => tenants.filter((t) => t.is_active).length, [tenants])

    const openAdd = () => {
        setEditing(null)
        setForm(EMPTY_FORM)
        setIsModalOpen(true)
    }

    const openEdit = (item: Tenant) => {
        setEditing(item)
        setForm({
            name: item.name, slug: item.slug, description: item.description || '', is_active: item.is_active,
            web_search_auto: Boolean(item.settings?.web_search_auto),
        })
        setIsModalOpen(true)
    }

    const submit = async (event: React.FormEvent) => {
        event.preventDefault()
        setIsSubmitting(true)
        try {
            // settings 整個欄位是後端一次性覆蓋（不是合併），所以要帶著原本的 settings 一起送，
            // 只改 web_search_auto 這一項，不會把這個租戶之後加的其他設定洗掉
            const { web_search_auto, ...rest } = form
            const payload = { ...rest, settings: { ...(editing?.settings || {}), web_search_auto } }
            if (editing) await tenantsApi.updateTenant(editing.id, payload)
            else await tenantsApi.createTenant(payload)
            setIsModalOpen(false)
            loadTenants()
        } catch (err) {
            toast.error(getErrorMessage(err))
        } finally {
            setIsSubmitting(false)
        }
    }

    /** 啟用／停用：只切換 is_active，不刪資料（使用者、對話、文件都還指向這個租戶） */
    const toggleStatus = (item: Tenant) => {
        const message = i18n.t(item.is_active ? 'ui.tenants.confirmDisable' : 'ui.tenants.confirmEnable', { name: item.name })
        showConfirm(message, async () => {
            try {
                await tenantsApi.updateTenant(item.id, { is_active: !item.is_active })
                loadTenants()
            } catch (err) {
                console.error('Failed to toggle tenant status', err)
                toast.error(getErrorMessage(err))
            }
        }, i18n.t('ui.tenants.toggleHint'))
    }

    return {
        tenants, activeTenants, isLoading, loadTenants,
        isModalOpen, setIsModalOpen, isSubmitting, editing, form, setForm,
        openAdd, openEdit, submit, toggleStatus,
    }
}
