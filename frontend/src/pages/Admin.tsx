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
    Clipboard,
    ClipboardCheck,
    Cpu,
    Database,
    Download,
    FileText,
    Gauge,
    Globe,
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
import SystemMonitorPanel from '../components/system/SystemMonitorPanel'
import { useTranslation } from 'react-i18next'

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

const TABS_CONFIG: Array<{ id: AdminSection; i18nKey: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'overview', i18nKey: 'admin.tabs.overview', icon: Gauge },
    { id: 'users', i18nKey: 'admin.tabs.users', icon: Users },
    { id: 'models', i18nKey: 'admin.tabs.models', icon: Cpu },
    { id: 'audit', i18nKey: 'admin.tabs.audit', icon: FileText },
    { id: 'system', i18nKey: 'admin.tabs.system', icon: Activity },
    { id: 'tenants', i18nKey: 'admin.tabs.tenants', icon: Building2 },
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
        <section className={`rounded-[20px] border border-border-subtle bg-bg-surface shadow-sm ${className}`}>
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
        <div className="flex flex-col gap-4 border-b border-border-subtle px-6 py-5 md:flex-row md:items-center md:justify-between">
            <div>
                {eyebrow && <p className="mb-1 text-[12px] font-semibold uppercase tracking-wider text-accent">{eyebrow}</p>}
                <h2 className="text-xl font-semibold tracking-tight text-text-primary">{title}</h2>
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
        primary: 'bg-accent text-white hover:bg-accent/90 shadow-sm',
        secondary: 'border border-border-subtle bg-bg-base text-text-primary hover:bg-bg-base/80',
        danger: 'border border-red-500/20 bg-red-500/10 text-red-500 hover:bg-red-500/20',
    }
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]}`}
        >
            {children}
        </button>
    )
}

function StatusPill({ active }: { active: boolean }) {
    const { t } = useTranslation()
    return (
        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${active ? 'border-accent/20 bg-accent/10 text-accent' : 'border-border-subtle bg-bg-surface text-text-secondary'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-accent' : 'bg-text-secondary'}`} />
            {active ? t('common.active') : t('common.disabled')}
        </span>
    )
}

