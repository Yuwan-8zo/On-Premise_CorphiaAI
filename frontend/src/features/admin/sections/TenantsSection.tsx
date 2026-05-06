/**
 * Admin > Tenants tab（重寫版本）
 * -------------------
 * 改成 Glance 樣式卡片，顯示使用量摘要：
 * - 使用者 / 文件 / 24h 訊息 / 24h 資安事件
 * - 30s 輪詢更新
 */

import { Plus, AlertTriangle } from 'lucide-react'
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
        <Panel className="overflow-hidden">
            <SectionHeader
                title={t('admin.tenants.title', '租戶')}
                eyebrow={t('admin.tenants.activeTenants', { count: activeTenants })}
                action={
                    <ActionButton onClick={onAddTenant}>
                        <Plus className="h-4 w-4" />
                        {t('admin.tenants.addTenant', '新增')}
                    </ActionButton>
                }
            />
            <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
                {isLoadingTenants ? (
                    <div className="col-span-full py-10 text-center text-text-secondary">
                        {t('common.loading', '載入中')}
                    </div>
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
                                className="rounded-[22px] border border-border-strong bg-bg-elevated/72 p-5 flex flex-col"
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
                                        <div className="shrink-0 text-red-500">
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
                                <div className="border-t border-border-subtle my-3" />

                                {/* Usage stats — Glance 風格 */}
                                <div className="mb-4 grid grid-cols-2 gap-3">
                                    <div>
                                        <p className="text-xs text-text-muted uppercase tracking-wider font-medium">
                                            {t('admin.tenants.users', '使用者')}
                                        </p>
                                        <p className="mt-1 text-xl font-bold tabular-nums text-text-primary">
                                            {usage?.users_count ?? '--'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-text-muted uppercase tracking-wider font-medium">
                                            {t('admin.tenants.documents', '文件')}
                                        </p>
                                        <p className="mt-1 text-xl font-bold tabular-nums text-text-primary">
                                            {usage?.documents_count ?? '--'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-text-muted uppercase tracking-wider font-medium">
                                            {t('admin.tenants.messages24h', '24h 訊息')}
                                        </p>
                                        <p className="mt-1 text-xl font-bold tabular-nums text-text-primary">
                                            {usage?.messages_24h ?? '--'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-text-muted uppercase tracking-wider font-medium">
                                            {t('admin.tenants.events24h', '24h 事件')}
                                        </p>
                                        <p className={`mt-1 text-xl font-bold tabular-nums ${hasSecurityEvents ? 'text-red-500' : 'text-text-primary'}`}>
                                            {usage?.security_events_24h ?? '--'}
                                        </p>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="mt-auto flex justify-end gap-2">
                                    <ActionButton
                                        variant="secondary"
                                        onClick={() => onToggleTenantStatus(item)}
                                    >
                                        {item.is_active
                                            ? t('admin.tenants.disable', '停用')
                                            : t('admin.tenants.enable', '啟用')}
                                    </ActionButton>
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
