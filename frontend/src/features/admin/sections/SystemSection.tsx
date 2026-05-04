/**
 * Admin > System tab — 單視窗緊湊版
 * ----------------------------------
 * 排版：
 *   Row 1 (auto)      — 6 張版本資訊小卡（單列橫排，跟 Overview KPI 同尺寸風格）
 *   Row 2 (auto)      — 維護動作按鈕（3 顆橫排）
 *   Row 3 (1fr,minh0) — 即時系統健康監控面板（CPU / GPU / VRAM / LLM）
 *
 * 跟 Overview 一致的設計語言：accent / corphia-bronze、`p-2.5` 卡片、
 * `text-[18px]` 數字級、`h-7 w-7` 圖示徽章。
 */

import {
    Activity,
    CircleAlert,
    Cpu,
    Database,
    HardDrive,
    Layers3,
    RefreshCw,
    ShieldCheck,
    SlidersHorizontal,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import SystemMonitorPanel from '@/components/system/SystemMonitorPanel'
import {
    Panel,
    SectionHeader,
    ActionButton,
} from '@/features/admin/components/AdminPrimitives'

export interface SystemSectionProps {
    /** Currently selected LLM model name (used to fill the LLM Engine card) */
    currentModelName?: string
}

export default function SystemSection({ currentModelName }: SystemSectionProps) {
    const { t } = useTranslation()

    const infoCards: Array<[string, string, React.ComponentType<{ className?: string }>]> = [
        ['Version', '2.3.0', ShieldCheck],
        ['Backend', 'FastAPI', Database],
        ['LLM Engine', currentModelName || t('admin.standby', 'Standby'), Cpu],
        ['Vector Store', 'pgvector', Layers3],
        ['Database', 'PostgreSQL', HardDrive],
        ['Runtime', 'Python 3.12', Activity],
    ]

    return (
        <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-2">
            {/* ─────────────────────────────────────────────────────────────
              Row 1 · Info cards（6 張單列橫排，sm 退 3 欄、md 退 4 欄）
              ───────────────────────────────────────────────────────────── */}
            <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {infoCards.map(([label, value, Icon]) => (
                    <Panel
                        key={label}
                        className="relative overflow-hidden p-2.5 hover:border-accent/40 lift-on-hover"
                    >
                        {/* 角落柔光斑點 — 與 Overview KPI 一致 */}
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
                                    {label}
                                </p>
                                <p className="truncate text-[15px] font-semibold leading-tight text-text-primary">
                                    {value}
                                </p>
                            </div>
                        </div>
                    </Panel>
                ))}
            </section>

            {/* ─────────────────────────────────────────────────────────────
              Row 2 · Maintenance actions（3 顆按鈕橫排，內嵌成單列 Panel）
              ───────────────────────────────────────────────────────────── */}
            <Panel className="overflow-hidden">
                <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                    <div className="flex flex-col">
                        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted">
                            {t('admin.system.maintenanceSub', 'Maintenance')}
                        </p>
                        <p className="text-xs font-semibold text-text-primary">
                            {t('admin.system.maintenance', '維護')}
                        </p>
                    </div>
                    <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
                        <ActionButton variant="secondary">
                            <RefreshCw className="h-4 w-4" />
                            {t('admin.system.clearCache')}
                        </ActionButton>
                        <ActionButton variant="secondary">
                            <SlidersHorizontal className="h-4 w-4" />
                            {t('admin.system.reindexVector')}
                        </ActionButton>
                        <ActionButton variant="danger">
                            <CircleAlert className="h-4 w-4" />
                            {t('admin.system.restartService')}
                        </ActionButton>
                    </div>
                </div>
            </Panel>

            {/* ─────────────────────────────────────────────────────────────
              Row 3 · Real-time health panel（1fr，內部 monitor 自己處理 overflow）
              ───────────────────────────────────────────────────────────── */}
            <Panel className="overflow-hidden flex flex-col min-h-[200px]">
                <SectionHeader
                    title={t('admin.system.realTimeHealth')}
                    eyebrow={t('admin.system.realTimeHealthSub')}
                />
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3">
                    <SystemMonitorPanel />
                </div>
            </Panel>
        </div>
    )
}