function RoleBadge({ role }: { role: UserData['role'] }) {
    const { t } = useTranslation()
    const styles = {
        admin: 'border-accent/20 bg-accent/10 text-accent',
        engineer: 'border-accent/20 bg-accent/10 text-accent',
        user: 'border-border-subtle bg-bg-surface text-text-secondary',
    }
    const roleLabels = {
        admin: t('admin.users.role.admin', { defaultValue: 'Admin' }),
        engineer: t('admin.users.role.engineer', { defaultValue: 'Engineer' }),
        user: t('admin.users.role.user', { defaultValue: 'User' }),
    }
    return <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${styles[role]}`}>{roleLabels[role]}</span>
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
            <motion.div
                key="admin-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md"
                onClick={onClose}
            />
            <motion.div
                key="admin-modal"
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
                <div
                    className={`relative w-full ${maxWidth} rounded-[20px] border border-border-subtle bg-bg-surface p-6 text-text-primary shadow-xl pointer-events-auto`}
                    onClick={e => e.stopPropagation()}
                >
                    {children}
                </div>
            </motion.div>
        </AnimatePresence>,
        document.body
    )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">{label}</span>
            {children}
        </label>
    )
}

const inputClass = 'w-full rounded-[16px] border border-border-subtle bg-bg-base px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent placeholder:text-text-secondary'

export default function Admin() {
    const { t } = useTranslation()
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

    // ngrok URL 狀態
    const [ngrokInfo, setNgrokInfo] = useState<{
        active: boolean
        url: string | null
        api_url: string | null
        ws_url: string | null
    } | null>(null)
    const [isLoadingNgrok, setIsLoadingNgrok] = useState(false)
    const [ngrokCopied, setNgrokCopied] = useState(false)

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

    const loadNgrokUrl = useCallback(async () => {
        setIsLoadingNgrok(true)
        try {
            const response = await apiClient.get('/system/ngrok-url')
            setNgrokInfo(response.data)
        } catch (err) {
            console.error('Failed to load ngrok URL:', err)
            setNgrokInfo({ active: false, url: null, api_url: null, ws_url: null })
        } finally {
            setIsLoadingNgrok(false)
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
        loadNgrokUrl()
    }, [loadStats, loadUsers, loadNgrokUrl])

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
        { label: t('admin.overview.users'), value: stats.totalUsers, detail: t('admin.overview.usersDetail', { active: activeUsers }), icon: Users, accent: 'from-accent/28 to-corphia-beige/45 /30 /30' },
        { label: t('admin.overview.conversations'), value: stats.totalConversations, detail: t('admin.overview.conversationsDetail'), icon: MessageSquare, accent: 'from-corphia-bronze/32 to-corphia-sand/45 /26 /30' },
        { label: t('admin.overview.documents'), value: stats.totalDocuments, detail: t('admin.overview.documentsDetail'), icon: Layers3, accent: 'from-corphia-warm-gray/28 to-corphia-beige/45 /24 /30' },
        { label: t('admin.overview.messages'), value: stats.totalMessages, detail: t('admin.overview.messagesDetail'), icon: FileText, accent: 'from-corphia-ink/18 to-corphia-sand/45 /30' },
    ]

    // 一鍵複製 ngrok URL
    const handleCopyNgrokUrl = async () => {
        if (!ngrokInfo?.url) return
        await navigator.clipboard.writeText(ngrokInfo.url)
        setNgrokCopied(true)
        setTimeout(() => setNgrokCopied(false), 2000)
    }

    return (
        <div className="h-screen overflow-hidden bg-[#F6F4F0] dark:bg-[#101012] transition-colors duration-500 text-text-primary">

            <div className="relative mx-auto flex h-full max-w-[1480px] flex-col px-4 py-4 md:px-6 lg:px-8">
                <header className="mb-5 flex flex-col gap-4 rounded-[20px] border border-border-subtle bg-bg-surface p-4 shadow-sm md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/')}
                            className="flex h-11 w-11 items-center justify-center rounded-full border border-border-subtle bg-bg-base text-text-secondary transition hover:bg-bg-surface hover:text-text-primary"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <div>
                            <p className="text-[12px] font-bold uppercase tracking-wider text-accent">Corphia Control</p>
                            <h1 className="text-2xl font-semibold tracking-tight text-text-primary md:text-3xl">{t('admin.title')}</h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="hidden rounded-full border border-accent bg-accent/10 px-4 py-2 text-sm font-semibold text-accent sm:flex">
                            {t('admin.backendOnline')}
                        </div>
                        <div className="rounded-full border border-border-subtle bg-bg-surface px-4 py-2 text-sm text-text-secondary">
                            {user?.name || t('admin.operator')}
                        </div>
                    </div>
                </header>

                <main className="grid flex-1 min-h-0 gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
                    <aside className="flex h-full flex-col overflow-hidden rounded-[20px] border border-border-subtle bg-bg-surface p-3 shadow-sm">
                        <div className="mb-4 rounded-[16px] border border-border-subtle bg-bg-base p-4">
                            <div className="mb-6 flex items-center justify-between">
                                <div>
                                    <p className="text-[12px] uppercase tracking-wider text-text-secondary">{t('admin.currentModel')}</p>
                                    <p className="mt-1 truncate text-sm font-semibold text-text-primary">{currentModel?.name || t('admin.standby')}</p>
                                </div>
                                <Sparkles className="h-5 w-5 text-accent" />
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-border-subtle/50">
                                <div className="h-full w-[72%] rounded-full bg-accent" />
                            </div>
                        </div>

                        <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-y-auto custom-scrollbar">
                            {TABS_CONFIG.map((tab) => {
                                const Icon = tab.icon
                                const active = activeSection === tab.id
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveSection(tab.id)}
                                        className={`flex min-w-max items-center gap-3 rounded-[16px] px-4 py-3 text-left text-sm font-semibold transition lg:min-w-0 ${
                                            active
                                                ? 'bg-accent/10 text-accent'
                                                : 'text-text-secondary hover:bg-bg-base hover:text-text-primary'
                                        }`}
                                    >
                                        <Icon className={`h-4 w-4 ${active ? 'text-accent ' : ''}`} />
                                        {t(tab.i18nKey)}
                                    </button>
                                )
                            })}
                        </nav>
                    </aside>

                    <div className="h-full min-w-0 space-y-5 overflow-y-auto pb-8 pr-2 custom-scrollbar">
                        {activeSection === 'overview' && (
                            <>
                                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                    {metricCards.map((item) => {
                                        const Icon = item.icon
                                        return (
                                            <Panel key={item.label} className="overflow-hidden p-5 flex flex-col justify-between h-40">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-accent/10">
                                                        <Icon className="h-6 w-6 text-accent" />
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="text-4xl font-light tracking-tight text-text-primary">{item.value.toLocaleString()}</p>
                                                    <div className="mt-2 flex items-center justify-between text-sm">
                                                        <span className="font-medium text-text-primary/80">{item.label}</span>
                                                        <span className="text-text-secondary">{item.detail}</span>
                                                    </div>
                                                </div>
                                            </Panel>
                                        )
                                    })}
                                </section>

                                {/* ── Ngrok 公開網址卡片 ── */}
                                <Panel className="overflow-hidden">
                                    <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10">
                                                <Globe className="h-4 w-4 text-accent" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold uppercase tracking-wider text-accent">Remote Access</p>
                                                <p className="text-sm font-semibold text-text-primary">Ngrok 公開網址</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={loadNgrokUrl}
                                            disabled={isLoadingNgrok}
                                            className="flex items-center gap-1.5 rounded-full border border-border-subtle bg-bg-base px-3 py-1.5 text-xs font-semibold text-text-secondary transition hover:text-text-primary disabled:opacity-50"
                                        >
                                            <RefreshCw className={`h-3.5 w-3.5 ${isLoadingNgrok ? 'animate-spin' : ''}`} />
                                            重新整理
                                        </button>
                                    </div>
                                    <div className="p-5">
                                        {isLoadingNgrok ? (
                                            <div className="flex items-center gap-2 text-sm text-text-secondary">
                                                <RefreshCw className="h-4 w-4 animate-spin" />
                                                查詢 ngrok 狀態中...
                                            </div>
                                        ) : ngrokInfo?.active ? (
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-3 rounded-[14px] border border-accent/20 bg-accent/5 px-4 py-3">
                                                    <span className="h-2 w-2 rounded-full bg-accent animate-pulse shrink-0" />
                                                    <span className="flex-1 truncate font-mono text-sm text-text-primary">{ngrokInfo.url}</span>
                                                    <button
                                                        onClick={handleCopyNgrokUrl}
                                                        className="flex shrink-0 items-center gap-1.5 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent transition hover:bg-accent/20"
                                                    >
                                                        {ngrokCopied
                                                            ? <><ClipboardCheck className="h-3.5 w-3.5" />已複製</>  
                                                            : <><Clipboard className="h-3.5 w-3.5" />複製</>}
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    <div className="rounded-[12px] border border-border-subtle bg-bg-base px-3 py-2">
                                                        <p className="text-text-secondary">API</p>
                                                        <p className="mt-1 truncate font-mono text-text-primary">{ngrokInfo.api_url}</p>
                                                    </div>
                                                    <div className="rounded-[12px] border border-border-subtle bg-bg-base px-3 py-2">
                                                        <p className="text-text-secondary">WebSocket</p>
                                                        <p className="mt-1 truncate font-mono text-text-primary">{ngrokInfo.ws_url}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-3 rounded-[14px] border border-border-subtle bg-bg-base px-4 py-3">
                                                <span className="h-2 w-2 rounded-full bg-text-secondary shrink-0" />
                                                <span className="text-sm text-text-secondary">Ngrok 未啟動 — 請執行 </span>
                                                <code className="rounded bg-bg-surface px-2 py-0.5 text-xs font-mono text-text-primary">python start.py</code>
                                            </div>
                                        )}
                                    </div>
                                </Panel>

                                <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                                    <Panel className="overflow-hidden flex flex-col">
                                        <SectionHeader title={t('admin.dashboard.operationalMap')} eyebrow={t('admin.dashboard.systemPulse')} />
                                        <div className="flex-1 p-5">
                                            <div className="grid h-full gap-4 md:grid-cols-2">
                                                <div className="rounded-[16px] border border-border-subtle bg-bg-base p-5 flex flex-col justify-between">
                                                    <div>
                                                        <p className="text-sm font-semibold text-text-secondary">{t('admin.dashboard.operationalEfficiency')}</p>
                                                        <p className="mt-4 text-6xl font-light tracking-tight text-text-primary">78.3<span className="text-2xl text-text-secondary ml-1">%</span></p>
                                                    </div>
                                                    <div className="mt-8 flex justify-center py-4 relative">
                                                        {/* Simple visual indicator */}
                                                        <div className="w-full h-1 bg-border-subtle rounded-full overflow-hidden">
                                                            <div className="h-full bg-accent w-[78.3%]" />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="space-y-4 flex flex-col">
                                                    <div className="rounded-[16px] border border-red-500/20 bg-red-500/10 p-5">
                                                        <div className="flex items-start justify-between">
                                                            <div>
                                                                <p className="text-sm text-red-100/70">{t('admin.dashboard.capacityIssues')}</p>
                                                                <p className="mt-2 text-2xl font-light text-text-primary">2 lines</p>
                                                            </div>
                                                            <CircleAlert className="h-5 w-5 text-red-200" />
                                                        </div>
                                                    </div>
                                                    <div className="rounded-[16px] border border-border-subtle bg-bg-base p-5 flex-1 flex flex-col justify-between">
                                                        <div>
                                                            <p className="text-sm font-semibold text-text-secondary">{t('admin.dashboard.livePassengerVolume')}</p>
                                                            <p className="mt-3 text-4xl font-light tracking-tight text-text-primary">142,580</p>
                                                        </div>
                                                        <div className="mt-5 grid grid-cols-4 gap-2 text-xs font-medium text-text-secondary">
                                                            <span>06:00</span><span>12:00</span><span>18:00</span><span>21:00</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </Panel>

                                    <Panel>
                                        <SectionHeader title={t('admin.dashboard.recentAccess')} eyebrow={t('admin.dashboard.operators')} />
                                        <div className="space-y-3 p-5">
                                            {users.slice(0, 6).map((item) => (
                                                <div key={item.id} className="flex items-center gap-3 rounded-[16px] border border-border-subtle bg-bg-base p-3 transition hover:bg-bg-base/80">
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-sm font-bold text-accent">
                                                        {item.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-sm font-semibold text-text-primary">{item.name}</p>
                                                        <p className="truncate text-xs text-text-secondary">{item.email}</p>
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
                                    title={t('admin.users.title') + ` (${users.length})`}
                                    eyebrow={t('admin.users.activeOperators', { active: activeUsers })}
                                    action={<ActionButton onClick={handleAddUser}><Plus className="h-4 w-4" />{t('admin.users.addUser')}</ActionButton>}
                                />
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[760px]">
                                        <thead className="border-b border-border-subtle text-left text-xs uppercase tracking-wider text-text-secondary">
                                            <tr>
                                                <th className="px-6 py-4">{t('admin.users.table.user')}</th>
                                                <th className="px-6 py-4">{t('admin.users.table.role')}</th>
                                                <th className="px-6 py-4">{t('admin.users.table.status')}</th>
                                                <th className="px-6 py-4">{t('admin.users.table.lastLogin')}</th>
                                                <th className="px-6 py-4 text-right">{t('admin.users.table.action')}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border-subtle">
                                            {isLoading ? (
                                                <tr><td className="px-6 py-10 text-center text-text-secondary" colSpan={5}>{t('common.loading')}</td></tr>
                                            ) : users.length === 0 ? (
                                                <tr><td className="px-6 py-10 text-center text-text-secondary" colSpan={5}>{t('admin.users.noUsers')}</td></tr>
                                            ) : users.map((item) => (
                                                <tr key={item.id} className="transition hover:bg-bg-base">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent">{item.name.charAt(0).toUpperCase()}</div>
                                                            <div>
                                                                <p className="font-semibold text-text-primary">{item.name}</p>
                                                                <p className="text-sm text-text-secondary">{item.email}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4"><RoleBadge role={item.role} /></td>
                                                    <td className="px-6 py-4"><StatusPill active={item.isActive} /></td>
                                                    <td className="px-6 py-4 text-sm text-text-secondary">{formatDate(item.lastLoginAt)}</td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex justify-end gap-2">
                                                            <ActionButton variant="secondary" onClick={() => handleEditUser(item)}><UserRoundCog className="h-4 w-4" />{t('common.edit')}</ActionButton>
                                                            <ActionButton variant="danger" onClick={() => handleDeleteUser(item)}><Trash2 className="h-4 w-4" />{t('common.delete')}</ActionButton>
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
                                        title={t('admin.models.title')}
                                        eyebrow={modelsDir || 'ai_model'}
                                        action={<ActionButton onClick={handleRefreshModels} disabled={isLoadingModels}><RefreshCw className="h-4 w-4" />{t('admin.models.rescan')}</ActionButton>}
                                    />
                                    <div className="grid gap-4 p-5">
                                        {isLoadingModels ? (
                                            <div className="py-10 text-center text-text-secondary">{t('common.loading')}</div>
                                        ) : models.map((model) => (
                                            <div key={model.name} className="flex flex-col gap-4 rounded-[16px] border border-border-subtle bg-bg-base p-5 md:flex-row md:items-center md:justify-between">
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-3">
                                                        <p className="truncate text-lg font-semibold text-text-primary">{model.name}</p>
                                                        {model.is_current && <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">{t('admin.models.current')}</span>}
                                                        {model.quantization && <span className="rounded-full border border-border-subtle bg-bg-surface px-3 py-1 text-xs font-mono text-text-secondary">{model.quantization}</span>}
                                                    </div>
                                                    <div className="mt-3 flex flex-wrap gap-4 text-sm text-text-secondary">
                                                        <span className="inline-flex items-center gap-2"><HardDrive className="h-4 w-4" />{model.size_gb} GB</span>
                                                        <span className="truncate">{model.filename}</span>
                                                    </div>
                                                </div>
                                                {!model.is_current && <ActionButton variant="secondary" onClick={() => handleSelectModel(model.name)}>{t('admin.models.select')}</ActionButton>}
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
                                        <Field label={t('common.search')}>
                                            <div className="flex gap-2">
                                                <input className={inputClass} value={auditSearchInput} onChange={(event) => setAuditSearchInput(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && handleAuditSearch()} placeholder={t('admin.audit.searchPlaceholder')} />
                                                <ActionButton onClick={handleAuditSearch}><Search className="h-4 w-4" />{t('common.search')}</ActionButton>
                                            </div>
                                        </Field>
                                        <Field label={t('admin.audit.action')}>
                                            <select className={inputClass} value={auditFilter.action || ''} onChange={(event) => handleAuditFilterChange('action', event.target.value)}>
                                                <option value="">{t('admin.audit.allActions')}</option>
                                                <option value="login_success">{t('admin.audit.actionTypes.login_success')}</option>
                                                <option value="login_failed">{t('admin.audit.actionTypes.login_failed')}</option>
                                                <option value="user_update">{t('admin.audit.actionTypes.user_update')}</option>
                                                <option value="document_upload">{t('admin.audit.actionTypes.document_upload')}</option>
                                                <option value="document_delete">{t('admin.audit.actionTypes.document_delete')}</option>
                                            </select>
                                        </Field>
                                        <Field label={t('admin.audit.resource')}>
                                            <select className={inputClass} value={auditFilter.resource_type || ''} onChange={(event) => handleAuditFilterChange('resource_type', event.target.value)}>
                                                <option value="">{t('admin.audit.allResources')}</option>
                                                <option value="auth">{t('admin.audit.resourceTypes.auth')}</option>
                                                <option value="user">{t('admin.audit.resourceTypes.user')}</option>
                                                <option value="conversation">{t('admin.audit.resourceTypes.conversation')}</option>
                                                <option value="document">{t('admin.audit.resourceTypes.document')}</option>
                                                <option value="model">{t('admin.audit.resourceTypes.model')}</option>
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
                                        title={t('admin.audit.title')}
                                        eyebrow={`${auditTotal.toLocaleString()} ${t('admin.audit.events')}`}
                                        action={
                                            <div className="flex items-center gap-2">
                                                <ActionButton variant="secondary" disabled={auditPage <= 1} onClick={() => handleAuditPageChange(auditPage - 1)}><ChevronLeft className="h-4 w-4" /></ActionButton>
                                                <span className="text-sm text-text-secondary">{auditPage} / {auditTotalPages || 1}</span>
                                                <ActionButton variant="secondary" disabled={auditPage >= auditTotalPages} onClick={() => handleAuditPageChange(auditPage + 1)}><ChevronRight className="h-4 w-4" /></ActionButton>
                                            </div>
                                        }
                                    />
                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-[900px]">
                                        <thead className="border-b border-border-subtle text-left text-xs uppercase tracking-wider text-text-secondary">
                                                <tr>
                                                    <th className="px-5 py-4">{t('admin.audit.table.time')}</th>
                                                    <th className="px-5 py-4">{t('admin.audit.table.action')}</th>
                                                    <th className="px-5 py-4">{t('admin.audit.table.resource')}</th>
                                                    <th className="px-5 py-4">{t('admin.audit.table.user')}</th>
                                                    <th className="px-5 py-4">{t('admin.audit.table.description')}</th>
                                                    <th className="px-5 py-4">{t('admin.audit.table.ip')}</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border-subtle">
                                                {isLoadingAudit ? (
                                                    <tr><td className="px-5 py-10 text-center text-text-secondary" colSpan={6}>{t('common.loading')}</td></tr>
                                                ) : auditLogs.length === 0 ? (
                                                    <tr><td className="px-5 py-10 text-center text-text-secondary" colSpan={6}>{t('admin.audit.noEvents')}</td></tr>
                                                ) : auditLogs.map((log) => (
                                                    <tr key={log.id} className="transition hover:bg-bg-base">
                                                        <td className="px-5 py-4 text-sm text-text-secondary">{formatDate(log.created_at)}</td>
                                                        <td className="px-5 py-4"><span className="rounded-full border border-border-subtle bg-bg-surface px-3 py-1 text-xs font-semibold text-text-primary">{t(`admin.audit.actionTypes.${log.action}`, { defaultValue: ACTION_LABELS[log.action] || log.action })}</span></td>
                                                        <td className="px-5 py-4 text-sm text-text-primary">{t(`admin.audit.resourceTypes.${log.resource_type}`, { defaultValue: RESOURCE_LABELS[log.resource_type] || log.resource_type })}</td>
                                                        <td className="max-w-[180px] truncate px-5 py-4 text-sm text-text-secondary">{log.user_email || log.user_id || '-'}</td>
                                                        <td className="max-w-[300px] truncate px-5 py-4 text-sm text-text-secondary">{log.description || '-'}</td>
                                                        <td className="px-5 py-4 font-mono text-xs text-text-secondary/70">{log.ip_address || '-'}</td>
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
                                    <SectionHeader title={t('admin.system.systemInfo')} eyebrow={t('admin.system.runtime')} />
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
                                                <div key={label as string} className="rounded-[16px] border border-border-subtle bg-bg-base p-5">
                                                    <IconComp className="mb-5 h-5 w-5 text-accent" />
                                                    <p className="text-xs uppercase tracking-wider text-text-secondary">{label as string}</p>
                                                    <p className="mt-2 text-lg font-semibold text-text-primary">{value as string}</p>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </Panel>
                                <Panel>
                                    <SectionHeader title={t('admin.system.maintenance')} eyebrow={t('admin.system.maintenanceSub')} />
                                    <div className="space-y-3 p-5">
                                        <ActionButton variant="secondary"><RefreshCw className="h-4 w-4" />{t('admin.system.clearCache')}</ActionButton>
                                        <ActionButton variant="secondary"><SlidersHorizontal className="h-4 w-4" />{t('admin.system.reindexVector')}</ActionButton>
                                        <ActionButton variant="danger"><CircleAlert className="h-4 w-4" />{t('admin.system.restartService')}</ActionButton>
                                    </div>
                                </Panel>
                                <Panel className="xl:col-span-2">
                                    <SectionHeader title={t('admin.system.realTimeHealth')} eyebrow={t('admin.system.realTimeHealthSub')} />
                                    <div className="p-5">
                                        <SystemMonitorPanel />
                                    </div>
                                </Panel>
                                <Panel className="xl:col-span-2">
                                    <SectionHeader title="即時健康監控" eyebrow="Real-time Health" />
                                    <div className="p-5">
                                        <SystemMonitorPanel />
                                    </div>
                                </Panel>
                            </div>
                        )}

                        {activeSection === 'tenants' && (
                            <Panel className="overflow-hidden">
                                <SectionHeader
                                    title={t('admin.tenants.title')}
                                    eyebrow={`${activeTenants} active tenants`}
                                    action={<ActionButton onClick={handleAddTenant}><Plus className="h-4 w-4" />{t('admin.tenants.addTenant')}</ActionButton>}
                                />
                                <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
                                    {isLoadingTenants ? (
                                        <div className="col-span-full py-10 text-center text-text-secondary">{t('common.loading')}</div>
                                    ) : tenants.length === 0 ? (
                                        <div className="col-span-full py-10 text-center text-text-secondary">{t('admin.tenants.noTenants')}</div>
                                    ) : tenants.map((item) => (
                                        <div key={item.id} className="rounded-[16px] border border-border-subtle bg-bg-base p-5">
                                            <div className="mb-5 flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="truncate text-lg font-semibold text-text-primary">{item.name}</p>
                                                    <p className="mt-1 inline-flex rounded-full border border-border-subtle bg-bg-surface px-3 py-1 font-mono text-xs text-text-secondary">{item.slug}</p>
                                                </div>
                                                <StatusPill active={item.is_active} />
                                            </div>
                                            <p className="min-h-[44px] text-sm leading-relaxed text-text-secondary">{item.description || t('admin.tenants.noTenants')}</p>
                                            <div className="mt-6 flex justify-end gap-2">
                                                <ActionButton variant="secondary" onClick={() => handleToggleTenantStatus(item)}>{item.is_active ? t('admin.tenants.actions.disable') : t('admin.tenants.actions.enable')}</ActionButton>
                                                <ActionButton onClick={() => handleEditTenant(item)}>{t('admin.tenants.actions.edit')}</ActionButton>
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
                    <h3 className="mb-6 text-xl font-semibold">{currentEditingUser ? t('common.edit') : t('common.save')}</h3>
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
                        <label className="flex items-center justify-between rounded-[16px] border border-border-subtle bg-bg-base px-4 py-3 text-sm text-text-primary">
                            {t('admin.tenants.status.active')}
                            <input type="checkbox" checked={userFormData.is_active} onChange={(event) => setUserFormData((prev) => ({ ...prev, is_active: event.target.checked }))} />
                        </label>
                        <div className="flex gap-3 pt-4">
                            <ActionButton variant="secondary" onClick={() => setIsUserModalOpen(false)}>{t('common.cancel')}</ActionButton>
                            <ActionButton disabled={isSubmittingUser}>{isSubmittingUser ? t('common.loading') : t('common.save')}</ActionButton>
                        </div>
                    </form>
                </ModalFrame>
            )}

            {isTenantModalOpen && (
                <ModalFrame onClose={() => setIsTenantModalOpen(false)}>
                    <h3 className="mb-6 text-xl font-semibold">{currentEditingTenant ? t('admin.tenants.modal.editTitle') : t('admin.tenants.modal.addTitle')}</h3>
                    <form onSubmit={handleTenantSubmit} className="space-y-4">
                        <Field label={t('admin.tenants.modal.name')}><input className={inputClass} required value={tenantFormData.name} onChange={(event) => setTenantFormData((prev) => ({ ...prev, name: event.target.value }))} /></Field>
                        <Field label="Slug"><input className={inputClass} required value={tenantFormData.slug} onChange={(event) => setTenantFormData((prev) => ({ ...prev, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} /></Field>
                        <Field label={t('admin.tenants.modal.description')}><textarea className={inputClass} rows={3} value={tenantFormData.description} onChange={(event) => setTenantFormData((prev) => ({ ...prev, description: event.target.value }))} /></Field>
                        <label className="flex items-center justify-between rounded-[16px] border border-border-subtle bg-bg-base px-4 py-3 text-sm text-text-primary">
                            {t('admin.tenants.status.active')}
                            <input type="checkbox" checked={tenantFormData.is_active} onChange={(event) => setTenantFormData((prev) => ({ ...prev, is_active: event.target.checked }))} />
                        </label>
                        <div className="flex gap-3 pt-4">
                            <ActionButton variant="secondary" onClick={() => setIsTenantModalOpen(false)}>{t('admin.tenants.modal.cancel')}</ActionButton>
                            <ActionButton disabled={isSubmittingTenant}>{isSubmittingTenant ? t('common.loading') : t('admin.tenants.modal.submit')}</ActionButton>
                        </div>
                    </form>
                </ModalFrame>
            )}
        </div>
    )
}
