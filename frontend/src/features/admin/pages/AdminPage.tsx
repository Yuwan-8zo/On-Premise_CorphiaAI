import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    ActionButton,
    ModalFrame,
    Field,
    inputClass,
} from '@/features/admin/components/AdminPrimitives'
import NgrokSidebarWidget from '@/features/admin/components/NgrokSidebarWidget'
import NgrokQrModal from '@/features/admin/components/NgrokQrModal'
import OverviewSection from '@/features/admin/sections/OverviewSection'
import AuditSection from '@/features/admin/sections/AuditSection'
import UsersSection from '@/features/admin/sections/UsersSection'
import ModelsSection from '@/features/admin/sections/ModelsSection'
import SystemSection from '@/features/admin/sections/SystemSection'
import TenantsSection from '@/features/admin/sections/TenantsSection'
// Only icons still used at AdminPage level: tab icons + sidebar logo + back arrow.
// Section-specific icons live inside each section module.
import {
    Activity,
    ArrowLeft,
    Building2,
    Cpu,
    FileText,
    Gauge,
    Sparkles,
    Users,
} from 'lucide-react'

import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { useToastStore } from '@/store/toastStore'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
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

// formatDate moved to AdminPrimitives (used by Overview / Audit sections)

// Admin shared UI primitives (Panel, SectionHeader, ActionButton, StatusPill,
// RoleBadge, ModalFrame, Field, inputClass, selectClass) extracted to
// ./components/AdminPrimitives — see the imports at the top of this file.

