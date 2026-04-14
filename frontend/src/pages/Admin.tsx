/**
 * 管理後台頁面
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { getModels, refreshModels, selectModel, ModelItem } from '../api/models'
import { apiClient } from '../api/client'
import { getAuditLogs, exportAuditLogsCSV, exportAuditLogsJSON, ACTION_LABELS, RESOURCE_LABELS, AuditLogItem, AuditLogQuery } from '../api/auditLogs'
import { tenantsApi, Tenant } from '../api/tenants'
import { motion, AnimatePresence } from 'framer-motion'

// Types
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

// Icons
const BackIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
)

const UsersIcon = () => (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
)

const ChatIcon = () => (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
)

const DocumentIcon = () => (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
)

const MessageIcon = () => (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
)

type AdminSection = 'overview' | 'users' | 'models' | 'system' | 'audit' | 'tenants'

export default function Admin() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const { user } = useAuthStore()
    const { theme, toggleTheme } = useUIStore()

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

    // 審計日誌 state
    const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([])
    const [auditTotal, setAuditTotal] = useState(0)
    const [auditPage, setAuditPage] = useState(1)
    const [auditTotalPages, setAuditTotalPages] = useState(0)
    const [isLoadingAudit, setIsLoadingAudit] = useState(false)
    const [auditFilter, setAuditFilter] = useState<AuditLogQuery>({
        page: 1,
        page_size: 15,
    })
    const [auditSearchInput, setAuditSearchInput] = useState('')

    // 租戶 state
    const [tenants, setTenants] = useState<Tenant[]>([])
    const [isLoadingTenants, setIsLoadingTenants] = useState(false)
    const [isTenantModalOpen, setIsTenantModalOpen] = useState(false)
    const [currentEditingTenant, setCurrentEditingTenant] = useState<Tenant | null>(null)
    const [tenantFormData, setTenantFormData] = useState({ name: '', slug: '', description: '', is_active: true })
    const [isSubmittingTenant, setIsSubmittingTenant] = useState(false)

    // 檢查權限
    useEffect(() => {
        if (user?.role !== 'admin' && user?.role !== 'engineer') {
            navigate('/')
        }
    }, [user, navigate])

    // 載入統計數據
    const loadStats = useCallback(async () => {
        try {
            const response = await apiClient.get('/admin/stats')
            if (response.data && response.data.status === 'success') {
                setStats(response.data.data)
            }
        } catch (err) {
            console.error('載入統計失敗:', err)
        }
    }, [])

    // 載入租戶列表
    const loadTenants = useCallback(async () => {
        setIsLoadingTenants(true)
        try {
            const data = await tenantsApi.listTenants({ page_size: 100 })
            setTenants(data.data)
        } catch (err) {
            console.error('載入租戶失敗:', err)
        } finally {
            setIsLoadingTenants(false)
        }
    }, [])

    // 租戶操作 Handlers
    const handleAddTenant = () => {
        setCurrentEditingTenant(null)
        setTenantFormData({ name: '', slug: '', description: '', is_active: true })
        setIsTenantModalOpen(true)
    }

    const handleEditTenant = (tenant: Tenant) => {
        setCurrentEditingTenant(tenant)
        setTenantFormData({
            name: tenant.name,
            slug: tenant.slug,
            description: tenant.description || '',
            is_active: tenant.is_active
        })
        setIsTenantModalOpen(true)
    }

    const handleTenantSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmittingTenant(true)
        try {
            if (currentEditingTenant) {
                await tenantsApi.updateTenant(currentEditingTenant.id, tenantFormData)
            } else {
                await tenantsApi.createTenant(tenantFormData)
            }
            setIsTenantModalOpen(false)
            loadTenants()
        } catch (err: any) {
            console.error('儲存租戶失敗:', err)
            // 從後端錯誤訊息抓取詳細原因
            const errorDetail = err.response?.data?.detail || err.message
            alert(`儲存失敗: ${errorDetail}`)
        } finally {
            setIsSubmittingTenant(false)
        }
    }

    const handleToggleTenantStatus = async (tenant: Tenant) => {
        if (!window.confirm(`確定要${tenant.is_active ? '停用' : '啟用'}租戶「${tenant.name}」嗎？\n(停用後該租戶的使用者將無法登入)`)) {
            return
        }
        try {
            if (tenant.is_active) {
                // 停用 (軟刪除)
                await tenantsApi.deleteTenant(tenant.id)
            } else {
                // 重新啟用
                await tenantsApi.updateTenant(tenant.id, { is_active: true })
            }
            loadTenants()
        } catch (err: any) {
            console.error('切換狀態失敗:', err)
            const errorDetail = err.response?.data?.detail || err.message
            alert(`切換狀態失敗: ${errorDetail}`)
        }
    }

    // 載入使用者列表
    const loadUsers = useCallback(async () => {
        setIsLoading(true)
        try {
            // 模擬 API 呼叫
            setUsers([
                {
                    id: '1',
                    name: 'Admin User',
                    email: 'admin@example.com',
                    role: 'admin',
                    isActive: true,
                    createdAt: '2024-01-01T00:00:00Z',
                    lastLoginAt: '2024-01-28T10:00:00Z',
                },
                {
                    id: '2',
                    name: 'Test User',
                    email: 'test@example.com',
                    role: 'user',
                    isActive: true,
                    createdAt: '2024-01-15T00:00:00Z',
                    lastLoginAt: '2024-01-27T15:30:00Z',
                },
            ])
        } catch (err) {
            console.error('載入使用者失敗:', err)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        loadStats()
        loadUsers()
    }, [loadStats, loadUsers])

    // 載入模型列表
    const loadModels = useCallback(async () => {
        setIsLoadingModels(true)
        try {
            const data = await getModels()
            setModels(data.models)
            setModelsDir(data.models_dir)
        } catch (err) {
            console.error('載入模型失敗:', err)
        } finally {
            setIsLoadingModels(false)
        }
    }, [])

    // 切換到模型分頁時載入
    useEffect(() => {
        if (activeSection === 'models') {
            loadModels()
        }
    }, [activeSection, loadModels])

    // 刷新模型
    const handleRefreshModels = async () => {
        setIsLoadingModels(true)
        try {
            const data = await refreshModels()
            setModels(data.models)
        } catch (err) {
            console.error('刷新模型失敗:', err)
        } finally {
            setIsLoadingModels(false)
        }
    }

    // 選擇模型
    const handleSelectModel = async (name: string) => {
        try {
            await selectModel(name)
            // 重新載入模型列表
            loadModels()
        } catch (err) {
            console.error('選擇模型失敗:', err)
        }
    }

    // 載入審計日誌
    const loadAuditLogs = useCallback(async (query: AuditLogQuery = auditFilter) => {
        setIsLoadingAudit(true)
        try {
            const data = await getAuditLogs(query)
            setAuditLogs(data.data)
            setAuditTotal(data.total)
            setAuditPage(data.page)
            setAuditTotalPages(data.total_pages)
        } catch (err) {
            console.error('載入審計日誌失敗:', err)
        } finally {
            setIsLoadingAudit(false)
        }
    }, [auditFilter])

    // 切換到審計日誌分頁時載入
    useEffect(() => {
        if (activeSection === 'audit') {
            loadAuditLogs()
        }
    }, [activeSection, loadAuditLogs])

    // 切換到租戶分頁時載入
    useEffect(() => {
        if (activeSection === 'tenants') {
            loadTenants()
        }
    }, [activeSection, loadTenants])

    // 審計日誌篩選
    const handleAuditSearch = () => {
        const newFilter = { ...auditFilter, search: auditSearchInput || undefined, page: 1 }
        setAuditFilter(newFilter)
        loadAuditLogs(newFilter)
    }

    const handleAuditFilterChange = (key: keyof AuditLogQuery, value: string) => {
        const newFilter = { ...auditFilter, [key]: value || undefined, page: 1 }
        setAuditFilter(newFilter)
        loadAuditLogs(newFilter)
    }

    const handleAuditPageChange = (newPage: number) => {
        const newFilter = { ...auditFilter, page: newPage }
        setAuditFilter(newFilter)
        loadAuditLogs(newFilter)
    }

    // 匯出功能
    const handleExportCSV = async () => {
        try {
            const blob = await exportAuditLogsCSV({
                action: auditFilter.action,
                resource_type: auditFilter.resource_type,
                start_date: auditFilter.start_date,
                end_date: auditFilter.end_date,
            })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`
            a.click()
            URL.revokeObjectURL(url)
        } catch (err) {
            console.error('匯出 CSV 失敗:', err)
        }
    }

    const handleExportJSON = async () => {
        try {
            const blob = await exportAuditLogsJSON({
                action: auditFilter.action,
                resource_type: auditFilter.resource_type,
                start_date: auditFilter.start_date,
                end_date: auditFilter.end_date,
            })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.json`
            a.click()
            URL.revokeObjectURL(url)
        } catch (err) {
            console.error('匯出 JSON 失敗:', err)
        }
    }

    const StatCard = ({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) => (
        <div className="bg-white dark:bg-ios-dark-gray5 rounded-[20px] border border-gray-200 dark:border-white/5 p-8 shadow-sm dark:shadow-none transition-colors">
            <div className="flex items-center gap-5">
                <div className={`w-14 h-14 rounded-[16px] ${color} flex items-center justify-center text-white shadow-sm`}>
                    {icon}
                </div>
                <div>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1 tracking-tight">{value.toLocaleString()}</p>
                    <p className="text-[15px] font-medium text-gray-500 dark:text-gray-400">{label}</p>
                </div>
            </div>
        </div>
    )

    const RoleBadge = ({ role }: { role: UserData['role'] }) => {
        const styles = {
            admin: 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20',
            engineer: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20',
            user: 'bg-gray-50 dark:bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-500/20',
        }
        return (
            <span className={`px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase rounded-full ${styles[role]}`}>
                {role}
            </span>
        )
    }

    return (
        <div className="min-h-screen bg-white dark:bg-ios-dark-gray6 transition-colors duration-300">
            {/* 頂部導覽列 */}
            <header className="h-[80px] border-b border-gray-200 dark:border-white/5 flex items-center justify-between px-8 bg-white dark:bg-ios-dark-gray6 transition-colors">
                <div className="flex items-center">
                    <button
                        onClick={() => navigate('/')}
                        className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-ios-dark-gray4 rounded-full mr-4 transition-colors"
                    >
                        <BackIcon />
                    </button>
                    <h1 className="text-xl font-semibold text-gray-900 dark:text-white tracking-wide flex items-center gap-2">
                        <svg className="w-6 h-6 text-ios-blue-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                        </svg>
                        {t('nav.admin')}
                    </h1>
                </div>
                <button
                    onClick={toggleTheme}
                    className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-ios-dark-gray4 rounded-full transition-colors"
                >
                    {theme === 'dark' ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v2m0 14v2m9-9h-2M5 12H3m14.071-7.071l-1.414 1.414M6.343 17.657l-1.414 1.414m12.728 0l-1.414-1.414M6.343 6.343L4.929 4.929M12 17a5 5 0 100-10 5 5 0 000 10z" />
                        </svg>
                    ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                        </svg>
                    )}
                </button>
            </header>

            <div className="max-w-6xl mx-auto p-8 pt-10">
                {/* 分頁標籤 */}
                <div className="flex gap-3 mb-8 flex-wrap">
                    {(['overview', 'users', 'models', 'audit', 'system', 'tenants'] as AdminSection[]).map((section) => (
                        <button
                            key={section}
                            onClick={() => setActiveSection(section)}
                            className={`px-5 py-2.5 rounded-full font-medium transition-colors border ${activeSection === section
                                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white shadow-sm'
                                : 'bg-white dark:bg-ios-dark-gray5 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-ios-dark-gray4/50 border-gray-200 dark:border-white/5'
                                }`}
                        >
                            {section === 'overview' && '總覽'}
                            {section === 'users' && '使用者'}
                            {section === 'models' && '模型'}
                            {section === 'audit' && (
                                <span className="flex items-center gap-1.5">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" /></svg>
                                    審計日誌
                                </span>
                            )}
                            {section === 'system' && '系統'}
                            {section === 'tenants' && (
                                <span className="flex items-center gap-1.5">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /></svg>
                                    租戶管理
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* 總覽 */}
                {activeSection === 'overview' && (
                    <div className="space-y-6">
                        {/* 統計卡片 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <StatCard
                                icon={<UsersIcon />}
                                label="總使用者"
                                value={stats.totalUsers}
                                color="bg-ios-blue-light"
                            />
                            <StatCard
                                icon={<ChatIcon />}
                                label="總對話"
                                value={stats.totalConversations}
                                color="bg-emerald-500"
                            />
                            <StatCard
                                icon={<DocumentIcon />}
                                label="總文件"
                                value={stats.totalDocuments}
                                color="bg-amber-500"
                            />
                            <StatCard
                                icon={<MessageIcon />}
                                label="總訊息"
                                value={stats.totalMessages}
                                color="bg-purple-500"
                            />
                        </div>

                        {/* 最近活動 */}
                        <div className="bg-white dark:bg-ios-dark-gray5 rounded-[20px] border border-gray-200 dark:border-white/5 p-8 shadow-sm dark:shadow-none transition-colors mt-8">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                                最近活動
                            </h2>
                            <div className="text-gray-500 dark:text-gray-400 text-center py-10 font-medium bg-gray-50 dark:bg-ios-dark-gray6/50 rounded-[20px] border border-dashed border-gray-200 dark:border-white/20">
                                暫無活動記錄
                            </div>
                        </div>
                    </div>
                )}

                {/* 使用者管理 */}
                {activeSection === 'users' && (
                    <div className="bg-white dark:bg-ios-dark-gray5 rounded-[20px] border border-gray-200 dark:border-white/5 overflow-hidden shadow-sm dark:shadow-none transition-colors">
                        <div className="px-8 py-5 border-b border-gray-200 dark:border-white/5 flex items-center justify-between">
                            <h2 className="font-semibold text-gray-900 dark:text-white">
                                使用者列表 ({users.length})
                            </h2>
                            <button className="px-4 py-2 bg-ios-blue-light hover:bg-ios-blue-light/90 text-white text-[15px] font-medium rounded-full transition-colors shadow-sm shadow-ios-blue-light/20">
                                + 新增使用者
                            </button>
                        </div>

                        {isLoading ? (
                            <div className="p-10 text-center text-gray-500 dark:text-gray-400">載入中...</div>
                        ) : (
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-ios-dark-gray6">
                                    <tr>
                                        <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            使用者
                                        </th>
                                        <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            角色
                                        </th>
                                        <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            狀態
                                        </th>
                                        <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            最後登入
                                        </th>
                                        <th className="px-8 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            操作
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                    {users.map((u) => (
                                        <tr key={u.id} className="hover:bg-gray-50/50 dark:hover:bg-ios-dark-gray4 transition-colors">
                                            <td className="px-8 py-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-full bg-ios-blue-light/10 dark:bg-ios-blue-dark/20 flex items-center justify-center text-ios-blue-light dark:text-ios-blue-dark font-semibold text-sm">
                                                        {u.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-900 dark:text-white mb-0.5">{u.name}</p>
                                                        <p className="text-[13px] text-gray-500 dark:text-gray-400">{u.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-4">
                                                <RoleBadge role={u.role} />
                                            </td>
                                            <td className="px-8 py-4">
                                                <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${u.isActive ? 'text-green-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'
                                                    }`}>
                                                    <span className={`w-2 h-2 rounded-full ${u.isActive ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-500'}`} />
                                                    {u.isActive ? '啟用' : '停用'}
                                                </span>
                                            </td>
                                            <td className="px-8 py-4 text-[13px] text-gray-500 dark:text-gray-400">
                                                {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('zh-TW') : '-'}
                                            </td>
                                            <td className="px-8 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button className="text-ios-blue-light hover:text-ios-blue-light/90 dark:text-ios-blue-dark dark:hover:text-ios-blue-dark/90 text-sm font-medium px-3 py-1.5 rounded-full hover:bg-ios-blue-light/5 dark:hover:bg-ios-blue-dark/10 transition-colors">
                                                        編輯
                                                    </button>
                                                    <button
                                                        onClick={async () => {
                                                            if (!confirm(`確定要刪除使用者「${u.name}」嗎？\n此操作無法復原，並會撤銷該使用者所有已發放的 Token。`)) return
                                                            try {
                                                                await apiClient.post(`/users/${u.id}/force-logout`)
                                                                alert(`已成功刪除 ${u.name}`)
                                                            } catch {
                                                                alert('刪除失敗，請稍後重試')
                                                            }
                                                        }}
                                                        className="flex items-center gap-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm font-medium px-3 py-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                                        title="刪除此使用者"
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                                        </svg>
                                                        刪除
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {/* 模型管理 */}
                {activeSection === 'models' && (
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-ios-dark-gray5 rounded-[20px] border border-gray-200 dark:border-white/5 p-8 shadow-sm dark:shadow-none transition-colors">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                                        🤖 LLM 模型
                                    </h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                        目錄: <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-ios-dark-gray6 font-mono text-[13px]">{modelsDir}</code>
                                    </p>
                                </div>
                                <button
                                    onClick={handleRefreshModels}
                                    disabled={isLoadingModels}
                                    className="px-4 py-2 bg-ios-blue-light hover:bg-ios-blue-light/90 disabled:opacity-50 disabled:hover:bg-ios-blue-light text-white text-[15px] font-medium rounded-full transition-colors shadow-sm shadow-ios-blue-light/20"
                                >
                                    {isLoadingModels ? '掃描中...' : '🔄 重新掃描'}
                                </button>
                            </div>

                            {isLoadingModels ? (
                                <div className="text-center py-10 text-gray-500 dark:text-gray-400">載入中...</div>
                            ) : models.length === 0 ? (
                                <div className="text-center py-10 bg-gray-50 dark:bg-ios-dark-gray6/50 rounded-[20px] border border-dashed border-gray-200 dark:border-white/20">
                                    <p className="text-gray-600 dark:text-gray-300 font-medium">
                                        未找到 GGUF 模型檔案
                                    </p>
                                    <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-2">
                                        請將 .gguf 模型放入 ai_model 目錄
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {models.map((model) => (
                                        <div
                                            key={model.name}
                                            className={`p-5 rounded-[20px] border transition-colors ${model.is_current
                                                ? 'border-ios-blue-light bg-ios-blue-light/5 dark:bg-ios-blue-dark/10 shadow-sm'
                                                : 'border-gray-200 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-ios-dark-gray4/30 hover:border-gray-300 dark:hover:border-white/20'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3">
                                                        <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white">
                                                            {model.name}
                                                        </h3>
                                                        {model.is_current && (
                                                            <span className="px-2.5 py-0.5 text-[11px] font-bold tracking-wide uppercase bg-ios-blue-light text-white rounded-full">
                                                                使用中
                                                            </span>
                                                        )}
                                                        {model.quantization && (
                                                            <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-ios-dark-gray6 border border-gray-200 dark:border-white/5 text-gray-600 dark:text-gray-400 rounded-full font-mono">
                                                                {model.quantization}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-4 mt-2 text-[13px] text-gray-500 dark:text-gray-400">
                                                        <span className="flex items-center gap-1.5"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>{model.size_gb} GB</span>
                                                        <span className="flex items-center gap-1.5"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>{model.filename}</span>
                                                    </div>
                                                </div>
                                                {!model.is_current && (
                                                    <button
                                                        onClick={() => handleSelectModel(model.name)}
                                                        className="px-5 py-2 bg-gray-100 dark:bg-ios-dark-gray6 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-full border border-gray-200 dark:border-white/5 hover:bg-gray-200 dark:hover:bg-ios-dark-gray4 transition-colors"
                                                    >
                                                        選擇
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="bg-white dark:bg-ios-dark-gray5 rounded-[20px] border border-gray-200 dark:border-white/5 p-8 shadow-sm dark:shadow-none transition-colors">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                如何添加新模型
                            </h2>
                            <ol className="list-decimal list-inside space-y-3 text-[15px] text-gray-600 dark:text-gray-400">
                                <li>從 Hugging Face 下載 GGUF 格式的模型</li>
                                <li>將檔案放入 <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-ios-dark-gray6 rounded font-mono text-[13px]">ai_model/</code> 目錄</li>
                                <li>點擊「重新掃描」按鈕</li>
                                <li>選擇要使用的模型</li>
                            </ol>
                        </div>
                    </div>
                )}

                {/* 審計日誌 */}
                {activeSection === 'audit' && (
                    <div className="space-y-6">
                        {/* 篩選列 */}
                        <div className="bg-white dark:bg-ios-dark-gray5 rounded-[20px] border border-gray-200 dark:border-white/5 p-6 shadow-sm dark:shadow-none transition-colors">
                            <div className="flex flex-wrap gap-3 items-end">
                                {/* 搜尋框 */}
                                <div className="flex-1 min-w-[200px]">
                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">搜尋</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={auditSearchInput}
                                            onChange={(e) => setAuditSearchInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleAuditSearch()}
                                            placeholder="搜尋描述或 Email..."
                                            className="flex-1 px-4 py-2 rounded-full border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-ios-dark-gray6 text-[14px] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-ios-blue-light dark:focus:border-ios-blue-dark transition-colors"
                                        />
                                        <button
                                            onClick={handleAuditSearch}
                                            className="px-4 py-2 bg-ios-blue-light hover:bg-ios-blue-light/90 text-white text-[14px] font-medium rounded-full transition-colors shadow-sm"
                                        >
                                            搜尋
                                        </button>
                                    </div>
                                </div>

                                {/* 操作類型 */}
                                <div className="min-w-[140px]">
                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">操作類型</label>
                                    <select
                                        value={auditFilter.action || ''}
                                        onChange={(e) => handleAuditFilterChange('action', e.target.value)}
                                        className="w-full px-3 py-2 rounded-full border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-ios-dark-gray6 text-[14px] text-gray-900 dark:text-white focus:outline-none focus:border-ios-blue-light dark:focus:border-ios-blue-dark transition-colors appearance-none"
                                    >
                                        <option value="">全部</option>
                                        <option value="login_success">登入成功</option>
                                        <option value="login_failed">登入失敗</option>
                                        <option value="logout">登出</option>
                                        <option value="register">註冊</option>
                                        <option value="user_update">更新使用者</option>
                                        <option value="user_delete">停用使用者</option>
                                        <option value="conversation_create">建立對話</option>
                                        <option value="conversation_delete">刪除對話</option>
                                        <option value="document_upload">上傳文件</option>
                                        <option value="document_delete">刪除文件</option>
                                    </select>
                                </div>

                                {/* 資源類型 */}
                                <div className="min-w-[120px]">
                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">資源類型</label>
                                    <select
                                        value={auditFilter.resource_type || ''}
                                        onChange={(e) => handleAuditFilterChange('resource_type', e.target.value)}
                                        className="w-full px-3 py-2 rounded-full border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-ios-dark-gray6 text-[14px] text-gray-900 dark:text-white focus:outline-none focus:border-ios-blue-light dark:focus:border-ios-blue-dark transition-colors appearance-none"
                                    >
                                        <option value="">全部</option>
                                        <option value="auth">認證</option>
                                        <option value="user">使用者</option>
                                        <option value="conversation">對話</option>
                                        <option value="document">文件</option>
                                        <option value="model">模型</option>
                                    </select>
                                </div>

                                {/* 匯出按鈕 */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleExportCSV}
                                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-[13px] font-medium rounded-full transition-colors shadow-sm"
                                    >
                                        📥 CSV
                                    </button>
                                    <button
                                        onClick={handleExportJSON}
                                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-[13px] font-medium rounded-full transition-colors shadow-sm"
                                    >
                                        📥 JSON
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* 日誌列表 */}
                        <div className="bg-white dark:bg-ios-dark-gray5 rounded-[20px] border border-gray-200 dark:border-white/5 overflow-hidden shadow-sm dark:shadow-none transition-colors">
                            <div className="px-8 py-4 border-b border-gray-200 dark:border-white/5 flex items-center justify-between">
                                <h2 className="font-semibold text-gray-900 dark:text-white">
                                    審計日誌 ({auditTotal.toLocaleString()} 筆)
                                </h2>
                                <span className="text-[13px] text-gray-500 dark:text-gray-400">
                                    第 {auditPage} / {auditTotalPages || 1} 頁
                                </span>
                            </div>

                            {isLoadingAudit ? (
                                <div className="p-10 text-center text-gray-500 dark:text-gray-400">載入中...</div>
                            ) : auditLogs.length === 0 ? (
                                <div className="p-10 text-center text-gray-500 dark:text-gray-400">
                                    <p className="font-medium">暫無審計日誌</p>
                                    <p className="text-[13px] mt-1">系統操作將自動記錄在此</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[800px]">
                                        <thead className="bg-gray-50 dark:bg-ios-dark-gray6">
                                            <tr>
                                                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                    時間
                                                </th>
                                                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                    操作
                                                </th>
                                                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                    資源
                                                </th>
                                                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                    操作者
                                                </th>
                                                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                    描述
                                                </th>
                                                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                    IP
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                            {auditLogs.map((log) => {
                                                const isFailure = log.action.includes('failed')
                                                const isAuth = log.resource_type === 'auth'
                                                const isDelete = log.action.includes('delete')

                                                return (
                                                    <tr key={log.id} className="hover:bg-gray-50/50 dark:hover:bg-ios-dark-gray4 transition-colors">
                                                        <td className="px-5 py-3 text-[13px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                                            {new Date(log.created_at).toLocaleString('zh-TW', {
                                                                month: '2-digit',
                                                                day: '2-digit',
                                                                hour: '2-digit',
                                                                minute: '2-digit',
                                                                second: '2-digit',
                                                            })}
                                                        </td>
                                                        <td className="px-5 py-3">
                                                            <span className={`inline-flex px-2.5 py-0.5 text-[11px] font-bold tracking-wide rounded-full ${
                                                                isFailure
                                                                    ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20'
                                                                    : isDelete
                                                                        ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20'
                                                                        : isAuth
                                                                            ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20'
                                                                            : 'bg-gray-50 dark:bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-500/20'
                                                            }`}>
                                                                {ACTION_LABELS[log.action] || log.action}
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-3">
                                                            <span className="text-[13px] text-gray-600 dark:text-gray-300">
                                                                {RESOURCE_LABELS[log.resource_type] || log.resource_type}
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-3 text-[13px] text-gray-600 dark:text-gray-300 max-w-[180px] truncate">
                                                            {log.user_email || log.user_id || '-'}
                                                        </td>
                                                        <td className="px-5 py-3 text-[13px] text-gray-600 dark:text-gray-300 max-w-[250px] truncate">
                                                            {log.description || '-'}
                                                        </td>
                                                        <td className="px-5 py-3 text-[12px] font-mono text-gray-400 dark:text-gray-500">
                                                            {log.ip_address || '-'}
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* 分頁控制 */}
                            {auditTotalPages > 1 && (
                                <div className="px-8 py-4 border-t border-gray-200 dark:border-white/5 flex items-center justify-between">
                                    <button
                                        onClick={() => handleAuditPageChange(auditPage - 1)}
                                        disabled={auditPage <= 1}
                                        className="px-4 py-2 text-[14px] font-medium rounded-full border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-ios-dark-gray4 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    >
                                        ← 上一頁
                                    </button>
                                    <div className="flex gap-1">
                                        {Array.from({ length: Math.min(auditTotalPages, 5) }, (_, i) => {
                                            let pageNum: number
                                            if (auditTotalPages <= 5) {
                                                pageNum = i + 1
                                            } else if (auditPage <= 3) {
                                                pageNum = i + 1
                                            } else if (auditPage >= auditTotalPages - 2) {
                                                pageNum = auditTotalPages - 4 + i
                                            } else {
                                                pageNum = auditPage - 2 + i
                                            }
                                            return (
                                                <button
                                                    key={pageNum}
                                                    onClick={() => handleAuditPageChange(pageNum)}
                                                    className={`w-9 h-9 rounded-full text-[14px] font-medium transition-colors ${
                                                        pageNum === auditPage
                                                            ? 'bg-ios-blue-light text-white'
                                                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-ios-dark-gray4'
                                                    }`}
                                                >
                                                    {pageNum}
                                                </button>
                                            )
                                        })}
                                    </div>
                                    <button
                                        onClick={() => handleAuditPageChange(auditPage + 1)}
                                        disabled={auditPage >= auditTotalPages}
                                        className="px-4 py-2 text-[14px] font-medium rounded-full border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-ios-dark-gray4 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    >
                                        下一頁 →
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 系統資訊 */}
                {activeSection === 'system' && (
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-ios-dark-gray5 rounded-[20px] border border-gray-200 dark:border-white/5 p-8 shadow-sm dark:shadow-none transition-colors">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                                系統資訊
                            </h2>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-8 text-[15px]">
                                <div>
                                    <p className="text-gray-500 dark:text-gray-400 mb-1">版本</p>
                                    <p className="text-gray-900 dark:text-gray-100 font-medium">2.2.0</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 dark:text-gray-400 mb-1">後端</p>
                                    <p className="text-gray-900 dark:text-gray-100 font-medium">FastAPI</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 dark:text-gray-400 mb-1">LLM Engine</p>
                                    <p className="text-gray-900 dark:text-gray-100 font-medium">llama.cpp</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 dark:text-gray-400 mb-1">向量資料庫</p>
                                    <p className="text-gray-900 dark:text-gray-100 font-medium">ChromaDB</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 dark:text-gray-400 mb-1">資料庫</p>
                                    <p className="text-gray-900 dark:text-gray-100 font-medium">SQLite</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 dark:text-gray-400 mb-1">Python</p>
                                    <p className="text-gray-900 dark:text-gray-100 font-medium tracking-wide">3.10+</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-ios-dark-gray5 rounded-[20px] border border-gray-200 dark:border-white/5 p-8 shadow-sm dark:shadow-none transition-colors">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                                維護操作
                            </h2>
                            <div className="flex gap-4">
                                <button className="px-5 py-2.5 bg-gray-100 dark:bg-ios-dark-gray6 text-gray-700 dark:text-gray-300 font-medium rounded-full border border-gray-200 dark:border-white/5 hover:bg-gray-200 dark:hover:bg-ios-dark-gray4 transition-colors">
                                    清除快取
                                </button>
                                <button className="px-5 py-2.5 bg-gray-100 dark:bg-ios-dark-gray6 text-gray-700 dark:text-gray-300 font-medium rounded-full border border-gray-200 dark:border-white/5 hover:bg-gray-200 dark:hover:bg-ios-dark-gray4 transition-colors">
                                    重建索引
                                </button>
                                <button className="px-5 py-2.5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 font-medium rounded-full hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors ml-auto">
                                    重啟服務
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 租戶管理 */}
                {activeSection === 'tenants' && (
                    <div className="bg-white dark:bg-ios-dark-gray5 rounded-[20px] border border-gray-200 dark:border-white/5 overflow-hidden shadow-sm dark:shadow-none transition-colors">
                        <div className="px-8 py-5 border-b border-gray-200 dark:border-white/5 flex items-center justify-between">
                            <h2 className="font-semibold text-gray-900 dark:text-white">
                                租戶列表 ({tenants.length})
                            </h2>
                            <button 
                                onClick={handleAddTenant}
                                className="px-4 py-2 bg-ios-blue-light hover:bg-ios-blue-light/90 text-white text-[15px] font-medium rounded-full transition-colors shadow-sm shadow-ios-blue-light/20">
                                + 新增租戶
                            </button>
                        </div>

                        {isLoadingTenants ? (
                            <div className="p-10 text-center text-gray-500 dark:text-gray-400">載入中...</div>
                        ) : tenants.length === 0 ? (
                            <div className="text-center py-10 bg-gray-50 dark:bg-ios-dark-gray6/50 rounded-[20px] border border-dashed border-gray-200 dark:border-white/20 m-6">
                                <p className="text-gray-600 dark:text-gray-300 font-medium">暫無租戶</p>
                            </div>
                        ) : (
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-ios-dark-gray6">
                                    <tr>
                                        <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">名稱 / Slug</th>
                                        <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">狀態</th>
                                        <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">描述</th>
                                        <th className="px-8 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">操作</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                    {tenants.map(t => (
                                        <tr key={t.id} className="hover:bg-gray-50/50 dark:hover:bg-ios-dark-gray4 transition-colors">
                                            <td className="px-8 py-4">
                                                <p className="font-medium text-gray-900 dark:text-white mb-0.5">{t.name}</p>
                                                <p className="text-[13px] text-gray-500 font-mono bg-black/5 dark:bg-white/5 inline-block px-1.5 py-0.5 rounded">{t.slug}</p>
                                            </td>
                                            <td className="px-8 py-4">
                                                <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${t.is_active ? 'text-green-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                                    <span className={`w-2 h-2 rounded-full ${t.is_active ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-500'}`} />
                                                    {t.is_active ? '啟用' : '停用'}
                                                </span>
                                            </td>
                                            <td className="px-8 py-4 text-[13px] text-gray-500 dark:text-gray-400 max-w-[200px] truncate">
                                                {t.description || '-'}
                                            </td>
                                            <td className="px-8 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button 
                                                        onClick={() => handleToggleTenantStatus(t)}
                                                        className={`text-sm font-medium px-3 py-1.5 rounded-full transition-colors ${
                                                            t.is_active 
                                                                ? 'text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-500/10'
                                                                : 'text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-500/10'
                                                        }`}
                                                    >
                                                        {t.is_active ? '停用' : '啟用'}
                                                    </button>
                                                    <button 
                                                        onClick={() => handleEditTenant(t)}
                                                        className="text-ios-blue-light hover:text-ios-blue-light/90 dark:text-ios-blue-dark dark:hover:text-ios-blue-dark/90 text-sm font-medium px-3 py-1.5 rounded-full hover:bg-ios-blue-light/5 dark:hover:bg-ios-blue-dark/10 transition-colors">
                                                        編輯
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

        {/* 租戶表單 Modal */}
        <AnimatePresence>
            {isTenantModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm"
                        onClick={() => setIsTenantModalOpen(false)}
                    />
                    <motion.div 
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        className="relative bg-white dark:bg-ios-dark-gray5 rounded-[24px] shadow-2xl p-6 w-full max-w-md border border-gray-100 dark:border-white/5"
                    >
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                            {currentEditingTenant ? '編輯租戶' : '新增租戶'}
                        </h3>
                        
                        <form onSubmit={handleTenantSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">租戶名稱 <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    required
                                    value={tenantFormData.name}
                                    onChange={e => setTenantFormData(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="例如：Acme Corp"
                                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-ios-dark-gray6 border border-gray-200 dark:border-white/10 rounded-[14px] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-ios-blue-light/50 transition-shadow"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">存取識別碼 (Slug) <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    required
                                    value={tenantFormData.slug}
                                    onChange={e => setTenantFormData(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                                    placeholder="例如：acme-corp"
                                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-ios-dark-gray6 border border-gray-200 dark:border-white/10 rounded-[14px] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-ios-blue-light/50 transition-shadow font-mono text-sm"
                                />
                                <p className="mt-1 text-[12px] text-gray-500">僅限小寫英數字與連字號，將作為登入網址區隔使用。</p>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">描述 (選填)</label>
                                <textarea
                                    value={tenantFormData.description}
                                    onChange={e => setTenantFormData(prev => ({ ...prev, description: e.target.value }))}
                                    rows={3}
                                    placeholder="簡短描述這個租戶的用途..."
                                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-ios-dark-gray6 border border-gray-200 dark:border-white/10 rounded-[14px] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-ios-blue-light/50 transition-shadow resize-none"
                                />
                            </div>

                            <div className="flex items-center justify-between pt-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">是否啟用</label>
                                <button
                                    type="button"
                                    onClick={() => setTenantFormData(prev => ({ ...prev, is_active: !prev.is_active }))}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                        tenantFormData.is_active ? 'bg-ios-blue-light' : 'bg-gray-200 dark:bg-white/20'
                                    }`}
                                >
                                    <span
                                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                                            tenantFormData.is_active ? 'translate-x-5' : 'translate-x-1'
                                        }`}
                                    />
                                </button>
                            </div>

                            <div className="flex gap-3 pt-6 mt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsTenantModalOpen(false)}
                                    className="flex-1 px-4 py-2.5 text-gray-600 dark:text-gray-300 font-medium bg-gray-100/80 hover:bg-gray-200 dark:bg-ios-dark-gray6 dark:hover:bg-ios-dark-gray4 rounded-full transition-colors"
                                >
                                    取消
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmittingTenant || !tenantFormData.name || !tenantFormData.slug}
                                    className="flex-1 px-4 py-2.5 text-white font-medium bg-ios-blue-light hover:bg-ios-blue-light/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-full transition-colors shadow-sm shadow-ios-blue-light/20 flex items-center justify-center"
                                >
                                    {isSubmittingTenant ? (
                                        <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    ) : (
                                        currentEditingTenant ? '儲存變更' : '建立租戶'
                                    )}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
            </div>
        </div>
    )
}
