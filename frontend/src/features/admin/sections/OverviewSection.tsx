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
 *   全部走 accent / corphia-bronze / bg-* 系列，跟著使用者選的品牌色變
 *   圖表 fill / stroke 透過 useAccentColor 把 CSS var 轉成具體 RGB 字串
 */

import {
    Activity,
    FileText,
    Layers3,
    MessageSquare,
    ShieldCheck,
    Users,
} from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { AuditLogItem } from '@/api/auditLogs'
import {
    Panel,
    SectionHeader,
} from '@/features/admin/components/AdminPrimitives'
import ActivityBarChart from '@/features/admin/components/charts/ActivityBarChart'
import EventDonut, {
    EventDonutLegend,
} from '@/features/admin/components/charts/EventDonut'
import MiniDonut from '@/features/admin/components/charts/MiniDonut'
import StatusBar from '@/features/admin/components/charts/StatusBar'
import {
    aggregateByAction,
    aggregateByDay,
    groupByKey,
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

interface OverviewUser {
    id: string
    name: string
    email: string
    isActive: boolean
    role?: string
}

interface OverviewDocument {
    file_type: string
    status: string
}

export interface OverviewSectionProps {
    stats: OverviewStats
    activeUsers: number
    auditLogs: AuditLogItem[]
    users: OverviewUser[]
    documents: OverviewDocument[]
}

export default function OverviewSection({
    stats,
    activeUsers,
    auditLogs,
    users,
    documents,
}: OverviewSectionProps) {
    const { t } = useTranslation()

    // 前端聚合圖表所需 series（memoised — 來源資料沒變就不重算）
    const dailySeries = useMemo(() => aggregateByDay(auditLogs, 7), [auditLogs])
    const actionSeries = useMemo(() => aggregateByAction(auditLogs, 5), [auditLogs])

    // 使用者角色分布（admin / engineer / user）
    const roleSeries = useMemo(
        () =>
            groupByKey(
                users,
                (u) => u.role ?? 'user',
                {
                    admin: t('admin.users.role.admin', { defaultValue: 'Admin' }),
                    engineer: t('admin.users.role.engineer', { defaultValue: 'Engineer' }),
                    user: t('admin.users.role.user', { defaultValue: 'User' }),
                },
            ),
        [users, t],
    )

    // 文件類型分布（pdf / docx / xlsx / pptx / md / txt）
    const docTypeSeries = useMemo(
        () =>
            groupByKey(documents, (d) => d.file_type, {
                pdf: 'PDF',
                docx: 'Word',
                xlsx: 'Excel',
                pptx: 'PowerPoint',
                md: 'Markdown',
                txt: 'TXT',
            }),
        [documents],
    )

    // 文件處理狀態（pending / processing / completed / failed）—— 固定順序
    const docStatusSeries = useMemo(() => {
        const counts: Record<string, number> = {
            pending: 0,
            processing: 0,
            completed: 0,
            failed: 0,
        }
        for (const d of documents) {
            if (d.status in counts) counts[d.status]++
        }
        return [
            { key: 'completed', label: '已完成', count: counts.completed },
            { key: 'processing', label: '處理中', count: counts.processing },
            { key: 'pending', label: '等待中', count: counts.pending },
            { key: 'failed', label: '失敗', count: counts.failed },
        ]
    }, [documents])

    // 今日事件數 — 從 auditLogs（即近 7 天的 summary）篩出 created_at 在今天的
    const todayEventCount = useMemo(() => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const tomorrow = today.getTime() + 86400000
        return auditLogs.filter((log) => {
            const t = new Date(log.created_at).getTime()
            return t >= today.getTime() && t < tomorrow
        }).length
    }, [auditLogs])

    // 6 張 KPI 卡（4 個業務 stat + 2 個即時數）
    const metricCards = [
        {
            label: t('admin.overview.users'),
            value: stats.totalUsers,
            icon: Users,
        },
        {
            label: t('admin.overview.conversations'),
            value: stats.totalConversations,
            icon: MessageSquare,
        },
        {
            label: t('admin.overview.documents'),
            value: stats.totalDocuments,
            icon: Layers3,
        },
        {
            label: t('admin.overview.messages'),
            value: stats.totalMessages,
            icon: FileText,
        },
        {
            label: t('admin.overview.activeUsers', '活躍使用者'),
            value: activeUsers,
            icon: Activity,
        },
        {
            label: t('admin.overview.eventsToday', '今日事件'),
            value: todayEventCount,
            icon: ShieldCheck,
        },
    ]

    return (
        // 手機板：用自然高度逐區堆疊，外層 AdminPage 會處理垂直滾動。
        // 桌機板（lg+）：回到「滿視窗 dashboard」3-row 設計，圖表自動填滿剩餘空間。
        <div className="grid gap-2 lg:h-full lg:min-h-0 lg:grid-rows-[auto_minmax(0,1fr)_minmax(0,1fr)_auto]">
            {/* ─────────────────────────────────────────────────────────────
              Row 1 · KPI strip（6 張小卡，shrink-0）
              斷點降到 lg 是因為使用者實際 CSS 寬度大概在 1100px（高 DPR），
              用 xl (1280) 不會觸發 → 卡片全部 fallback 到 sm:3 column 太鬆
              ───────────────────────────────────────────────────────────── */}
            <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 stagger-fade-in">
                {metricCards.map((item) => {
                    const Icon = item.icon
                    return (
                        <Panel
                            key={item.label}
                            className="relative overflow-hidden p-2.5 hover:border-accent/40 lift-on-hover"
                        >
                            {/* 角落柔光斑點 */}
                            <div
                                aria-hidden
                                className="pointer-events-none absolute -right-5 -top-5 h-14 w-14 rounded-full bg-accent/10 blur-2xl"
                            />
                            <div className="relative flex items-center gap-2">
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-cv-sm bg-accent/10 text-accent">
                                    <Icon className="h-3.5 w-3.5" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[9px] font-medium uppercase tracking-[0.14em] text-text-muted">
                                        {item.label}
                                    </p>
                                    <p className="text-[18px] font-light leading-tight text-text-primary tabular-nums">
                                        {item.value.toLocaleString()}
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
            <section className="grid min-h-0 grid-cols-1 gap-2 lg:grid-cols-12">
                <Panel className="overflow-hidden flex flex-col min-h-[180px] lg:col-span-7 lg:min-h-0">
                    <SectionHeader
                        title={t('admin.overview.trendTitle', '近 7 天事件趨勢')}
                        eyebrow="Activity Trend"
                    />
                    <div className="flex-1 min-h-0 px-2 pb-1 pt-0.5 sm:px-3">
                        <ActivityBarChart data={dailySeries} height="100%" />
                    </div>
                </Panel>

                <Panel className="overflow-hidden flex flex-col min-h-[180px] lg:col-span-5 lg:min-h-0">
                    <SectionHeader
                        title={t('admin.overview.distributionTitle', '事件分布')}
                        eyebrow="Distribution"
                    />
                    {/*
                      grid-rows-[minmax(0,1fr)]：明確告訴 grid「這列的高度等於容器高度」，
                      不然 grid row 預設 auto 會跟 height:100% 的子元素互鎖變成 0。
                    */}
                    <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)_minmax(0,120px)] grid-rows-[minmax(0,1fr)] gap-2 p-2">
                        <div className="min-h-0 h-full">
                            <EventDonut data={actionSeries} height="100%" />
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
              Row 3 · 三個分布圖（使用者角色 / 文件類型 / 文件狀態）
              4/4/4 split @ lg+
              ───────────────────────────────────────────────────────────── */}
            <section className="grid min-h-0 grid-cols-1 gap-2 lg:grid-cols-12">
                <Panel className="overflow-hidden flex flex-col min-h-[160px] lg:col-span-4 lg:min-h-0">
                    <SectionHeader
                        title={t('admin.overview.rolesTitle', '使用者角色')}
                        eyebrow="User Roles"
                    />
                    <div className="flex-1 min-h-0 p-2.5">
                        <MiniDonut
                            data={roleSeries}
                            centerEyebrow="USERS"
                            emptyText={t('admin.users.noUsers')}
                        />
                    </div>
                </Panel>

                <Panel className="overflow-hidden flex flex-col min-h-[160px] lg:col-span-4 lg:min-h-0">
                    <SectionHeader
                        title={t('admin.overview.docTypesTitle', '文件類型')}
                        eyebrow="Document Types"
                    />
                    <div className="flex-1 min-h-0 p-2.5">
                        <MiniDonut
                            data={docTypeSeries}
                            centerEyebrow="FILES"
                            emptyText={t('documents.empty', '尚無文件')}
                        />
                    </div>
                </Panel>

                <Panel className="overflow-hidden flex flex-col min-h-[160px] lg:col-span-4 lg:min-h-0">
                    <SectionHeader
                        title={t('admin.overview.docStatusTitle', '處理狀態')}
                        eyebrow="Processing Status"
                    />
                    <div className="flex-1 min-h-0 p-3">
                        <StatusBar
                            data={docStatusSeries}
                            emptyText={t('documents.empty', '尚無文件')}
                        />
                    </div>
                </Panel>
            </section>

        </div>
    )
}
