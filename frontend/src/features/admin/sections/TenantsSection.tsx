/**
 * Admin > Tenants tab（重寫版本）
 * -------------------
 * 改成 Glance 樣式卡片，顯示使用量摘要：
 * - 使用者 / 文件 / 24h 訊息 / 24h 資安事件
 * - 30s 輪詢更新
 */

import { Plus, AlertTriangle } from '@/components/snow/icons'
import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import type { Tenant } from '@/api/tenants'
import {
    Panel,
    SectionHeader,
    ActionButton,
    StatusPill,
} from '@/features/admin/components/AdminPrimitives'
import { adminApi, type TenantUsageStats } from '@/api/admin'
import { usePolling } from '@/features/admin/hooks/usePolling'
import { SkelCards } from '@/components/ui/Skeleton'
import { useAuthStore } from '@/store/authStore'

export interface TenantsSectionProps {
    tenants: Tenant[]
    activeTenants: number
    isLoadingTenants: boolean
    onAddTenant: () => void
    onEditTenant: (tenant: Tenant) => void
    onToggleTenantStatus: (tenant: Tenant) => void
}

export default function TenantsSection({
    tenants,
    activeTenants,
    isLoadingTenants,
    onAddTenant,
    onEditTenant,
    onToggleTenantStatus,
}: TenantsSectionProps) {
    const { t } = useTranslation()
    // 新增、停用／啟用租戶是系統層級的操作，只有 engineer 看得到（後端也會擋）
    const isEngineer = useAuthStore((s) => s.user?.role === 'engineer')
    const [usageMap, setUsageMap] = useState<Record<string, TenantUsageStats>>({})

    // 每 30s 輪詢一次使用量
    const { data: usageData } = usePolling(adminApi.getTenantsUsage, 30000)

    useEffect(() => {
        if (usageData) {
            const map: Record<string, TenantUsageStats> = {}
            usageData.forEach((item) => {
                map[item.id] = item
            })
            setUsageMap(map)
        }
    }, [usageData])

    function getUsage(tenantId: string): TenantUsageStats | undefined {
        return usageMap[tenantId]
    }

    return (
        <Panel className="admin-fill">
            <SectionHeader
                title={t('admin.tenants.title', '租戶')}
                eyebrow={t('admin.tenants.activeTenants', { count: activeTenants })}
                action={isEngineer ? (
                    <ActionButton onClick={onAddTenant}>
                        <Plus className="h-4 w-4" />
                        {t('admin.tenants.addTenant', '新增')}
                    </ActionButton>
                ) : undefined}
            />
            {/* 租戶卡片：把這一區分成「田」字四格，每張卡片佔 1/4（半寬、半高）；超過四個往下排、每列一樣半高；手機一欄 */}
            <div className="admin-fill-body tenant-quads grid content-start gap-[var(--space)] px-[var(--space)] pb-[var(--space)]">
                {isLoadingTenants ? (
                    <SkelCards count={4} className="h-[var(--sz-180)]" />
                ) : tenants.length === 0 ? (
                    <div className="col-span-full py-10 text-center text-text-secondary">
                        {t('admin.tenants.noTenants', '暫無租戶')}
                    </div>
                ) : (
                    tenants.map((item) => {
                        const usage = getUsage(item.id)
                        const hasSecurityEvents = (usage?.security_events_24h || 0) > 0

                        return (
                            <div
                                key={item.id}
                                className="snow-well rounded-[var(--admin-in)] p-5 flex flex-col"
                            >
                                {/* Header */}
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="truncate text-lg font-semibold text-text-primary">
                                                {item.name}
                                            </p>
                                            <StatusPill active={item.is_active} />
                                        </div>
                                    </div>
                                    {hasSecurityEvents && (
                                        <div className="shrink-0 text-[var(--ink-red)]" title={t('admin.overview.securityEvents')} aria-label={t('admin.overview.securityEvents')} role="img">
                                            <AlertTriangle className="h-4 w-4" />
                                        </div>
                                    )}
                                </div>

                                {/* Description（如果有） */}
                                {item.description && (
                                    <p className="text-xs text-text-secondary truncate mb-3">
                                        {item.description}
                                    </p>
                                )}

                                {/* Separator */}
                                <div className="border-t border-[var(--paper-line)] my-3" />

                                {/* 用量：四個數字排成一列（卡片窄時自動換成兩列），省下高度，按鈕才收得進四分之一大小的卡片 */}
                                <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(var(--stat-min),1fr))] gap-3">
                                    <div>
                                        <p className="text-xs text-text-secondary font-medium">
                                            {t('admin.tenants.users', '使用者')}
                                        </p>
                                        <p className="mt-1 text-xl font-bold tabular-nums text-text-primary">
                                            {usage?.users_count ?? '--'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-text-secondary font-medium">
                                            {t('admin.tenants.documents', '文件')}
                                        </p>
                                        <p className="mt-1 text-xl font-bold tabular-nums text-text-primary">
                                            {usage?.documents_count ?? '--'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-text-secondary font-medium">
                                            {t('admin.tenants.messages24h', '24h 訊息')}
                                        </p>
                                        <p className="mt-1 text-xl font-bold tabular-nums text-text-primary">
                                            {usage?.messages_24h ?? '--'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-text-secondary font-medium">
                                            {t('admin.tenants.events24h', '24h 事件')}
                                        </p>
                                        <p className={`mt-1 text-xl font-bold tabular-nums ${hasSecurityEvents ? 'text-[var(--ink-red)]' : 'text-text-primary'}`}>
                                            {usage?.security_events_24h ?? '--'}
                                        </p>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="mt-auto flex justify-end gap-2">
                                    {isEngineer && item.id !== 'default' && (
                                        <ActionButton
                                            variant="secondary"
                                            onClick={() => onToggleTenantStatus(item)}
                                        >
                                            {item.is_active
                                                ? t('admin.tenants.disable', '停用')
                                                : t('admin.tenants.enable', '啟用')}
                                        </ActionButton>
                                    )}
                                    <ActionButton onClick={() => onEditTenant(item)}>
                                        {t('admin.tenants.edit', '編輯')}
                                    </ActionButton>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </Panel>
    )
}
