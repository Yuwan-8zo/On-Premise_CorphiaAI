/**
 * Admin > Overview tab — 單視窗 Dashboard
 * ----------------------------------------
 * 設計目標：所有資訊塞進一個 viewport，不需要滾動。
 *
 * 排版（top → bottom，外層 grid-rows: auto / 1fr / 1fr）：
 *   Row 1 (auto)       — 6 張 KPI 卡：Users / Conversations / Documents / Messages
 *                        / Active Users / Today Events
 *   Row 2 (1fr,minh0)  — 7-day Activity 柱狀圖 (col-span-7) + Event Distribution
 *                        donut + legend (col-span-5)
 *   Row 3 (1fr,minh0)  — User Roles donut (col-4) + Document Types donut (col-4)
 *                        + Document Status bar (col-4)
 *
 * 拿掉了：
 *   - Recent Activity / Recent Operators 列表（已有 audit / users 專屬分頁，避免重複）
 *   - Ngrok Remote Access strip（已移到 AdminPage sidebar 底部 NgrokSidebarWidget）
 *
 * 配色：
 *   全部走 accent / bg-* 系列，跟著使用者選的品牌色變
 *   圖表 fill / stroke 透過 useAccentColor 把 CSS var 轉成具體 RGB 字串
 */

import { parseServerDate } from '@/lib/utils'
import {
    Activity,
    FileText,
    Layers3,
    MessageSquare,
    ShieldCheck,
    Users,
} from '@/components/snow/icons'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Skel } from '@/components/ui/Skeleton'

import { adminApi } from '@/api/admin'
import type { AuditLogItem } from '@/api/auditLogs'
import { usePolling } from '@/features/admin/hooks/usePolling'
import {
    Panel,
    SectionHeader,
} from '@/features/admin/components/AdminPrimitives'
import ActivityBarChart from '@/features/admin/components/charts/ActivityBarChart'
import EventDonut, {
    EventDonutLegend,
} from '@/features/admin/components/charts/EventDonut'
import SecurityEventsPanel from '@/features/admin/components/panels/SecurityEventsPanel'
import LLMHealthPanel from '@/features/admin/components/panels/LLMHealthPanel'
import SystemResourcePanel from '@/features/admin/components/panels/SystemResourcePanel'
import {
    aggregateByAction,
    aggregateByDay,
} from '@/features/admin/utils/auditAggregations'

// ---------------------------------------------------------------------------
// Types — kept local since they only describe what AdminPage feeds in here.
// ---------------------------------------------------------------------------

interface OverviewStats {
    totalUsers: number
    totalConversations: number
    totalDocuments: number
    totalMessages: number
}

export interface OverviewSectionProps {
    stats: OverviewStats
    activeUsers: number
    /** null＝還在載入 */
    auditLogs: AuditLogItem[] | null
}

