import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Activity,
    ArrowLeft,
    Building2,
    ChevronLeft,
    ChevronRight,
    CircleAlert,
    Cpu,
    Database,
    Download,
    FileText,
    Gauge,
    HardDrive,
    Layers3,
    MessageSquare,
    Plus,
    RefreshCw,
    Search,
    ShieldCheck,
    SlidersHorizontal,
    Sparkles,
    Trash2,
    UserRoundCog,
    Users,
} from 'lucide-react'

import { useAuthStore } from '../store/authStore'
import { apiClient } from '../api/client'
import { getModels, refreshModels, selectModel, type ModelItem } from '../api/models'
import {
    ACTION_LABELS,
    RESOURCE_LABELS,
    exportAuditLogsCSV,
    exportAuditLogsJSON,
    getAuditLogs,
    type AuditLogItem,
    type AuditLogQuery,
} from '../api/auditLogs'
import { tenantsApi, type Tenant } from '../api/tenants'

interface UserData {
    id: string
    name: string
    email: string
    role: 'engineer' | 'admin' | 'user'
    isActive: boolean
    createdAt: string
    lastLoginAt?: string
}

interface Stats {
    totalUsers: number
    totalConversations: number
    totalDocuments: number
    totalMessages: number
}

interface BackendUserResponse {
    id: string
    name: string
    email: string
    role: 'engineer' | 'admin' | 'user'
    is_active: boolean
    created_at: string
    last_login_at?: string
}

interface UpdateUserData {
    name: string
    role: string
    is_active: boolean
    password?: string
}

type AdminSection = 'overview' | 'users' | 'models' | 'audit' | 'system' | 'tenants'

const tabs: Array<{ id: AdminSection; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'overview', label: '總覽', icon: Gauge },
    { id: 'users', label: '使用者', icon: Users },
    { id: 'models', label: '模型', icon: Cpu },
    { id: 'audit', label: '稽核', icon: FileText },
    { id: 'system', label: '系統', icon: Activity },
    { id: 'tenants', label: '租戶', icon: Building2 },
]

function getErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message
    const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
    return detail || '操作失敗'
}

function formatDate(value?: string) {
    if (!value) return '-'
    return new Date(value).toLocaleString('zh-TW', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    })
}

function Panel({ className = '', children }: { className?: string; children: React.ReactNode }) {
    return (
        <section className={`rounded-[28px] border border-gray-200/70 bg-corphia-ivory/78 shadow-[0_30px_90px_rgba(45,40,36,0.12)] backdrop-blur-2xl dark:border-white/10 dark:bg-corphia-espresso/78 dark:shadow-[0_30px_90px_rgba(0,0,0,0.38)] ${className}`}>
            {children}
        </section>
    )
}

function SectionHeader({
    title,
    eyebrow,
    action,
}: {
    title: string
    eyebrow?: string
    action?: React.ReactNode
}) {
    return (
        <div className="flex flex-col gap-4 border-b border-gray-200/70 px-5 py-5 dark:border-white/10 md:flex-row md:items-center md:justify-between md:px-7">
            <div>
                {eyebrow && <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-ios-blue-light dark:text-ios-blue-dark">{eyebrow}</p>}
                <h2 className="text-xl font-semibold tracking-tight text-corphia-ink dark:text-corphia-ivory">{title}</h2>
            </div>
            {action}
        </div>
    )
}

function ActionButton({
    children,
    onClick,
    variant = 'primary',
    disabled,
}: {
    children: React.ReactNode
    onClick?: () => void
    variant?: 'primary' | 'secondary' | 'danger'
    disabled?: boolean
}) {
    const variants = {
        primary: 'border-ios-blue-light/40 bg-ios-blue-light text-white hover:bg-ios-blue-light/90 dark:border-ios-blue-dark/40 dark:bg-ios-blue-dark dark:hover:bg-ios-blue-dark/90',
        secondary: 'border-gray-200/80 bg-corphia-sand/70 text-corphia-ink hover:bg-corphia-beige dark:border-white/10 dark:bg-corphia-ivory/[0.07] dark:text-corphia-ivory dark:hover:bg-corphia-ivory/[0.11]',
        danger: 'border-red-400/30 bg-red-500/14 text-red-200 hover:bg-red-500/22',
    }
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${variants[variant]}`}
        >
            {children}
        </button>
    )
}

function StatusPill({ active }: { active: boolean }) {
    return (
        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${active ? 'border-ios-blue-light/25 bg-ios-blue-light/12 text-ios-blue-light dark:border-ios-blue-dark/25 dark:bg-ios-blue-dark/12 dark:text-ios-blue-dark' : 'border-gray-200/80 bg-corphia-sand/70 text-corphia-warm-gray dark:border-white/10 dark:bg-corphia-ivory/[0.06] dark:text-ios-dark-gray1'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-ios-blue-light dark:bg-ios-blue-dark' : 'bg-corphia-warm-gray dark:bg-ios-dark-gray1'}`} />
            {active ? 'Active' : 'Disabled'}
        </span>
    )
}

