import GlassSegmented from '@/components/ui/GlassSegmented'
import GlassNav from '@/components/ui/GlassNav'
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    ActionButton,
    ModalFrame,
    Field,
    inputClass,
} from '@/features/admin/components/AdminPrimitives'
import LanSidebarWidget from '@/features/admin/components/LanSidebarWidget'
import OverviewSection from '@/features/admin/sections/OverviewSection'

const AuditSection = lazy(() => import('@/features/admin/sections/AuditSection'))
const UsersSection = lazy(() => import('@/features/admin/sections/UsersSection'))
const ModelsSection = lazy(() => import('@/features/admin/sections/ModelsSection'))
const TenantsSection = lazy(() => import('@/features/admin/sections/TenantsSection'))
// Only icons still used at AdminPage level: tab icons + sidebar logo + back arrow.
// Section-specific icons live inside each section module.
import {
    ArrowLeft,
    Building2,
    Cpu,
    FileText,
    Gauge,
    Users,
} from '@/components/snow/icons'

import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { useToastStore } from '@/store/toastStore'
import { getModels, refreshModels, selectModel, type ModelItem } from '@/api/models'
import {
    exportAuditLogsCSV,
    exportAuditLogsJSON,
    getAuditLogs,
    type AuditLogItem,
    type AuditLogQuery,
} from '@/api/auditLogs'
import { tenantsApi, type Tenant } from '@/api/tenants'
import { usersApi, type CreateUserPayload, type UpdateUserPayload } from '@/api/users'
import { adminApi } from '@/api/admin'
import { systemApi } from '@/api/system'
import { documentsApi } from '@/api/documents'
import StyledSelect from '@/components/ui/StyledSelect'
import { useTranslation } from 'react-i18next'
import WaveBackground from '@/components/ui/WaveBackground'
import { SkelCards } from '@/components/ui/Skeleton'

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

type AdminSection = 'overview' | 'users' | 'models' | 'audit' | 'tenants'

const TABS_CONFIG: Array<{ id: AdminSection; i18nKey: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'overview', i18nKey: 'admin.tabs.overview', icon: Gauge },
    { id: 'users', i18nKey: 'admin.tabs.users', icon: Users },
    { id: 'models', i18nKey: 'admin.tabs.models', icon: Cpu },
    { id: 'audit', i18nKey: 'admin.tabs.audit', icon: FileText },
    { id: 'tenants', i18nKey: 'admin.tabs.tenants', icon: Building2 },
]

function getErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message
    const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
    return detail || '操作失敗'
}

// formatDate moved to AdminPrimitives (used by Overview / Audit sections)

// Admin shared UI primitives (Panel, SectionHeader, ActionButton, StatusPill,
// RoleBadge, ModalFrame, Field, inputClass) extracted to
// ./components/AdminPrimitives — see the imports at the top of this file.