export default function Admin() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const { user } = useAuthStore()
    const demoMode = useUIStore((s) => s.demoMode)
    const showConfirm = useUIStore((s) => s.showConfirm)
    // 監聽瀏覽器是否有外網連線，用於 ngrok（公開網址）UI gating。
    // Corphia AI 主體 100% 地端可用，這旗標只影響「公開網址」這項功能；
    // 離線時 toggle 仍可顯示但會被攔截，並用 toast 提示使用者。
    const isOnline = useNetworkStatus()
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

    /**
     * Tab 切換滑動指示條：
     * 用 ref Map 記每個 tab button 的 DOM，activeSection 變動後測 left/width/top/height，
     * 把絕對定位的 pill 滑過去（CSS transition 處理動畫）。
     */
    const navRef = useRef<HTMLElement | null>(null)
    const tabBtnRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
    const [pillRect, setPillRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
    const [pillReady, setPillReady] = useState(false)

    useEffect(() => {
        const measure = () => {
            const btn = tabBtnRefs.current.get(activeSection)
            const nav = navRef.current
            if (!btn || !nav) return
            const navRect = nav.getBoundingClientRect()
            const btnRect = btn.getBoundingClientRect()
            // 用 nav 的 scroll 位置算相對座標（手機板 nav 會水平 scroll）
            setPillRect({
                left: btnRect.left - navRect.left + nav.scrollLeft,
                top: btnRect.top - navRect.top + nav.scrollTop,
                width: btnRect.width,
                height: btnRect.height,
            })
            // 第一次 mount 後 1 frame 才 enable transition，避免進場直接從 (0,0) 滑過去
            requestAnimationFrame(() => setPillReady(true))
        }
        measure()
        window.addEventListener('resize', measure)
        return () => window.removeEventListener('resize', measure)
    }, [activeSection])
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
        updated_at?: string | null
        source?: string
    } | null>(null)
    const [isLoadingNgrok, setIsLoadingNgrok] = useState(false)
    const [ngrokCopied, setNgrokCopied] = useState(false)
    const [isNgrokQrOpen, setIsNgrokQrOpen] = useState(false)

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

    const loadNgrokUrl = useCallback(async () => {
        setIsLoadingNgrok(true)
        try {
            const info = await systemApi.getNgrokUrl()
            setNgrokInfo(info)
        } catch (err) {
            console.error('Failed to load ngrok URL:', err)
            setNgrokInfo({ active: false, url: null, api_url: null, ws_url: null })
        } finally {
            setIsLoadingNgrok(false)
        }
    }, [])

    /**
     * 啟動 ngrok：呼叫後端 /system/ngrok/start，後端會 block 最多 20s 拿 URL。
     * 期間 isLoadingNgrok=true，UI 顯示 spinner。回來時更新 state。
     *
     * 離線守門：navigator.onLine === false 時直接擋掉，顯示 toast 給使用者。
     * 不打 API 是因為 ngrok 建立到外部服務的通道一定要外網；
     * 讓使用者等 20 秒 timeout 才知道沒網路，UX 很糟。
     */
    const handleStartNgrok = useCallback(async () => {
        if (!isOnline) {
            // 用 getState() 而非 hook 取 toast，避免讓 store state 變化都重渲整個 admin 頁。
            useToastStore.getState().error(
                t('admin.ngrok.offlineHint', '需要連上網際網路才能啟用公開網址，請確認網路連線後再試一次。')
            )
            return
        }
        setIsLoadingNgrok(true)
        try {
            const info = await systemApi.startNgrok()
            setNgrokInfo(info)
        } catch (err) {
            console.error('Failed to start ngrok:', err)
            // 失敗後重抓一次當前狀態（可能因為 binary 缺失或 authtoken 未設）
            try {
                const info = await systemApi.getNgrokUrl()
                setNgrokInfo(info)
            } catch {
                setNgrokInfo({ active: false, url: null, api_url: null, ws_url: null })
            }
        } finally {
            setIsLoadingNgrok(false)
        }
    }, [isOnline, t])

    /**
     * 關閉 ngrok：呼叫 /system/ngrok/stop（taskkill / pkill），更新 state 為 inactive。
     */
    const handleStopNgrok = useCallback(async () => {
        setIsLoadingNgrok(true)
        try {
            const info = await systemApi.stopNgrok()
            setNgrokInfo(info)
        } catch (err) {
            console.error('Failed to stop ngrok:', err)
        } finally {
            setIsLoadingNgrok(false)
        }
    }, [])

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
            const data = await getAuditLogs({
                page: 1,
                page_size: 100,
                start_date: `${yyyy}-${mm}-${dd}`,
            })
            setAuditSummary(data.data)
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
        loadNgrokUrl()
        loadAuditSummary()
        loadDocumentsForOverview()
    }, [loadStats, loadUsers, loadNgrokUrl, loadAuditSummary, loadDocumentsForOverview])

    /*
     * Free-tier ngrok rotates the public subdomain on every reconnect.
     * Poll /system/ngrok every 30s while the admin page is mounted so the
     * displayed URL stays current without a manual reload. Backend has its
     * own watcher that writes runtime files; this is just the UI side.
     */
    useEffect(() => {
        if (activeSection !== 'overview') return
        const id = window.setInterval(() => {
            loadNgrokUrl()
        }, 30_000)
        return () => window.clearInterval(id)
    }, [activeSection, loadNgrokUrl])

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
            window.alert(getErrorMessage(err))
        } finally {
            setIsSubmittingUser(false)
        }
    }

    const handleDeleteUser = async (item: UserData) => {
        // 使用專案統一的 ConfirmModal，避免跳出原生 window.confirm。
        showConfirm(`確定要刪除 ${item.name}？此操作會移除該使用者。`, async () => {
            try {
                await usersApi.deleteUser(item.id)
                loadUsers()
            } catch (error) {
                console.error('Failed to delete user', error)
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
            window.alert(getErrorMessage(err))
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
                window.alert(getErrorMessage(err))
            }
        })
    }

    // metricCards now live inside OverviewSection (presentational concern).

    // 一鍵複製 ngrok URL
    const handleCopyNgrokUrl = async () => {
        if (!ngrokInfo?.url) return
        await navigator.clipboard.writeText(ngrokInfo.url)
        setNgrokCopied(true)
        setTimeout(() => setNgrokCopied(false), 2000)
    }

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
                <svg className="absolute w-full h-full" preserveAspectRatio="none" viewBox="0 0 1440 900" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path className="fill-corphia-bronze dark:fill-white opacity-[0.03] dark:opacity-[0.02] transition-colors duration-300" d="M0,0 C400,400 1000,500 1440,200 L1440,900 L0,900 Z" />
                    <path className="fill-corphia-bronze dark:fill-white opacity-[0.06] dark:opacity-[0.03] transition-colors duration-300" d="M0,300 C500,800 1100,700 1440,400 L1440,900 L0,900 Z" />
                    <path className="fill-corphia-bronze dark:fill-white opacity-[0.02] dark:opacity-[0.01] transition-colors duration-300" d="M0,600 C600,900 1200,600 1440,700 L1440,900 L0,900 Z" />
                </svg>
            </div>
            <div className="relative z-10 mx-auto flex h-full max-w-[1500px] flex-col px-3 py-3 md:px-4 md:py-3">
                {/*
                  簡化過的 header（壓低 mb / pb 留空間給內容）
                */}
                {/* 手機板 header 簡化：title + 工程師 pill 並排同一行，省垂直空間 */}
                <header className="mb-2 md:mb-3 flex shrink-0 items-center gap-2 border-b border-border-subtle pb-2 md:justify-between">
                    <div className="flex items-center gap-2 md:gap-3 min-w-0">
                        <button
                            onClick={() => navigate('/')}
                            className="flex h-8 w-8 md:h-9 md:w-9 items-center justify-center rounded-full text-text-secondary transition hover:bg-bg-base hover:text-text-primary active:scale-[0.98]"
                            title={t('common.backToChat', '返回聊天')}
                        >
                            <ArrowLeft className="h-4 w-4 md:h-5 md:w-5" />
                        </button>
                        <h1 className="text-[16px] md:text-[22px] font-semibold tracking-tight text-text-primary truncate">{t('admin.title')}</h1>
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                        <div className="hidden items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent sm:flex">
                            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                            {t('admin.backendOnline')}
                        </div>
                        <div className="rounded-full border border-border-subtle bg-bg-base px-2.5 md:px-3 py-1 md:py-1.5 text-[11px] md:text-xs font-medium text-text-secondary truncate max-w-[100px] md:max-w-none">
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
                    <aside className="flex h-auto lg:h-full flex-col overflow-hidden rounded-cv-lg border border-white/50 dark:border-white/20 bg-bg-base/70 supports-[backdrop-filter]:bg-bg-base/55 backdrop-blur-2xl shadow-[0_8px_28px_rgb(0_0_0/0.06)] dark:shadow-[0_8px_28px_rgb(0_0_0/0.32)] p-2">
                        {/* Model card 在手機板隱藏，騰出空間給內容 */}
                        <div className="hidden lg:block mb-2 rounded-cv-md border border-white/50 dark:border-white/20 bg-bg-surface/60 supports-[backdrop-filter]:bg-bg-surface/45 backdrop-blur-xl p-2.5">
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-[9px] uppercase tracking-[0.16em] text-text-secondary">{t('admin.currentModel')}</p>
                                    <p className="mt-0.5 truncate text-[12px] font-semibold text-text-primary">{currentModel?.name || t('admin.standby')}</p>
                                </div>
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10">
                                    <Sparkles className="h-3.5 w-3.5 text-accent" />
                                </span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-border-subtle/40">
                                <div className="h-full w-[72%] rounded-full bg-accent shadow-[0_0_12px_rgb(var(--accent)/0.35)]" />
                            </div>
                        </div>

                        {/*
                          手機板水平卷但不顯示 scrollbar（仍可手指滑），桌機板垂直 nav。
                          [&::-webkit-scrollbar]:hidden 等 utility 處理 webkit；
                          scrollbar-width:none / -ms-overflow-style:none 處理 Firefox / IE。
                          relative + 內嵌絕對定位 pill 用 transition 滑動到 active button 位置。
                        */}
                        <nav
                            ref={navRef}
                            /* py-0.5 給 pill 上下一點呼吸空間 —— overflow-x-auto 會在 Y 軸自動 clip，
                               所以 ring / shadow 會被吃掉，padding 讓它有地方畫。 */
                            className="relative flex gap-1 py-0.5 overflow-x-auto lg:flex-col lg:overflow-y-auto shrink-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] lg:custom-scrollbar"
                        >
                            {/* 滑動 active pill —— 絕對定位、跟著 active button rect。
                                ring-inset：把 ring 畫在 pill 內部，不會超出 rect 被 nav clip 掉。 */}
                            {pillRect && (
                                <div
                                    aria-hidden
                                    className="pointer-events-none absolute z-0 rounded-[14px] bg-bg-elevated ring-1 ring-inset ring-white/40 dark:ring-white/10"
                                    style={{
                                        left: pillRect.left,
                                        top: pillRect.top,
                                        width: pillRect.width,
                                        height: pillRect.height,
                                        transition: pillReady
                                            ? 'left 0.35s cubic-bezier(0.23,1,0.32,1), top 0.35s cubic-bezier(0.23,1,0.32,1), width 0.35s cubic-bezier(0.23,1,0.32,1), height 0.35s cubic-bezier(0.23,1,0.32,1)'
                                            : 'none',
                                    }}
                                />
                            )}
                            {TABS_CONFIG.map((tab) => {
                                const Icon = tab.icon
                                const active = activeSection === tab.id
                                return (
                                    <button
                                        key={tab.id}
                                        ref={(el) => {
                                            if (el) tabBtnRefs.current.set(tab.id, el)
                                            else tabBtnRefs.current.delete(tab.id)
                                        }}
                                        onClick={() => setActiveSection(tab.id)}
                                        /* 移除原本 active 的 bg / ring / shadow（交給 pill 處理），
                                           只保留 text 顏色切換；relative + z-10 讓 button 內容浮在 pill 之上 */
                                        className={`tap relative z-10 flex min-w-max items-center gap-2 rounded-[14px] px-3 py-2 text-left text-[13px] font-semibold transition-colors active:scale-[0.99] lg:min-w-0 ${
                                            active
                                                ? 'text-text-primary'
                                                : 'text-text-secondary hover:text-text-primary'
                                        }`}
                                    >
                                        <Icon className={`h-3.5 w-3.5 transition-colors ${active ? 'text-accent' : 'text-text-muted'}`} />
                                        {t(tab.i18nKey)}
                                    </button>
                                )
                            })}
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
                            <NgrokSidebarWidget
                                info={ngrokInfo}
                                isLoading={isLoadingNgrok}
                                copied={ngrokCopied}
                                isOffline={!isOnline}
                                onCopyUrl={handleCopyNgrokUrl}
                                onShowQr={() => setIsNgrokQrOpen(true)}
                                onStart={handleStartNgrok}
                                onStop={handleStopNgrok}
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
                    <div className="flex-1 min-h-0 min-w-0 overflow-y-auto pr-1 custom-scrollbar md:pr-2 lg:h-full lg:flex-none">
                        {activeSection === 'overview' && (
                            <OverviewSection
                                stats={stats}
                                activeUsers={activeUsers}
                                /* 用 auditSummary（近 7 天，page_size=200）給 Overview 的圖表，
                                   不要傳 auditLogs（page_size=15）— 那是 audit 分頁用的 */
                                auditLogs={auditSummary}
                                users={users}
                                documents={documents}
                            />
                        )}

                        {activeSection === 'users' && (
                            <UsersSection
                                users={users}
                                activeUsers={activeUsers}
                                isLoading={isLoading}
                                onAddUser={handleAddUser}
                                onEditUser={handleEditUser}
                                onDeleteUser={handleDeleteUser}
                            />
                        )}

                        {activeSection === 'models' && (
                            <ModelsSection
                                models={models}
                                modelsDir={modelsDir}
                                isLoadingModels={isLoadingModels}
                                sanitizePath={sanitizePath}
                                onRefreshModels={handleRefreshModels}
                                onSelectModel={handleSelectModel}
                            />
                        )}

                        {activeSection === 'audit' && (
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
                        )}

                        {activeSection === 'system' && (
                            <SystemSection currentModelName={currentModel?.name} />
                        )}

                        {activeSection === 'tenants' && (
                            <TenantsSection
                                tenants={tenants}
                                activeTenants={activeTenants}
                                isLoadingTenants={isLoadingTenants}
                                onAddTenant={handleAddTenant}
                                onEditTenant={handleEditTenant}
                                onToggleTenantStatus={handleToggleTenantStatus}
                            />
                        )}
                    </div>
                </main>
            </div>

            {/* Ngrok QR Code 大尺寸 modal —— 點 sidebar QR 按鈕後在螢幕中央顯示，純 QR 無文字 */}
            <NgrokQrModal
                url={ngrokInfo?.url || null}
                isOpen={isNgrokQrOpen}
                onClose={() => setIsNgrokQrOpen(false)}
            />

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

            {/* Audit detail drawer is now rendered inside AuditSection. */}
        </div>
    )
}
