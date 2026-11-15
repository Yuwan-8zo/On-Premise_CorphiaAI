/**
 * 後台「使用者」：清單、新增／編輯彈窗的表單、刪除、強制登出
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { adminApi } from '@/api/admin'
import { usersApi, type CreateUserPayload, type UpdateUserPayload } from '@/api/users'
import { getErrorMessage } from '@/lib/errors'
import { useToastStore } from '@/store/toastStore'
import { useUIStore } from '@/store/uiStore'
import i18n from '@/i18n'

export interface UserData {
    id: string
    name: string
    email: string
    role: 'engineer' | 'admin' | 'user'
    isActive: boolean
    createdAt: string
    lastLoginAt?: string
}

export interface UserForm {
    name: string
    email: string
    password: string
    role: string
    is_active: boolean
}

const EMPTY_FORM: UserForm = { name: '', email: '', password: '', role: 'user', is_active: true }

export function useAdminUsers() {
    const toast = useToastStore()
    const showConfirm = useUIStore((s) => s.showConfirm)

    const [users, setUsers] = useState<UserData[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [editing, setEditing] = useState<UserData | null>(null)
    const [form, setForm] = useState<UserForm>(EMPTY_FORM)

    const loadUsers = useCallback(async () => {
        setIsLoading(true)
        try {
            const data = await usersApi.listUsers({ page: 1, page_size: 100 })
            setUsers(data.data.map((item) => ({
                id: item.id,
                name: item.name,
                email: item.email,
                role: item.role,
                isActive: item.is_active,
                createdAt: item.created_at,
                lastLoginAt: item.last_login_at ?? undefined,
            })))
        } catch (err) {
            console.error('Failed to load users:', err)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        loadUsers()
    }, [loadUsers])

    const activeUsers = useMemo(() => users.filter((u) => u.isActive).length, [users])

    const openAdd = () => {
        setEditing(null)
        setForm(EMPTY_FORM)
        setIsModalOpen(true)
    }

    const openEdit = (item: UserData) => {
        setEditing(item)
        setForm({ name: item.name, email: item.email, password: '', role: item.role, is_active: item.isActive })
        setIsModalOpen(true)
    }

    const submit = async (event: React.FormEvent) => {
        event.preventDefault()
        setIsSubmitting(true)
        try {
            if (editing) {
                const data: UpdateUserPayload = { name: form.name, role: form.role, is_active: form.is_active }
                if (form.password) data.password = form.password // 沒填新密碼就不改
                await usersApi.updateUser(editing.id, data)
            } else {
                const data: CreateUserPayload = { ...form }
                await usersApi.createUser(data)
            }
            setIsModalOpen(false)
            loadUsers()
        } catch (err) {
            toast.error(getErrorMessage(err))
        } finally {
            setIsSubmitting(false)
        }
    }

    const remove = (item: UserData) => {
        showConfirm(i18n.t('ui.users.confirmDelete', { name: item.name, email: item.email }), async () => {
            try {
                await usersApi.deleteUser(item.id)
                toast.success(i18n.t('ui.users.deleted', { name: item.name }))
                loadUsers()
            } catch (err) {
                console.error('Failed to delete user', err)
                toast.error(getErrorMessage(err))
            }
        })
    }

    const forceLogout = (item: UserData) => {
        showConfirm(i18n.t('ui.users.confirmForceLogout', { name: item.name }), async () => {
            if (await adminApi.forceLogout(item.id)) toast.success(i18n.t('ui.users.forcedOut', { name: item.name }))
            else toast.error(i18n.t('ui.users.forceLogoutFail'))
        })
    }

    return {
        users, activeUsers, isLoading,
        isModalOpen, setIsModalOpen, isSubmitting, editing, form, setForm,
        openAdd, openEdit, submit, remove, forceLogout,
    }
}