export default function Admin() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const { user } = useAuthStore()
    const demoMode = useUIStore((s) => s.demoMode)
    const showConfirm = useUIStore((s) => s.showConfirm)
    /** 把絕對路徑壓縮成最後 1～2 段（demo 模式時用），避免裸露使用者目錄 */
    const sanitizePath = (p: string) => {
        if (!p) return ''
        if (!demoMode) return p
        const parts = p.split(/[\\/]/).filter(Boolean)
        return parts.slice(-2).join('/') || p
    }

    /** 點擊稽核 row 後顯示的 detail drawer（null 代表關閉） */
    const [auditDrawer, setAuditDrawer] = useState<AuditLogItem | null>(null)

    /**
     * 依 action 名稱回傳 pill 顏色：
     * - 危險（刪除 / 停用 / 失敗）→ 紅
     * - 成功（登入成功 / Token 刷新 / 啟用）→ 綠
     * - 變更（建立 / 更新）→ 藍
     * - 其他 → 中性灰
     */
    // getActionPillClass moved into AuditSection (only used there).

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

    // LAN（區域網路）開關狀態：切換後需重啟 start.py 才會生效
    const [lanEnabled, setLanEnabled] = useState(false)
    const [lanIps, setLanIps] = useState<string[]>([])
    const [isLoadingLan, setIsLoadingLan] = useState(false)

    const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([])
    const [auditTotal, setAuditTotal] = useState(0)
    const [auditPage, setAuditPage] = useState(1)
    const [auditTotalPages, setAuditTotalPages] = useState(0)
    const [isLoadingAudit, setIsLoadingAudit] = useState(false)
    const [auditFilter, setAuditFilter] = useState<AuditLogQuery>({ page: 1, page_size: 15 })
    const [auditSearchInput, setAuditSearchInput] = useState('')

    // Overview dashboard 專用 — 一次抓近 7 天的 logs 給趨勢圖 & 事件分布圖。
    // 跟 auditLogs（分頁用）分開，避免互相污染：
    //   - auditLogs: page_size=15，使用者切換 audit 分頁會變動
    //   - auditSummary: page_size=200 + start_date=7days_ago，僅 mount 時抓一次
    const [auditSummary, setAuditSummary] = useState<AuditLogItem[]>([])

    // Overview dashboard 用的 documents 列表（給 DocumentTypeDonut / DocumentStatusBar）
    const [documents, setDocuments] = useState<Array<{ file_type: string; status: string }>>([])

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
            const data = await adminApi.getStats()
            if (data) setStats(data)
        } catch (err) {
            console.error('Failed to load admin stats:', err)
        }
    }, [])

    const loadLanStatus = useCallback(async () => {
        setIsLoadingLan(true)
        try {
            const s = await systemApi.getLanStatus()
            setLanEnabled(Boolean(s.enabled))
            setLanIps(Array.isArray(s.lan_ips) ? s.lan_ips : [])
        } catch (err) {
            console.error('Failed to load LAN status:', err)
        } finally {
            setIsLoadingLan(false)
        }
    }, [])

    const handleToggleLan = useCallback(
        async (nextEnabled: boolean) => {
            setIsLoadingLan(true)
            try {
                const s = await systemApi.toggleLan(nextEnabled)
                setLanEnabled(Boolean(s.enabled))
                setLanIps(Array.isArray(s.lan_ips) ? s.lan_ips : [])
                useToastStore.getState().info(
                    t('admin.lan.restartHint', '已更新區域網路設定。請重啟 start.py（或重啟後端/前端）後才會生效。')
                )
            } catch (err) {
                console.error('Failed to toggle LAN:', err)
                useToastStore.getState().error(getErrorMessage(err))
            } finally {
                setIsLoadingLan(false)
            }
        },
        [t]
    )

    const loadUsers = useCallback(async () => {
        setIsLoading(true)
        try {
            const data = await usersApi.listUsers({ page: 1, page_size: 100 })
            const fetchedUsers = data.data.map((item) => ({
                id: item.id,
                name: item.name,
                email: item.email,
                role: item.role,
                isActive: item.is_active,
                createdAt: item.created_at,
                lastLoginAt: item.last_login_at ?? undefined,
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

    /**
     * 抓近 7 天的 audit logs 給 Overview dashboard 的趨勢圖 & 分布圖用。
     * 不跟分頁用的 auditLogs 共用 state，避免使用者翻頁時把 dashboard 資料弄亂。
     */
    const loadAuditSummary = useCallback(async () => {
        try {
            const sevenDaysAgo = new Date()
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
            // page_size 上限是 100（後端 Query(20, ge=1, le=100)），
            // 給 100 是 7 天 dashboard 用得到的最大量。
            //
            // start_date 故意送 YYYY-MM-DD 純日期字串，不送 toISOString()：
            // toISOString() 會回傳 "...Z" timezone-aware ISO，後端
            // datetime.fromisoformat() 解析後是 tz-aware，跟 DB 中 tz-naive
            // 的 AuditLog.created_at 比較 SQL 會 raise → 500。
            // 純日期字串解析後是 tz-naive datetime at midnight，可正確比較。
            const yyyy = sevenDaysAgo.getFullYear()
            const mm = String(sevenDaysAgo.getMonth() + 1).padStart(2, '0')
            const dd = String(sevenDaysAgo.getDate()).padStart(2, '0')
            // 每頁最多 100 筆；只抓第一頁時「審計事件」會卡在 100、趨勢圖只剩今天。
            // 逐頁抓完近 7 天（最多 2000 筆，足夠 dashboard 統計）
            const startDate = `${yyyy}-${mm}-${dd}`
            const all: AuditLogItem[] = []
            for (let page = 1; page <= 20; page++) {
                const data = await getAuditLogs({ page, page_size: 100, start_date: startDate })
                all.push(...data.data)
                if (page >= (data.total_pages || 1)) break
            }
            setAuditSummary(all)
        } catch (err) {
            console.error('Failed to load audit summary:', err)
        }
    }, [])

    /**
     * 拉所有 documents 給 Overview 的「文件類型分布」「文件狀態」圖表用。
     * 不分頁（每次 mount 拉一次），用 documentsApi.list()。
     */
    const loadDocumentsForOverview = useCallback(async () => {
        try {
            const data = await documentsApi.list()
            setDocuments(
                data.data.map((d) => ({ file_type: d.file_type, status: d.status })),
            )
        } catch (err) {
            console.error('Failed to load documents for overview:', err)
        }
    }, [])

    useEffect(() => {
        loadStats()
        loadUsers()
        loadLanStatus()
        loadAuditSummary()
        loadDocumentsForOverview()
    }, [loadStats, loadUsers, loadLanStatus, loadAuditSummary, loadDocumentsForOverview])

    useEffect(() => {
        if (activeSection === 'models') loadModels()
        // 'overview' 也要載入 audit logs，因為新版 overview 有「最近活動」區塊。
        if (activeSection === 'audit' || activeSection === 'overview') loadAuditLogs()
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
                const updateData: UpdateUserPayload = {
                    name: userFormData.name,
                    role: userFormData.role,
                    is_active: userFormData.is_active,
                }
                if (userFormData.password) updateData.password = userFormData.password
                await usersApi.updateUser(currentEditingUser.id, updateData)
            } else {
                const createData: CreateUserPayload = {
                    name: userFormData.name,
                    email: userFormData.email,
                    password: userFormData.password,
                    role: userFormData.role,
                    is_active: userFormData.is_active,
                }
                await usersApi.createUser(createData)
            }
            setIsUserModalOpen(false)
            loadUsers()
        } catch (err) {
            useToastStore.getState().error(getErrorMessage(err))
        } finally {
            setIsSubmittingUser(false)
        }
    }

    const handleDeleteUser = async (item: UserData) => {
        // 使用專案統一的 ConfirmModal，避免跳出原生 window.confirm。
        showConfirm(`確定要刪除 ${item.name}（${item.email}）？此操作無法復原。`, async () => {
            try {
                await usersApi.deleteUser(item.id)
                useToastStore.getState().success(`已刪除使用者 ${item.name}`)
                loadUsers()
            } catch (err) {
                console.error('Failed to delete user', err)
                useToastStore.getState().error(getErrorMessage(err))
            }
        })
    }

    const handleForceLogout = async (item: UserData) => {
        showConfirm(`確定要強制登出 ${item.name}？對方目前的登入會立即失效，需要重新登入。`, async () => {
            const result = await adminApi.forceLogout(item.id)
            if (result) {
                useToastStore.getState().success(`已強制登出 ${item.name}`)
            } else {
                useToastStore.getState().error('強制登出失敗，請稍後再試')
            }
        })
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
            useToastStore.getState().error(getErrorMessage(err))
        } finally {
            setIsSubmittingTenant(false)
        }
    }

    const handleToggleTenantStatus = async (item: Tenant) => {
        const action = item.is_active ? '停用' : '啟用'
        showConfirm(`確定要${action}租戶 ${item.name}？`, async () => {
            try {
                // 修正：原本「停用」呼叫 deleteTenant 會直接從 DB 刪掉租戶，
                // 但所有 users / conversations / documents 還是 FK 指向它 → 全部 500。
                // 「停用 / 啟用」應該只切 is_active 旗標，不該真的刪資料。
                await tenantsApi.updateTenant(item.id, { is_active: !item.is_active })
                loadTenants()
            } catch (err) {
                console.error('Failed to toggle tenant status', err)
                useToastStore.getState().error(getErrorMessage(err))
            }
        })
    }

    // metricCards now live inside OverviewSection (presentational concern).

    // ngrok UI 已移除，改成 LAN 開關

    return (
        // 與 LoginPage 同款背景：bg-bg-base + 三條弧線 SVG 紋理（亮色 bronze、深色 white，極低 opacity）
        <div
            className="relative h-[100dvh] overflow-hidden bg-bg-base text-text-primary transition-colors duration-300"
            style={{
                paddingTop: 'env(safe-area-inset-top)',
                paddingBottom: 'env(safe-area-inset-bottom)',
            }}
        >
            {/* 背景弧線 SVG —— 同登入頁 */}
            <div aria-hidden className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                <WaveBackground />
            </div>
            <div className="relative z-10 mx-auto flex h-full max-w-[1500px] flex-col px-3 py-3 md:px-4 md:py-3">
                {/*
                  簡化過的 header（壓低 mb / pb 留空間給內容）
                */}
                {/* 手機板 header 簡化：title + 工程師 pill 並排同一行，省垂直空間 */}
                <header className="mb-2 md:mb-3 flex shrink-0 items-center gap-2 pb-2 md:justify-between">
                    <div className="flex items-center gap-2 md:gap-3 min-w-0">
                        <button
                            onClick={() => navigate('/')}
                            aria-label={t('common.backToChat', '返回聊天')}
                            className="btn-icon !w-[34px] !h-[34px] shrink-0 text-text-secondary"
                        >
                            <ArrowLeft className="w-[18px] h-[18px]" />
                        </button>
                        <h1 className="text-[16px] md:text-[22px] font-semibold tracking-tight text-text-primary truncate">{t('admin.title')}</h1>
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                        <div className="hidden items-center gap-2 rounded-full glass-chip px-3 py-1.5 text-xs font-semibold text-accent sm:flex">
                            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                            {t('admin.backendOnline')}
                        </div>
                        <div className="rounded-full glass-chip px-2.5 md:px-3 py-1 md:py-1.5 text-[11px] md:text-xs font-medium text-text-secondary truncate max-w-[100px] md:max-w-none">
                            {user?.name || t('admin.operator')}
                        </div>
                    </div>
                </header>

                {/*
                  手機板：flex column，aside 自然高度（只剩 nav 列）+ 內容區吃剩。
                  桌機板（lg+）：回到 sidebar grid 180/rest 兩欄佈局。
                */}
                <main className="flex flex-col flex-1 min-h-0 gap-3 lg:grid lg:grid-cols-[180px_minmax(0,1fr)]">
                    {/*
                      Sidebar 從 260px 砍到 180px —— 釋出 ~80px 給右側內容區。
                      內部 padding / 模型卡 / 導航 gap 全部緊縮，配合 Overview dashboard
                      在 ~1100px CSS 寬度也能塞進單一 viewport。
                    */}
                    {/*
                      手機板：h-auto，aside 只裝水平 nav，content 區拿剩餘高度。
                      桌機板（lg+）：h-full，aside 撐滿 grid row，wrapper 的 mt-auto 把 widget 推到底。
                      之前一律 h-full 的版本在手機板把 aside 撐滿整個 main → content 區被擠到 0 高度看不到。
                    */}
                    <aside className="flex h-auto lg:h-full flex-col overflow-hidden paper paper-lg lg:p-2">
                        {/* Model card 在手機板隱藏，騰出空間給內容 */}
                        <div className="hidden lg:block mb-2 rounded-[18px] border border-transparent bg-[var(--chip)] p-2.5">
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-[12px] text-text-secondary">{t('admin.currentModel')}</p>
                                    <p className="mt-0.5 truncate text-[12px] font-semibold text-text-primary">{currentModel?.name || t('admin.standby')}</p>
                                </div>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--chip)]">
                                <div className="h-full w-[72%] rounded-full bg-accent shadow-[0_0_12px_rgb(var(--accent)/0.35)]" />
                            </div>
                        </div>

                        {/*
                          手機板水平卷但不顯示 scrollbar（仍可手指滑），桌機板垂直 nav。
                          [&::-webkit-scrollbar]:hidden 等 utility 處理 webkit；
                          scrollbar-width:none / -ms-overflow-style:none 處理 Firefox / IE。
                          relative + 內嵌絕對定位 pill 用 transition 滑動到 active button 位置。
                        */}
                        {/* 手機版：分段切換（長按放大鏡、拖動、放開吸附，同登入／註冊）；側欄外框在手機版拿掉（.paper-lg），只留這一層膠囊 */}
                        <GlassSegmented
                            className="lg:hidden w-full h-[40px]"
                            pad={4}
                            value={activeSection}
                            onChange={(v) => setActiveSection(v)}
                            options={TABS_CONFIG.map((tb) => ({ value: tb.id, label: t(tb.i18nKey) }))}
                        />
                        {/* 桌機側欄：直向分段切換（按下即放大鏡）；py-2／-mx-2 px-2 留空間給放大鏡 */}
                        <nav
                            className="relative hidden lg:flex gap-1 py-2 -mx-2 px-2 overflow-x-auto lg:flex-col lg:overflow-y-auto shrink-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] lg:custom-scrollbar"
                        >
                            <GlassNav
                                size="sm"
                                gap={4}
                                aria-label={t('admin.title', '管理後台')}
                                value={activeSection}
                                onChange={(id) => setActiveSection(id)}
                                items={TABS_CONFIG.map((tab) => {
                                    const Icon = tab.icon
                                    return { id: tab.id, label: t(tab.i18nKey), icon: <Icon className="h-3.5 w-3.5" /> }
                                })}
                            />
                        </nav>

                        {/*
                          Sidebar 底部：Ngrok 公開隧道控制 + QR code。
                          FIX: mt-auto 必須掛在 flex 子項本身（這個 wrapper div）。
                          原本只寫在 NgrokSidebarWidget 內部，但因為被這個 wrapper 包住，
                          flex 看到的子項是 wrapper、不是 widget；wrapper 沒 mt-auto →
                          widget 不會被推到底，會緊貼 nav 後方。
                          手機板隱藏（lg+ 才出現），騰出空間給內容。
                        */}
                        <div className="hidden lg:block mt-auto">
                            <LanSidebarWidget
                                enabled={lanEnabled}
                                isLoading={isLoadingLan}
                                lanIps={lanIps}
                                onToggle={handleToggleLan}
                            />
                        </div>
                    </aside>

                    {/*
                      內容區：
                      - Overview 是「滿版 dashboard，不滾動」設計（內部 h-full grid），
                        在這層加 overflow 為 hidden 會擋到其他 tab，所以改用 overflow-y-auto +
                        移除 pb-8 / space-y-4，讓 Overview 的 h-full 精準對齊 viewport
                        （不被 32px padding 壓低）。
                      - 其他 tab（users / audit / models / 等）內容比較長，
                        靠這層的 overflow-y-auto 提供滾動。
                    */}
                    <div key={activeSection} className="admin-page-enter flex-1 min-h-0 min-w-0 overflow-y-auto scrollbar-none lg:h-full lg:flex-none">
                        {activeSection === 'overview' && (
                            <OverviewSection
                                stats={stats}
                                activeUsers={activeUsers}
                                /* 用 auditSummary（近 7 天，page_size=200）給 Overview 的圖表，
                                   不要傳 auditLogs（page_size=15）— 那是 audit 分頁用的 */
                                auditLogs={auditSummary}
                            />
                        )}

                        {activeSection === 'users' && (
                            <Suspense fallback={<div className="grid gap-4 p-5"><SkelCards count={3} className="h-[120px]" /></div>}>
                            <UsersSection
                                users={users}
                                activeUsers={activeUsers}
                                isLoading={isLoading}
                                onAddUser={handleAddUser}
                                onEditUser={handleEditUser}
                                onDeleteUser={handleDeleteUser}
                                onForceLogout={handleForceLogout}
                                currentUserId={user?.id}
                            />
                            </Suspense>
                        )}

                        {activeSection === 'models' && (
                            <Suspense fallback={<div className="grid gap-4 p-5"><SkelCards count={3} className="h-[120px]" /></div>}>
                            <ModelsSection
                                models={models}
                                modelsDir={modelsDir}
                                isLoadingModels={isLoadingModels}
                                sanitizePath={sanitizePath}
                                onRefreshModels={handleRefreshModels}
                                onSelectModel={handleSelectModel}
                            />
                            </Suspense>
                        )}

                        {activeSection === 'audit' && (
                            <Suspense fallback={<div className="grid gap-4 p-5"><SkelCards count={3} className="h-[120px]" /></div>}>
                            <AuditSection
                                auditSearchInput={auditSearchInput}
                                setAuditSearchInput={setAuditSearchInput}
                                auditFilter={auditFilter}
                                auditLogs={auditLogs}
                                auditTotal={auditTotal}
                                auditPage={auditPage}
                                auditTotalPages={auditTotalPages}
                                isLoadingAudit={isLoadingAudit}
                                auditDrawer={auditDrawer}
                                setAuditDrawer={setAuditDrawer}
                                onSearch={handleAuditSearch}
                                onFilterChange={handleAuditFilterChange}
                                onPageChange={handleAuditPageChange}
                                onExportCSV={handleExportCSV}
                                onExportJSON={handleExportJSON}
                            />
                            </Suspense>
                        )}

                        {/* 'system' tab 已移除：資訊跟 OverviewSection 的系統資源 / LLM 健康面板重複 */}

                        {activeSection === 'tenants' && (
                            <Suspense fallback={<div className="grid gap-4 p-5"><SkelCards count={3} className="h-[120px]" /></div>}>
                            <TenantsSection
                                tenants={tenants}
                                activeTenants={activeTenants}
                                isLoadingTenants={isLoadingTenants}
                                onAddTenant={handleAddTenant}
                                onEditTenant={handleEditTenant}
                                onToggleTenantStatus={handleToggleTenantStatus}
                            />
                            </Suspense>
                        )}
                    </div>
                </main>
            </div>

            {/* LAN 模式不需要額外 modal */}

            {isUserModalOpen && (
                <ModalFrame onClose={() => setIsUserModalOpen(false)}>
                    <h3 className="mb-6 text-xl font-semibold">{currentEditingUser ? t('admin.users.editTitle', '編輯使用者') : t('admin.users.addUser', '新增使用者')}</h3>
                    <form onSubmit={handleUserSubmit} className="space-y-4">
                        <Field label="Name"><input className={inputClass} required value={userFormData.name} onChange={(event) => setUserFormData((prev) => ({ ...prev, name: event.target.value }))} /></Field>
                        <Field label="Email"><input className={inputClass} type="email" required disabled={!!currentEditingUser} value={userFormData.email} onChange={(event) => setUserFormData((prev) => ({ ...prev, email: event.target.value }))} /></Field>
                        <Field label={currentEditingUser ? 'New password' : 'Password'}><input className={inputClass} type="password" required={!currentEditingUser} minLength={8} value={userFormData.password} onChange={(event) => setUserFormData((prev) => ({ ...prev, password: event.target.value }))} /></Field>
                        <Field label="Role">
                            <StyledSelect
                                value={userFormData.role}
                                onChange={(value) => setUserFormData((prev) => ({ ...prev, role: value }))}
                                options={[
                                    { value: 'user', label: 'User' },
                                    { value: 'engineer', label: 'Engineer' },
                                    { value: 'admin', label: 'Admin' },
                                ]}
                            />
                        </Field>
                        <label className="flex items-center justify-between rounded-[16px] snow-field px-4 py-3 text-sm text-text-primary">
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
                        <label className="flex items-center justify-between rounded-[16px] snow-field px-4 py-3 text-sm text-text-primary">
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

            {/* Audit detail drawer is now rendered inside AuditSection. */}
        </div>
    )
}