function RoleBadge({ role }: { role: UserData['role'] }) {
    const styles = {
        admin: 'border-ios-blue-light/30 bg-ios-blue-light/12 text-ios-blue-light dark:border-ios-blue-dark/30 dark:bg-ios-blue-dark/12 dark:text-ios-blue-dark',
        engineer: 'border-corphia-bronze/30 bg-corphia-bronze/12 text-corphia-bronze dark:text-corphia-beige',
        user: 'border-gray-200/80 bg-corphia-sand/70 text-corphia-warm-gray dark:border-white/10 dark:bg-corphia-ivory/[0.06] dark:text-ios-dark-gray1',
    }
    return <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${styles[role]}`}>{role}</span>
}

function ModalFrame({
    children,
    onClose,
    maxWidth = 'max-w-md',
}: {
    children: React.ReactNode
    onClose: () => void
    maxWidth?: string
}) {
    return createPortal(
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-corphia-ink/40 backdrop-blur-md dark:bg-black/70"
                    onClick={onClose}
                />
                <motion.div
                    initial={{ opacity: 0, y: 16, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 16, scale: 0.98 }}
                    className={`relative w-full ${maxWidth} rounded-[28px] border border-gray-200/80 bg-corphia-ivory p-6 text-corphia-ink shadow-2xl dark:border-white/10 dark:bg-corphia-espresso dark:text-corphia-ivory`}
                >
                    {children}
                </motion.div>
            </div>
        </AnimatePresence>,
        document.body
    )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-corphia-warm-gray dark:text-ios-dark-gray1">{label}</span>
            {children}
        </label>
    )
}

const inputClass = 'w-full rounded-2xl border border-gray-200/80 bg-corphia-sand/70 px-4 py-3 text-sm text-corphia-ink outline-none transition placeholder:text-corphia-warm-gray focus:border-ios-blue-light focus:bg-corphia-ivory dark:border-white/10 dark:bg-black/25 dark:text-corphia-ivory dark:placeholder:text-ios-dark-gray1 dark:focus:border-ios-blue-dark dark:focus:bg-black/35'

export default function Admin() {
    const navigate = useNavigate()
    const { user } = useAuthStore()

    const [activeSection, setActiveSection] = useState<AdminSection>('overview')
    const [users, setUsers] = useState<UserData[]>([])
    const [stats, setStats] = useState<Stats>({
        totalUsers: 0,
        totalConversations: 0,
        totalDocuments: 0,
        totalMessages: 0,
    })
    const [isLoading, setIsLoading] = useState(false)
    const [models, setModels] = useState<ModelItem[]>([])
    const [modelsDir, setModelsDir] = useState('')
    const [isLoadingModels, setIsLoadingModels] = useState(false)

    const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([])
    const [auditTotal, setAuditTotal] = useState(0)
    const [auditPage, setAuditPage] = useState(1)
    const [auditTotalPages, setAuditTotalPages] = useState(0)
    const [isLoadingAudit, setIsLoadingAudit] = useState(false)
    const [auditFilter, setAuditFilter] = useState<AuditLogQuery>({ page: 1, page_size: 15 })
    const [auditSearchInput, setAuditSearchInput] = useState('')

    const [tenants, setTenants] = useState<Tenant[]>([])
    const [isLoadingTenants, setIsLoadingTenants] = useState(false)
    const [isTenantModalOpen, setIsTenantModalOpen] = useState(false)
    const [currentEditingTenant, setCurrentEditingTenant] = useState<Tenant | null>(null)
    const [tenantFormData, setTenantFormData] = useState({ name: '', slug: '', description: '', is_active: true })
    const [isSubmittingTenant, setIsSubmittingTenant] = useState(false)

    const [isUserModalOpen, setIsUserModalOpen] = useState(false)
    const [isSubmittingUser, setIsSubmittingUser] = useState(false)
    const [currentEditingUser, setCurrentEditingUser] = useState<UserData | null>(null)
    const [userFormData, setUserFormData] = useState({ name: '', email: '', password: '', role: 'user', is_active: true })

    useEffect(() => {
        if (user?.role !== 'admin' && user?.role !== 'engineer') navigate('/')
    }, [user, navigate])

    const loadStats = useCallback(async () => {
        try {
            const response = await apiClient.get('/admin/stats')
            if (response.data?.status === 'success') setStats(response.data.data)
        } catch (err) {
            console.error('Failed to load admin stats:', err)
        }
    }, [])

    const loadUsers = useCallback(async () => {
        setIsLoading(true)
        try {
            const response = await apiClient.get('/users?page=1&page_size=100')
            const fetchedUsers = (response.data?.data || []).map((item: BackendUserResponse) => ({
                id: item.id,
                name: item.name,
                email: item.email,
                role: item.role,
                isActive: item.is_active,
                createdAt: item.created_at,
                lastLoginAt: item.last_login_at,
            }))
            setUsers(fetchedUsers)
        } catch (err) {
            console.error('Failed to load users:', err)
        } finally {
            setIsLoading(false)
        }
    }, [])

    const loadModels = useCallback(async () => {
        setIsLoadingModels(true)
        try {
            const data = await getModels()
            setModels(data.models)
            setModelsDir(data.models_dir)
        } catch (err) {
            console.error('Failed to load models:', err)
        } finally {
            setIsLoadingModels(false)
        }
    }, [])

    const loadAuditLogs = useCallback(async (query: AuditLogQuery = auditFilter) => {
        setIsLoadingAudit(true)
        try {
            const data = await getAuditLogs(query)
            setAuditLogs(data.data)
            setAuditTotal(data.total)
            setAuditPage(data.page)
            setAuditTotalPages(data.total_pages)
        } catch (err) {
            console.error('Failed to load audit logs:', err)
        } finally {
            setIsLoadingAudit(false)
        }
    }, [auditFilter])

    const loadTenants = useCallback(async () => {
        setIsLoadingTenants(true)
        try {
            const data = await tenantsApi.listTenants({ page_size: 100 })
            setTenants(data.data)
        } catch (err) {
            console.error('Failed to load tenants:', err)
        } finally {
            setIsLoadingTenants(false)
        }
    }, [])

    useEffect(() => {
        loadStats()
        loadUsers()
    }, [loadStats, loadUsers])

    useEffect(() => {
        if (activeSection === 'models') loadModels()
        if (activeSection === 'audit') loadAuditLogs()
        if (activeSection === 'tenants') loadTenants()
    }, [activeSection, loadAuditLogs, loadModels, loadTenants])

    const activeUsers = useMemo(() => users.filter((item) => item.isActive).length, [users])
    const currentModel = useMemo(() => models.find((item) => item.is_current), [models])
    const activeTenants = useMemo(() => tenants.filter((item) => item.is_active).length, [tenants])

    const handleRefreshModels = async () => {
        setIsLoadingModels(true)
        try {
            const data = await refreshModels()
            setModels(data.models)
        } catch (err) {
            console.error('Failed to refresh models:', err)
        } finally {
            setIsLoadingModels(false)
        }
    }

    const handleSelectModel = async (name: string) => {
        try {
            await selectModel(name)
            loadModels()
        } catch (err) {
            console.error('Failed to select model:', err)
        }
    }

    const handleAuditSearch = () => {
        const nextFilter = { ...auditFilter, search: auditSearchInput || undefined, page: 1 }
        setAuditFilter(nextFilter)
        loadAuditLogs(nextFilter)
    }

    const handleAuditFilterChange = (key: keyof AuditLogQuery, value: string) => {
        const nextFilter = { ...auditFilter, [key]: value || undefined, page: 1 }
        setAuditFilter(nextFilter)
        loadAuditLogs(nextFilter)
    }

    const handleAuditPageChange = (page: number) => {
        const nextFilter = { ...auditFilter, page }
        setAuditFilter(nextFilter)
        loadAuditLogs(nextFilter)
    }

    const handleExportCSV = async () => {
        const blob = await exportAuditLogsCSV({
            action: auditFilter.action,
            resource_type: auditFilter.resource_type,
            start_date: auditFilter.start_date,
            end_date: auditFilter.end_date,
        })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`
        anchor.click()
        URL.revokeObjectURL(url)
    }

    const handleExportJSON = async () => {
        const blob = await exportAuditLogsJSON({
            action: auditFilter.action,
            resource_type: auditFilter.resource_type,
            start_date: auditFilter.start_date,
            end_date: auditFilter.end_date,
        })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.json`
        anchor.click()
        URL.revokeObjectURL(url)
    }

    const handleAddUser = () => {
        setCurrentEditingUser(null)
        setUserFormData({ name: '', email: '', password: '', role: 'user', is_active: true })
        setIsUserModalOpen(true)
    }

    const handleEditUser = (item: UserData) => {
        setCurrentEditingUser(item)
        setUserFormData({
            name: item.name,
            email: item.email,
            password: '',
            role: item.role,
            is_active: item.isActive,
        })
        setIsUserModalOpen(true)
    }

    const handleUserSubmit = async (event: React.FormEvent) => {
        event.preventDefault()
        setIsSubmittingUser(true)
        try {
            if (currentEditingUser) {
                const updateData: UpdateUserData = {
                    name: userFormData.name,
                    role: userFormData.role,
                    is_active: userFormData.is_active,
                }
                if (userFormData.password) updateData.password = userFormData.password
                await apiClient.put(`/users/${currentEditingUser.id}`, updateData)
            } else {
                await apiClient.post('/users', userFormData)
            }
            setIsUserModalOpen(false)
            loadUsers()
        } catch (err) {
            window.alert(getErrorMessage(err))
        } finally {
            setIsSubmittingUser(false)
        }
    }

    const handleDeleteUser = async (item: UserData) => {
        if (!window.confirm(`確定要刪除 ${item.name}？此操作會移除該使用者。`)) return
        try {
            await apiClient.delete(`/users/${item.id}`)
            loadUsers()
        } catch (err) {
            window.alert(getErrorMessage(err))
        }
    }

    const handleAddTenant = () => {
        setCurrentEditingTenant(null)
        setTenantFormData({ name: '', slug: '', description: '', is_active: true })
        setIsTenantModalOpen(true)
    }

    const handleEditTenant = (item: Tenant) => {
        setCurrentEditingTenant(item)
        setTenantFormData({
            name: item.name,
            slug: item.slug,
            description: item.description || '',
            is_active: item.is_active,
        })
        setIsTenantModalOpen(true)
    }

    const handleTenantSubmit = async (event: React.FormEvent) => {
        event.preventDefault()
        setIsSubmittingTenant(true)
        try {
            if (currentEditingTenant) await tenantsApi.updateTenant(currentEditingTenant.id, tenantFormData)
            else await tenantsApi.createTenant(tenantFormData)
            setIsTenantModalOpen(false)
            loadTenants()
        } catch (err) {
            window.alert(getErrorMessage(err))
        } finally {
            setIsSubmittingTenant(false)
        }
    }

    const handleToggleTenantStatus = async (item: Tenant) => {
        const action = item.is_active ? '停用' : '啟用'
        if (!window.confirm(`確定要${action}租戶 ${item.name}？`)) return
        try {
            if (item.is_active) await tenantsApi.deleteTenant(item.id)
            else await tenantsApi.updateTenant(item.id, { is_active: true })
            loadTenants()
        } catch (err) {
            window.alert(getErrorMessage(err))
        }
    }

    const metricCards = [
        { label: 'Users', value: stats.totalUsers, detail: `${activeUsers} active`, icon: Users, accent: 'from-ios-blue-light/28 to-corphia-beige/45 dark:from-ios-blue-dark/30 dark:to-corphia-espresso/30' },
        { label: 'Conversations', value: stats.totalConversations, detail: 'live workspace', icon: MessageSquare, accent: 'from-corphia-bronze/32 to-corphia-sand/45 dark:from-corphia-bronze/26 dark:to-corphia-espresso/30' },
        { label: 'Documents', value: stats.totalDocuments, detail: 'indexed sources', icon: Layers3, accent: 'from-corphia-warm-gray/28 to-corphia-beige/45 dark:from-corphia-warm-gray/24 dark:to-corphia-espresso/30' },
        { label: 'Messages', value: stats.totalMessages, detail: 'audit trail', icon: FileText, accent: 'from-corphia-ink/18 to-corphia-sand/45 dark:from-corphia-ivory/12 dark:to-corphia-espresso/30' },
    ]

    return (
        <div className="min-h-screen overflow-hidden bg-corphia-ivory text-corphia-ink dark:bg-corphia-obsidian dark:text-corphia-ivory">
            <div className="pointer-events-none fixed inset-0 opacity-80">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_12%,rgb(var(--color-ios-accent-light)/0.13),transparent_32%),linear-gradient(145deg,#F6F4F0_0%,#ECE8E1_42%,#DDD8D0_100%)] dark:bg-[radial-gradient(circle_at_70%_12%,rgb(var(--color-ios-accent-dark)/0.15),transparent_32%),linear-gradient(145deg,#1F2125_0%,#2A2D33_44%,#17191C_100%)]" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(45,40,36,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(45,40,36,0.035)_1px,transparent_1px)] bg-[size:72px_72px] dark:bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.028)_1px,transparent_1px)]" />
                <div className="absolute left-[8%] top-[18%] h-[48rem] w-[58rem] rotate-[-10deg] rounded-[42%] border border-corphia-ink/[0.05] dark:border-white/[0.035]" />
                <div className="absolute right-[8%] top-[6%] h-[34rem] w-[34rem] rotate-12 rounded-[36%] border border-ios-blue-light/10 dark:border-ios-blue-dark/10" />
            </div>

            <div className="relative mx-auto flex min-h-screen max-w-[1480px] flex-col px-4 py-4 md:px-6 lg:px-8">
                <header className="mb-5 flex flex-col gap-4 rounded-[30px] border border-gray-200/70 bg-corphia-ivory/78 p-4 shadow-[0_24px_80px_rgba(45,40,36,0.12)] backdrop-blur-2xl dark:border-white/10 dark:bg-corphia-espresso/78 dark:shadow-[0_24px_80px_rgba(0,0,0,0.35)] md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/')}
                            className="flex h-11 w-11 items-center justify-center rounded-full border border-gray-200/80 bg-corphia-sand/70 text-corphia-warm-gray transition hover:bg-corphia-beige hover:text-corphia-ink dark:border-white/10 dark:bg-corphia-ivory/[0.06] dark:text-ios-dark-gray1 dark:hover:bg-corphia-ivory/[0.11] dark:hover:text-corphia-ivory"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-ios-blue-light dark:text-ios-blue-dark">Corphia Control</p>
                            <h1 className="text-2xl font-semibold tracking-tight text-corphia-ink dark:text-corphia-ivory md:text-3xl">管理後台</h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="hidden rounded-full border border-ios-blue-light/20 bg-ios-blue-light/10 px-4 py-2 text-sm font-semibold text-ios-blue-light dark:border-ios-blue-dark/20 dark:bg-ios-blue-dark/10 dark:text-ios-blue-dark sm:flex">
                            Backend Online
                        </div>
                        <div className="rounded-full border border-gray-200/80 bg-corphia-sand/70 px-4 py-2 text-sm text-corphia-warm-gray dark:border-white/10 dark:bg-corphia-ivory/[0.06] dark:text-ios-dark-gray1">
                            {user?.name || 'Operator'}
                        </div>
                    </div>
                </header>

                <main className="grid flex-1 gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
                    <aside className="rounded-[30px] border border-gray-200/70 bg-corphia-ivory/78 p-3 shadow-[0_30px_80px_rgba(45,40,36,0.12)] backdrop-blur-2xl dark:border-white/10 dark:bg-corphia-espresso/78 dark:shadow-[0_30px_80px_rgba(0,0,0,0.28)] lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
                        <div className="mb-4 rounded-[24px] border border-gray-200/70 bg-corphia-sand/55 p-4 dark:border-white/10 dark:bg-black/20">
                            <div className="mb-6 flex items-center justify-between">
                                <div>
                                    <p className="text-[11px] uppercase tracking-[0.22em] text-corphia-warm-gray dark:text-ios-dark-gray1">Current Model</p>
                                    <p className="mt-1 truncate text-sm font-semibold text-corphia-ink dark:text-corphia-ivory">{currentModel?.name || 'Standby'}</p>
                                </div>
                                <Sparkles className="h-5 w-5 text-ios-blue-light dark:text-ios-blue-dark" />
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-corphia-beige/70 dark:bg-corphia-ivory/[0.08]">
                                <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-ios-blue-light via-corphia-bronze to-corphia-warm-gray dark:from-ios-blue-dark dark:via-corphia-bronze dark:to-corphia-beige" />
                            </div>
                        </div>

                        <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
                            {tabs.map((tab) => {
                                const Icon = tab.icon
                                const active = activeSection === tab.id
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveSection(tab.id)}
                                        className={`flex min-w-max items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition lg:min-w-0 ${
                                            active
                                                ? 'border-ios-blue-light/40 bg-ios-blue-light/15 text-corphia-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.24)] dark:border-ios-blue-dark/40 dark:bg-ios-blue-dark/16 dark:text-corphia-ivory'
                                                : 'border-transparent text-corphia-warm-gray hover:border-gray-200/80 hover:bg-corphia-sand/70 hover:text-corphia-ink dark:text-ios-dark-gray1 dark:hover:border-white/10 dark:hover:bg-corphia-ivory/[0.06] dark:hover:text-corphia-ivory'
                                        }`}
                                    >
                                        <Icon className={`h-4 w-4 ${active ? 'text-ios-blue-light dark:text-ios-blue-dark' : ''}`} />
                                        {tab.label}
                                    </button>
                                )
                            })}
                        </nav>
                    </aside>

                    <div className="min-w-0 space-y-5 pb-8">
                        {activeSection === 'overview' && (
                            <>
                                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                    {metricCards.map((item) => {
                                        const Icon = item.icon
                                        return (
                                            <Panel key={item.label} className="overflow-hidden p-5">
                                                <div className={`mb-7 h-20 rounded-[22px] bg-gradient-to-br ${item.accent} p-4`}>
                                                    <Icon className="h-6 w-6 text-corphia-ink dark:text-corphia-ivory" />
                                                </div>
                                                <p className="text-4xl font-light tracking-tight text-corphia-ink dark:text-corphia-ivory">{item.value.toLocaleString()}</p>
                                                <div className="mt-2 flex items-center justify-between text-sm">
                                                    <span className="font-medium text-corphia-ink/80 dark:text-corphia-ivory/80">{item.label}</span>
                                                    <span className="text-corphia-warm-gray dark:text-ios-dark-gray1">{item.detail}</span>
                                                </div>
                                            </Panel>
                                        )
                                    })}
                                </section>

                                <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                                    <Panel className="overflow-hidden">
                                        <SectionHeader title="Operational Map" eyebrow="System pulse" />
                                        <div className="relative min-h-[430px] overflow-hidden p-5">
                                            <div className="absolute inset-0 opacity-70">
                                                <div className="absolute left-[-8%] top-[16%] h-56 w-[115%] rotate-[-8deg] border-y border-dashed border-corphia-warm-gray/20 dark:border-white/12" />
                                                <div className="absolute left-[12%] top-[28%] h-64 w-64 rounded-full border border-dashed border-corphia-warm-gray/20 dark:border-white/15" />
                                                <div className="absolute bottom-10 right-10 h-64 w-96 rotate-[-16deg] rounded-[42px] border border-ios-blue-light/12 dark:border-ios-blue-dark/12" />
                                            </div>
                                            <div className="relative grid h-full gap-4 md:grid-cols-2">
                                                <div className="rounded-[26px] border border-gray-200/70 bg-corphia-sand/55 p-5 backdrop-blur-xl dark:border-white/10 dark:bg-black/20">
                                                    <p className="text-sm text-corphia-warm-gray dark:text-ios-dark-gray1">Operational Efficiency</p>
                                                    <p className="mt-4 text-6xl font-extralight tracking-tight text-corphia-ink dark:text-corphia-ivory">78.3<span className="text-2xl text-corphia-warm-gray dark:text-ios-dark-gray1">%</span></p>
                                                    <div className="mt-8 h-32 rounded-2xl border border-gray-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.5),rgba(255,255,255,0.18))] p-4 dark:border-white/8 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))]">
                                                        <div className="mt-12 h-px bg-gradient-to-r from-transparent via-corphia-warm-gray/55 to-transparent dark:via-white/55" />
                                                        <div className="-mt-8 ml-8 h-12 w-32 rounded-[50%] border-t border-ios-blue-light dark:border-ios-blue-dark" />
                                                    </div>
                                                </div>
                                                <div className="space-y-4">
                                                    <div className="rounded-[26px] border border-red-300/12 bg-red-500/10 p-5 backdrop-blur-xl">
                                                        <div className="flex items-start justify-between">
                                                            <div>
                                                                <p className="text-sm text-red-100/70">Capacity Issues</p>
                                                                <p className="mt-2 text-2xl font-light text-corphia-ink dark:text-corphia-ivory">2 lines</p>
                                                            </div>
                                                            <CircleAlert className="h-5 w-5 text-red-200" />
                                                        </div>
                                                    </div>
                                                    <div className="rounded-[26px] border border-gray-200/70 bg-corphia-sand/55 p-5 backdrop-blur-xl dark:border-white/10 dark:bg-corphia-ivory/[0.06]">
                                                        <p className="text-sm text-corphia-warm-gray dark:text-ios-dark-gray1">Live Passenger Volume</p>
                                                        <p className="mt-3 text-4xl font-light tracking-tight text-corphia-ink dark:text-corphia-ivory">142,580</p>
                                                        <div className="mt-5 grid grid-cols-4 gap-2 text-xs text-corphia-warm-gray dark:text-ios-dark-gray1">
                                                            <span>06:00</span><span>12:00</span><span>18:00</span><span>21:00</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </Panel>

                                    <Panel>
                                        <SectionHeader title="Recent Access" eyebrow="Operators" />
                                        <div className="space-y-3 p-5">
                                            {users.slice(0, 6).map((item) => (
                                                <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-gray-200/70 bg-corphia-sand/55 p-3 dark:border-white/8 dark:bg-corphia-ivory/[0.045]">
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ios-blue-light/12 text-sm font-bold text-ios-blue-light dark:bg-ios-blue-dark/12 dark:text-ios-blue-dark">
                                                        {item.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-sm font-semibold text-corphia-ink dark:text-corphia-ivory">{item.name}</p>
                                                        <p className="truncate text-xs text-corphia-warm-gray dark:text-ios-dark-gray1">{item.email}</p>
                                                    </div>
                                                    <StatusPill active={item.isActive} />
                                                </div>
                                            ))}
                                        </div>
                                    </Panel>
                                </section>
                            </>
                        )}

                        {activeSection === 'users' && (
                            <Panel className="overflow-hidden">
                                <SectionHeader
                                    title={`使用者管理 (${users.length})`}
                                    eyebrow={`${activeUsers} active operators`}
                                    action={<ActionButton onClick={handleAddUser}><Plus className="h-4 w-4" />新增使用者</ActionButton>}
                                />
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[760px]">
                                        <thead className="border-b border-gray-200/70 text-left text-xs uppercase tracking-[0.18em] text-corphia-warm-gray dark:border-white/10 dark:text-ios-dark-gray1">
                                            <tr>
                                                <th className="px-6 py-4">User</th>
                                                <th className="px-6 py-4">Role</th>
                                                <th className="px-6 py-4">Status</th>
                                                <th className="px-6 py-4">Last Login</th>
                                                <th className="px-6 py-4 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200/70 dark:divide-white/8">
                                            {isLoading ? (
                                                <tr><td className="px-6 py-10 text-center text-corphia-warm-gray dark:text-ios-dark-gray1" colSpan={5}>Loading users...</td></tr>
                                            ) : users.map((item) => (
                                                <tr key={item.id} className="transition hover:bg-corphia-sand/45 dark:hover:bg-corphia-ivory/[0.035]">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-ios-blue-light/12 text-sm font-bold text-ios-blue-light dark:bg-ios-blue-dark/12 dark:text-ios-blue-dark">{item.name.charAt(0).toUpperCase()}</div>
                                                            <div>
                                                                <p className="font-semibold text-corphia-ink dark:text-corphia-ivory">{item.name}</p>
                                                                <p className="text-sm text-corphia-warm-gray dark:text-ios-dark-gray1">{item.email}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4"><RoleBadge role={item.role} /></td>
                                                    <td className="px-6 py-4"><StatusPill active={item.isActive} /></td>
                                                    <td className="px-6 py-4 text-sm text-corphia-warm-gray dark:text-ios-dark-gray1">{formatDate(item.lastLoginAt)}</td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex justify-end gap-2">
                                                            <ActionButton variant="secondary" onClick={() => handleEditUser(item)}><UserRoundCog className="h-4 w-4" />編輯</ActionButton>
                                                            <ActionButton variant="danger" onClick={() => handleDeleteUser(item)}><Trash2 className="h-4 w-4" />刪除</ActionButton>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </Panel>
                        )}

                        {activeSection === 'models' && (
                            <div className="space-y-5">
                                <Panel>
                                    <SectionHeader
                                        title="模型管理"
                                        eyebrow={modelsDir || 'ai_model'}
                                        action={<ActionButton onClick={handleRefreshModels} disabled={isLoadingModels}><RefreshCw className="h-4 w-4" />重新掃描</ActionButton>}
                                    />
                                    <div className="grid gap-4 p-5">
                                        {isLoadingModels ? (
                                            <div className="py-10 text-center text-corphia-warm-gray dark:text-ios-dark-gray1">Loading models...</div>
                                        ) : models.map((model) => (
                                            <div key={model.name} className="flex flex-col gap-4 rounded-[24px] border border-gray-200/70 bg-corphia-sand/55 p-5 dark:border-white/10 dark:bg-corphia-ivory/[0.045] md:flex-row md:items-center md:justify-between">
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-3">
                                                        <p className="truncate text-lg font-semibold text-corphia-ink dark:text-corphia-ivory">{model.name}</p>
                                                        {model.is_current && <span className="rounded-full border border-ios-blue-light/30 bg-ios-blue-light/12 px-3 py-1 text-xs font-bold text-ios-blue-light dark:border-ios-blue-dark/30 dark:bg-ios-blue-dark/12 dark:text-ios-blue-dark">CURRENT</span>}
                                                        {model.quantization && <span className="rounded-full border border-gray-200/80 px-3 py-1 text-xs font-mono text-corphia-warm-gray dark:border-white/10 dark:text-ios-dark-gray1">{model.quantization}</span>}
                                                    </div>
                                                    <div className="mt-3 flex flex-wrap gap-4 text-sm text-corphia-warm-gray dark:text-ios-dark-gray1">
                                                        <span className="inline-flex items-center gap-2"><HardDrive className="h-4 w-4" />{model.size_gb} GB</span>
                                                        <span className="truncate">{model.filename}</span>
                                                    </div>
                                                </div>
                                                {!model.is_current && <ActionButton variant="secondary" onClick={() => handleSelectModel(model.name)}>選用模型</ActionButton>}
                                            </div>
                                        ))}
                                    </div>
                                </Panel>
                            </div>
                        )}

                        {activeSection === 'audit' && (
                            <div className="space-y-5">
                                <Panel className="p-5">
                                    <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
                                        <Field label="Search">
                                            <div className="flex gap-2">
                                                <input className={inputClass} value={auditSearchInput} onChange={(event) => setAuditSearchInput(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && handleAuditSearch()} placeholder="Email, action, description..." />
                                                <ActionButton onClick={handleAuditSearch}><Search className="h-4 w-4" />搜尋</ActionButton>
                                            </div>
                                        </Field>
                                        <Field label="Action">
                                            <select className={inputClass} value={auditFilter.action || ''} onChange={(event) => handleAuditFilterChange('action', event.target.value)}>
                                                <option value="">All actions</option>
                                                <option value="login_success">登入成功</option>
                                                <option value="login_failed">登入失敗</option>
                                                <option value="user_update">使用者更新</option>
                                                <option value="document_upload">文件上傳</option>
                                                <option value="document_delete">文件刪除</option>
                                            </select>
                                        </Field>
                                        <Field label="Resource">
                                            <select className={inputClass} value={auditFilter.resource_type || ''} onChange={(event) => handleAuditFilterChange('resource_type', event.target.value)}>
                                                <option value="">All resources</option>
                                                <option value="auth">Auth</option>
                                                <option value="user">User</option>
                                                <option value="conversation">Conversation</option>
                                                <option value="document">Document</option>
                                                <option value="model">Model</option>
                                            </select>
                                        </Field>
                                        <div className="flex gap-2">
                                            <ActionButton variant="secondary" onClick={handleExportCSV}><Download className="h-4 w-4" />CSV</ActionButton>
                                            <ActionButton variant="secondary" onClick={handleExportJSON}><Download className="h-4 w-4" />JSON</ActionButton>
                                        </div>
                                    </div>
                                </Panel>
                                <Panel className="overflow-hidden">
                                    <SectionHeader
                                        title="稽核紀錄"
                                        eyebrow={`${auditTotal.toLocaleString()} events`}
                                        action={
                                            <div className="flex items-center gap-2">
                                                <ActionButton variant="secondary" disabled={auditPage <= 1} onClick={() => handleAuditPageChange(auditPage - 1)}><ChevronLeft className="h-4 w-4" /></ActionButton>
                                                <span className="text-sm text-corphia-warm-gray dark:text-ios-dark-gray1">{auditPage} / {auditTotalPages || 1}</span>
                                                <ActionButton variant="secondary" disabled={auditPage >= auditTotalPages} onClick={() => handleAuditPageChange(auditPage + 1)}><ChevronRight className="h-4 w-4" /></ActionButton>
                                            </div>
                                        }
                                    />
                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-[900px]">
                                            <thead className="border-b border-gray-200/70 text-left text-xs uppercase tracking-[0.18em] text-corphia-warm-gray dark:border-white/10 dark:text-ios-dark-gray1">
                                                <tr>
                                                    <th className="px-5 py-4">Time</th>
                                                    <th className="px-5 py-4">Action</th>
                                                    <th className="px-5 py-4">Resource</th>
                                                    <th className="px-5 py-4">User</th>
                                                    <th className="px-5 py-4">Description</th>
                                                    <th className="px-5 py-4">IP</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200/70 dark:divide-white/8">
                                                {isLoadingAudit ? (
                                                    <tr><td className="px-5 py-10 text-center text-corphia-warm-gray dark:text-ios-dark-gray1" colSpan={6}>Loading audit log...</td></tr>
                                                ) : auditLogs.length === 0 ? (
                                                    <tr><td className="px-5 py-10 text-center text-corphia-warm-gray dark:text-ios-dark-gray1" colSpan={6}>No audit events</td></tr>
                                                ) : auditLogs.map((log) => (
                                                    <tr key={log.id} className="transition hover:bg-corphia-sand/45 dark:hover:bg-corphia-ivory/[0.035]">
                                                        <td className="px-5 py-4 text-sm text-corphia-warm-gray dark:text-ios-dark-gray1">{formatDate(log.created_at)}</td>
                                                        <td className="px-5 py-4"><span className="rounded-full border border-gray-200/80 bg-corphia-sand/70 px-3 py-1 text-xs font-semibold text-corphia-ink dark:border-white/10 dark:bg-corphia-ivory/[0.06] dark:text-corphia-ivory">{ACTION_LABELS[log.action] || log.action}</span></td>
                                                        <td className="px-5 py-4 text-sm text-corphia-ink/80 dark:text-corphia-ivory/80">{RESOURCE_LABELS[log.resource_type] || log.resource_type}</td>
                                                        <td className="max-w-[180px] truncate px-5 py-4 text-sm text-corphia-warm-gray dark:text-ios-dark-gray1">{log.user_email || log.user_id || '-'}</td>
                                                        <td className="max-w-[300px] truncate px-5 py-4 text-sm text-corphia-warm-gray dark:text-ios-dark-gray1">{log.description || '-'}</td>
                                                        <td className="px-5 py-4 font-mono text-xs text-corphia-warm-gray/70 dark:text-ios-dark-gray2">{log.ip_address || '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </Panel>
                            </div>
                        )}

                        {activeSection === 'system' && (
                            <div className="grid gap-5 xl:grid-cols-2">
                                <Panel>
                                    <SectionHeader title="系統資訊" eyebrow="Runtime" />
                                    <div className="grid gap-4 p-5 sm:grid-cols-2">
                                        {[
                                            ['Version', '2.3.0', ShieldCheck],
                                            ['Backend', 'FastAPI', Database],
                                            ['LLM Engine', 'Ollama / GGUF', Cpu],
                                            ['Vector Store', 'pgvector', Layers3],
                                            ['Database', 'PostgreSQL', HardDrive],
                                            ['Runtime', 'Python 3.12', Activity],
                                        ].map(([label, value, Icon]) => {
                                            const IconComp = Icon as React.ComponentType<{ className?: string }>
                                            return (
                                                <div key={label as string} className="rounded-[24px] border border-gray-200/70 bg-corphia-sand/55 p-5 dark:border-white/10 dark:bg-corphia-ivory/[0.045]">
                                                    <IconComp className="mb-5 h-5 w-5 text-ios-blue-light dark:text-ios-blue-dark" />
                                                    <p className="text-xs uppercase tracking-[0.18em] text-corphia-warm-gray dark:text-ios-dark-gray1">{label as string}</p>
                                                    <p className="mt-2 text-lg font-semibold text-corphia-ink dark:text-corphia-ivory">{value as string}</p>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </Panel>
                                <Panel>
                                    <SectionHeader title="維運操作" eyebrow="Maintenance" />
                                    <div className="space-y-3 p-5">
                                        <ActionButton variant="secondary"><RefreshCw className="h-4 w-4" />清除快取</ActionButton>
                                        <ActionButton variant="secondary"><SlidersHorizontal className="h-4 w-4" />重新索引向量</ActionButton>
                                        <ActionButton variant="danger"><CircleAlert className="h-4 w-4" />重啟服務</ActionButton>
                                    </div>
                                </Panel>
                            </div>
                        )}

                        {activeSection === 'tenants' && (
                            <Panel className="overflow-hidden">
                                <SectionHeader
                                    title={`租戶管理 (${tenants.length})`}
                                    eyebrow={`${activeTenants} active tenants`}
                                    action={<ActionButton onClick={handleAddTenant}><Plus className="h-4 w-4" />新增租戶</ActionButton>}
                                />
                                <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
                                    {isLoadingTenants ? (
                                        <div className="col-span-full py-10 text-center text-corphia-warm-gray dark:text-ios-dark-gray1">Loading tenants...</div>
                                    ) : tenants.length === 0 ? (
                                        <div className="col-span-full py-10 text-center text-corphia-warm-gray dark:text-ios-dark-gray1">No tenants</div>
                                    ) : tenants.map((item) => (
                                        <div key={item.id} className="rounded-[24px] border border-gray-200/70 bg-corphia-sand/55 p-5 dark:border-white/10 dark:bg-corphia-ivory/[0.045]">
                                            <div className="mb-5 flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="truncate text-lg font-semibold text-corphia-ink dark:text-corphia-ivory">{item.name}</p>
                                                    <p className="mt-1 inline-flex rounded-full bg-corphia-beige/70 px-3 py-1 font-mono text-xs text-corphia-warm-gray dark:bg-black/25 dark:text-ios-dark-gray1">{item.slug}</p>
                                                </div>
                                                <StatusPill active={item.is_active} />
                                            </div>
                                            <p className="min-h-[44px] text-sm leading-relaxed text-corphia-warm-gray dark:text-ios-dark-gray1">{item.description || 'No description'}</p>
                                            <div className="mt-6 flex justify-end gap-2">
                                                <ActionButton variant="secondary" onClick={() => handleToggleTenantStatus(item)}>{item.is_active ? '停用' : '啟用'}</ActionButton>
                                                <ActionButton onClick={() => handleEditTenant(item)}>編輯</ActionButton>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Panel>
                        )}
                    </div>
                </main>
            </div>

            {isUserModalOpen && (
                <ModalFrame onClose={() => setIsUserModalOpen(false)}>
                    <h3 className="mb-6 text-xl font-semibold">{currentEditingUser ? '編輯使用者' : '新增使用者'}</h3>
                    <form onSubmit={handleUserSubmit} className="space-y-4">
                        <Field label="Name"><input className={inputClass} required value={userFormData.name} onChange={(event) => setUserFormData((prev) => ({ ...prev, name: event.target.value }))} /></Field>
                        <Field label="Email"><input className={inputClass} type="email" required disabled={!!currentEditingUser} value={userFormData.email} onChange={(event) => setUserFormData((prev) => ({ ...prev, email: event.target.value }))} /></Field>
                        <Field label={currentEditingUser ? 'New password' : 'Password'}><input className={inputClass} type="password" required={!currentEditingUser} minLength={8} value={userFormData.password} onChange={(event) => setUserFormData((prev) => ({ ...prev, password: event.target.value }))} /></Field>
                        <Field label="Role">
                            <select className={inputClass} value={userFormData.role} onChange={(event) => setUserFormData((prev) => ({ ...prev, role: event.target.value }))}>
                                <option value="user">User</option>
                                <option value="engineer">Engineer</option>
                                <option value="admin">Admin</option>
                            </select>
                        </Field>
                        <label className="flex items-center justify-between rounded-2xl border border-gray-200/80 bg-corphia-sand/70 px-4 py-3 text-sm text-corphia-ink dark:border-white/10 dark:bg-black/20 dark:text-corphia-ivory">
                            啟用帳號
                            <input type="checkbox" checked={userFormData.is_active} onChange={(event) => setUserFormData((prev) => ({ ...prev, is_active: event.target.checked }))} />
                        </label>
                        <div className="flex gap-3 pt-4">
                            <ActionButton variant="secondary" onClick={() => setIsUserModalOpen(false)}>取消</ActionButton>
                            <ActionButton disabled={isSubmittingUser}>{isSubmittingUser ? '儲存中...' : '儲存'}</ActionButton>
                        </div>
                    </form>
                </ModalFrame>
            )}

            {isTenantModalOpen && (
                <ModalFrame onClose={() => setIsTenantModalOpen(false)}>
                    <h3 className="mb-6 text-xl font-semibold">{currentEditingTenant ? '編輯租戶' : '新增租戶'}</h3>
                    <form onSubmit={handleTenantSubmit} className="space-y-4">
                        <Field label="Name"><input className={inputClass} required value={tenantFormData.name} onChange={(event) => setTenantFormData((prev) => ({ ...prev, name: event.target.value }))} /></Field>
                        <Field label="Slug"><input className={inputClass} required value={tenantFormData.slug} onChange={(event) => setTenantFormData((prev) => ({ ...prev, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} /></Field>
                        <Field label="Description"><textarea className={inputClass} rows={3} value={tenantFormData.description} onChange={(event) => setTenantFormData((prev) => ({ ...prev, description: event.target.value }))} /></Field>
                        <label className="flex items-center justify-between rounded-2xl border border-gray-200/80 bg-corphia-sand/70 px-4 py-3 text-sm text-corphia-ink dark:border-white/10 dark:bg-black/20 dark:text-corphia-ivory">
                            啟用租戶
                            <input type="checkbox" checked={tenantFormData.is_active} onChange={(event) => setTenantFormData((prev) => ({ ...prev, is_active: event.target.checked }))} />
                        </label>
                        <div className="flex gap-3 pt-4">
                            <ActionButton variant="secondary" onClick={() => setIsTenantModalOpen(false)}>取消</ActionButton>
                            <ActionButton disabled={isSubmittingTenant}>{isSubmittingTenant ? '儲存中...' : '儲存'}</ActionButton>
                        </div>
                    </form>
                </ModalFrame>
            )}
        </div>
    )
}
