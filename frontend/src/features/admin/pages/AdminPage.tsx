/**
 * 管理後台
 *   左側：目前模型、分頁導覽（手機版變成上方的分段切換）、區域網路開關
 *   右側：總覽／使用者／模型／稽核／租戶
 * 資料與動作都在 features/admin/hooks（每個分頁一個），這裡只負責版面與把資料接到各分頁
 */
import { lazy, Suspense, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Building2, Cpu, FileText, Gauge, Users } from '@/components/snow/icons'
import GlassNav from '@/components/ui/GlassNav'
import GlassSegmented from '@/components/ui/GlassSegmented'
import { SkelCards } from '@/components/ui/Skeleton'
import WaveBackground from '@/components/ui/WaveBackground'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { TenantFormModal, UserFormModal } from '../components/AdminFormModals'
import LanSidebarWidget from '../components/LanSidebarWidget'
import { useAdminAudit } from '../hooks/useAdminAudit'
import { useAdminModels, useAdminStats, useLanStatus } from '../hooks/useAdminSystem'
import { useAdminTenants } from '../hooks/useAdminTenants'
import { useAdminUsers } from '../hooks/useAdminUsers'
import OverviewSection from '../sections/OverviewSection'
import { useFitToHost } from '../hooks/useFitToHost'

const AuditSection = lazy(() => import('../sections/AuditSection'))
const UsersSection = lazy(() => import('../sections/UsersSection'))
const ModelsSection = lazy(() => import('../sections/ModelsSection'))
const TenantsSection = lazy(() => import('../sections/TenantsSection'))

type AdminSection = 'overview' | 'users' | 'models' | 'audit' | 'tenants'

const TABS: Array<{ id: AdminSection; i18nKey: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'overview', i18nKey: 'admin.tabs.overview', icon: Gauge },
    { id: 'users', i18nKey: 'admin.tabs.users', icon: Users },
    { id: 'models', i18nKey: 'admin.tabs.models', icon: Cpu },
    { id: 'audit', i18nKey: 'admin.tabs.audit', icon: FileText },
    { id: 'tenants', i18nKey: 'admin.tabs.tenants', icon: Building2 },
]

/** 分頁程式還在下載時顯示的骨架 */
const SectionSkeleton = <div className="grid gap-4 p-5"><SkelCards count={3} className="h-[var(--sz-120)]" /></div>