export default function OverviewSection({
    stats,
    activeUsers,
    auditLogs: auditLogsOrNull,
}: OverviewSectionProps) {
    const { t } = useTranslation()
    const auditLoading = auditLogsOrNull === null
    const auditLogs = useMemo(() => auditLogsOrNull ?? [], [auditLogsOrNull])

    const { data: dashboardSnapshot } = usePolling(
        () => adminApi.getDashboardSnapshot(),
        8000,
        true,
    )

    // 前端聚合圖表所需 series（memoised — 來源資料沒變就不重算）
    const dailySeries = useMemo(() => aggregateByDay(auditLogs, 7), [auditLogs])
    const actionSeries = useMemo(() => aggregateByAction(auditLogs, 5), [auditLogs])

    // 今日事件數 — 從 auditLogs（即近 7 天的 summary）篩出 created_at 在今天的
    const todayEventCount = useMemo(() => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const tomorrow = today.getTime() + 86400000
        return auditLogs.filter((log) => {
            const t = parseServerDate(log.created_at).getTime()
            return t >= today.getTime() && t < tomorrow
        }).length
    }, [auditLogs])

    // 6 張 KPI 卡（4 個業務 stat + 2 個即時數）— 各自配色
    const metricCards = [
        {
            label: t('admin.overview.users'),
            value: stats.totalUsers,
            icon: Users,
            iconBg: 'bg-[color-mix(in_srgb,var(--sys-blue)_20%,transparent)]',
            iconColor: 'text-[var(--sys-blue)]',
        },
        {
            label: t('admin.overview.conversations'),
            value: stats.totalConversations,
            icon: MessageSquare,
            iconBg: 'bg-[color-mix(in_srgb,var(--sys-green)_20%,transparent)]',
            iconColor: 'text-[var(--sys-green)]',
        },
        {
            label: t('admin.overview.documents'),
            value: stats.totalDocuments,
            icon: Layers3,
            iconBg: 'bg-[color-mix(in_srgb,var(--sys-purple)_20%,transparent)]',
            iconColor: 'text-[var(--sys-purple)]',
        },
        {
            label: t('admin.overview.messages'),
            value: stats.totalMessages,
            icon: FileText,
            iconBg: 'bg-[color-mix(in_srgb,var(--sys-orange)_20%,transparent)]',
            iconColor: 'text-[var(--sys-orange)]',
        },
        {
            label: t('admin.overview.activeUsers', '活躍使用者'),
            value: activeUsers,
            icon: Activity,
            iconBg: 'bg-[color-mix(in_srgb,var(--sys-teal)_20%,transparent)]',
            iconColor: 'text-[var(--sys-teal)]',
        },
        {
            label: t('admin.overview.eventsToday', '今日事件'),
            value: todayEventCount,
            loading: auditLoading,
            icon: ShieldCheck,
            iconBg: 'bg-[color-mix(in_srgb,var(--sys-red)_20%,transparent)]',
            iconColor: 'text-[var(--sys-red)]',
        },
    ]

    return (
        // 手機板：用自然高度逐區堆疊，外層 AdminPage 會處理垂直滾動。
        // 桌機板（lg+）：回到「滿視窗 dashboard」3-row 設計，圖表自動填滿剩餘空間。
        <div className="admin-overview grid gap-[var(--space)] lg:h-full lg:grid-rows-[auto_minmax(min-content,1fr)_minmax(min-content,1fr)]">
            {/* ─────────────────────────────────────────────────────────────
              Row 1 · KPI strip（6 張小卡，shrink-0）
              斷點降到 lg 是因為使用者實際 CSS 寬度大概在 1100px（高 DPR），
              用 xl (1280) 不會觸發 → 卡片全部 fallback 到 sm:3 column 太鬆
              ───────────────────────────────────────────────────────────── */}
            <section className="grid grid-cols-2 gap-[var(--space)] sm:grid-cols-3 lg:grid-cols-6 stagger-fade-in">
                {metricCards.map((item) => {
                    const Icon = item.icon
                    return (
                        <Panel
                            key={item.label}
                            className="pl-[var(--sp-20)] pr-[var(--sp-16)] py-[var(--space)]"
                        >
                            <div className="relative flex flex-wrap items-center gap-x-[var(--space)] gap-y-[var(--sp-6)]">
                                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--r-13)] ${item.iconBg} ${item.iconColor}`}>
                                    <Icon className="h-3.5 w-3.5" />
                                </span>
                                <div className="flex-1 basis-[max-content]">
                                    <p className="whitespace-nowrap text-[length:var(--fs-12)] font-medium text-text-secondary">
                                        {item.label}
                                    </p>
                                    <p className={`text-[length:var(--fs-18)] font-semibold leading-tight tabular-nums ${item.iconColor}`}>
                                        {item.loading ? <Skel className="inline-block h-[var(--sz-22)] w-[var(--sz-40)] align-middle" /> : item.value.toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        </Panel>
                    )
                })}
            </section>

            {/* ─────────────────────────────────────────────────────────────
              Row 2 · Charts (Activity trend + Event distribution)
              7/5 split @ lg+，下面 Row 3 也是 lg:grid-cols-12
              小於 lg 時會堆疊（手機 / 窄視窗），下方加 min-height fallback
              ───────────────────────────────────────────────────────────── */}
            <section className="grid min-h-0 grid-cols-1 gap-[var(--space)] lg:grid-cols-12">
                <Panel className="overflow-hidden flex flex-col min-h-[var(--sz-180)] lg:col-span-7">
                    <SectionHeader
                        title={t('admin.overview.trendTitle', '近 7 天事件趨勢')}
                    />
                    <div className="flex-1 min-h-0 px-[var(--space)] pb-[var(--space)]">
                        {auditLoading ? <Skel className="h-full w-full rounded-[var(--r-16)]" /> : <ActivityBarChart data={dailySeries} height="100%" />}
                    </div>
                </Panel>

                <Panel className="overflow-hidden flex flex-col min-h-[var(--sz-180)] lg:col-span-5">
                    <SectionHeader
                        title={t('admin.overview.distributionTitle', '事件分布')}
                    />
                    {/*
                      grid-rows-[minmax(0,1fr)]：明確告訴 grid「這列的高度等於容器高度」，
                      不然 grid row 預設 auto 會跟 height:100% 的子元素互鎖變成 0。
                    */}
                    <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)_minmax(0,120px)] grid-rows-[minmax(0,1fr)] gap-[var(--space)] px-[var(--space)] pb-[var(--space)]">
                        <div className="min-h-0 h-full">
                            {auditLoading ? <Skel className="h-full w-full rounded-full" /> : <EventDonut data={actionSeries} height="100%" />}
                        </div>
                        <div className="flex items-center min-h-0 overflow-y-auto custom-scrollbar">
                            <div className="w-full">
                                <EventDonutLegend data={actionSeries} />
                            </div>
                        </div>
                    </div>
                </Panel>
            </section>

            {/* ─────────────────────────────────────────────────────────────
              Row 3 · 資安事件 / LLM 健康度 / 系統資源
              5/4/3 split @ lg+
              ───────────────────────────────────────────────────────────── */}
            <section className="grid min-h-0 grid-cols-1 gap-[var(--space)] lg:grid-cols-12">
                <SecurityEventsPanel
                    className="lg:col-span-5"
                    securitySummary={dashboardSnapshot?.security ?? null}
                />
                <LLMHealthPanel
                    className="lg:col-span-4"
                    aiBoot={dashboardSnapshot?.ai}
                />
                <SystemResourcePanel className="lg:col-span-3" />
            </section>

        </div>
    )
}