export default function Admin() {
    const { t } = useTranslation()
    // 寬版時整頁縮放到剛好一個畫面，不捲動、不被裁
    const fitRef = useFitToHost<HTMLDivElement>()
    const navigate = useNavigate()
    const { user } = useAuthStore()
    const demoMode = useUIStore((s) => s.demoMode)
    const [activeSection, setActiveSection] = useState<AdminSection>('overview')

    const stats = useAdminStats()
    const users = useAdminUsers()
    const models = useAdminModels()
    const audit = useAdminAudit()
    const tenants = useAdminTenants()
    const lan = useLanStatus()

    // 只有管理員與工程師可以進後台
    useEffect(() => {
        if (user?.role !== 'admin' && user?.role !== 'engineer') navigate('/')
    }, [user, navigate])

    // 切到分頁時才載入它的資料（總覽也要載入稽核：有「最近活動」區塊）
    const { loadModels } = models
    const { loadAuditLogs } = audit
    const { loadTenants } = tenants
    useEffect(() => {
        if (activeSection === 'models') loadModels()
        if (activeSection === 'audit' || activeSection === 'overview') loadAuditLogs()
        if (activeSection === 'tenants') loadTenants()
    }, [activeSection, loadAuditLogs, loadModels, loadTenants])

    /** 展示模式：路徑只顯示最後兩段，不露出使用者目錄 */
    const sanitizePath = (p: string) => {
        if (!p || !demoMode) return p || ''
        return p.split(/[\\/]/).filter(Boolean).slice(-2).join('/') || p
    }

    return (
        <div
            className="edge-shell admin-shell fixed inset-0 overflow-hidden bg-bg-base text-text-primary transition-colors duration-300"
            style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
            <div aria-hidden className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                <WaveBackground />
            </div>
            {/* 間距統一 12px（外圍四邊＝標題列到內容＝卡片之間）；根字級比 16 小，一律用 px */}
            {/* 寬版（lg）時整頁縮放到剛好一個畫面（useFitToHost）；手機上下堆疊的版面照常捲動 */}
            <div ref={fitRef} className="admin-fit relative z-10 mx-auto flex h-full max-w-[var(--sz-1500)] flex-col p-[var(--space)] lg:[--fit-on:1]">
                {/* 頂端：返回、標題、連線狀態、目前使用者 */}
                <header className="admin-head mb-[var(--space)] flex shrink-0 items-center gap-2 md:justify-between">
                    <div className="flex items-center gap-2 md:gap-3 min-w-0">
                        <button
                            onClick={() => navigate('/')}
                            aria-label={t('common.backToChat', '返回聊天')}
                            className="admin-back btn-icon !w-[var(--admin-back)] !h-[var(--admin-back)] shrink-0 text-text-secondary"
                        >
                            <ArrowLeft className="w-[var(--sz-18)] h-[var(--sz-18)]" />
                        </button>
                        <h1 className="text-[length:var(--fs-16)] md:text-[length:var(--fs-22)] font-semibold tracking-tight text-text-primary truncate">{t('admin.title')}</h1>
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                        <div className="hidden items-center gap-2 rounded-full glass-chip px-3 py-1.5 text-xs font-semibold text-accent sm:flex">
                            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                            {t('admin.backendOnline')}
                        </div>
                        <div className="rounded-full glass-chip px-2.5 md:px-3 py-1 md:py-1.5 text-[length:var(--fs-11)] md:text-xs font-medium text-text-secondary truncate max-w-[var(--sz-100)] md:max-w-none">
                            {user?.name || t('admin.operator')}
                        </div>
                    </div>
                </header>

                {/* 手機：上下排（導覽在上、內容吃剩下的高度）；桌機（lg）：左側欄 180＋右內容 */}
                <main className="flex flex-col flex-1 min-h-0 gap-[var(--space)] lg:grid lg:grid-cols-[180px_minmax(0,1fr)]">
                    <aside data-fit-check className="flex h-auto lg:h-full flex-col overflow-hidden lg:overflow-visible paper paper-lg lg:!rounded-[var(--admin-r)] lg:p-[var(--space)]">
                        {/* 目前模型（只在桌機顯示） */}
                        <div className="hidden lg:block mb-[var(--space)] rounded-[var(--admin-in)] border border-transparent bg-[var(--chip)] p-[var(--space)]">
                            <div className="mb-2 min-w-0">
                                <p className="text-[length:var(--fs-12)] text-text-secondary">{t('admin.currentModel')}</p>
                                <p className="mt-0.5 truncate text-[length:var(--fs-12)] font-semibold text-text-primary">{models.currentModel?.name || t('admin.standby')}</p>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--chip)]">
                                <div className="h-full w-[72%] rounded-full bg-accent shadow-[0_0_12px_rgb(var(--accent)/0.35)]" />
                            </div>
                        </div>

                        {/* 手機：分段切換 */}
                        <GlassSegmented
                            className="lg:hidden w-full h-[var(--sz-40)]"
                            value={activeSection}
                            onChange={(v) => setActiveSection(v)}
                            options={TABS.map((tab) => ({ value: tab.id, label: t(tab.i18nKey) }))}
                        />
                        {/* 桌機：直向導覽；不裁切，放大鏡長大超出範圍也完整顯示 */}
                        <nav className="admin-nav relative z-10 hidden lg:flex lg:flex-col gap-1 py-2 shrink-0 overflow-visible">
                            <GlassNav
                                size="sm"
                                gap="--nav-gap-sm"
                                aria-label={t('admin.title', '管理後台')}
                                value={activeSection}
                                onChange={(id) => setActiveSection(id)}
                                items={TABS.map((tab) => {
                                    const Icon = tab.icon
                                    return { id: tab.id, label: t(tab.i18nKey), icon: <Icon className="h-3.5 w-3.5" /> }
                                })}
                            />
                        </nav>

                        {/* 側欄底部：區域網路開關（mt-auto 推到最下面，只在桌機顯示） */}
                        <div className="hidden lg:block mt-auto">
                            <LanSidebarWidget enabled={lan.enabled} isLoading={lan.isLoading} lanIps={lan.lanIps} onToggle={lan.onToggle} />
                        </div>
                    </aside>

                    {/* 內容區：總覽是不捲動的滿版儀表板，其他分頁靠這層捲動 */}
                    <div key={activeSection} data-fit-check className="admin-page-enter flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-x-none touch-pan-y scrollbar-none lg:h-full lg:flex-none">
                        {activeSection === 'overview' && (
                            // 圖表用近 7 天的完整紀錄，不是稽核分頁那 15 筆
                            <OverviewSection stats={stats} activeUsers={users.activeUsers} auditLogs={audit.auditSummary} />
                        )}

                        <Suspense fallback={SectionSkeleton}>
                            {activeSection === 'users' && (
                                <UsersSection
                                    users={users.users}
                                    activeUsers={users.activeUsers}
                                    isLoading={users.isLoading}
                                    onAddUser={users.openAdd}
                                    onEditUser={users.openEdit}
                                    onDeleteUser={users.remove}
                                    onForceLogout={users.forceLogout}
                                    currentUserId={user?.id}
                                />
                            )}
                            {activeSection === 'models' && (
                                <ModelsSection
                                    models={models.models}
                                    modelsDir={models.modelsDir}
                                    isLoadingModels={models.isLoadingModels}
                                    sanitizePath={sanitizePath}
                                    onRefreshModels={models.onRefreshModels}
                                    onSelectModel={models.onSelectModel}
                                />
                            )}
                            {activeSection === 'audit' && <AuditSection {...audit.sectionProps} />}
                            {activeSection === 'tenants' && (
                                <TenantsSection
                                    tenants={tenants.tenants}
                                    activeTenants={tenants.activeTenants}
                                    isLoadingTenants={tenants.isLoading}
                                    onAddTenant={tenants.openAdd}
                                    onEditTenant={tenants.openEdit}
                                    onToggleTenantStatus={tenants.toggleStatus}
                                />
                            )}
                        </Suspense>
                    </div>
                </main>
            </div>

            <UserFormModal users={users} />
            <TenantFormModal tenants={tenants} />
        </div>
    )
}
