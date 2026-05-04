/**
 * Admin > Tenants tab
 * -------------------
 * Card grid of tenants (organizations). Each card has name, slug, description,
 * status pill, and disable/enable + edit actions.
 */

import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Tenant } from '@/api/tenants'
import {
    Panel,
    SectionHeader,
    ActionButton,
    StatusPill,
} from '@/features/admin/components/AdminPrimitives'

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

    return (
        <Panel className="overflow-hidden">
            <SectionHeader
                title={t('admin.tenants.title')}
                eyebrow={`${activeTenants} active tenants`}
                action={
                    <ActionButton onClick={onAddTenant}>
                        <Plus className="h-4 w-4" />
                        {t('admin.tenants.addTenant')}
                    </ActionButton>
                }
            />
            <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
                {isLoadingTenants ? (
                    <div className="col-span-full py-10 text-center text-text-secondary">
                        {t('common.loading')}
                    </div>
                ) : tenants.length === 0 ? (
                    <div className="col-span-full py-10 text-center text-text-secondary">
                        {t('admin.tenants.noTenants')}
                    </div>
                ) : (
                    tenants.map((item) => (
                        <div
                            key={item.id}
                            className="rounded-[22px] border border-border-strong bg-bg-elevated/72 p-5"
                        >
                            <div className="mb-5 flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="truncate text-lg font-semibold text-text-primary">
                                        {item.name}
                                    </p>
                                    <p className="mt-1 inline-flex rounded-full border border-border-subtle bg-bg-surface px-3 py-1 font-mono text-xs text-text-secondary">
                                        {item.slug}
                                    </p>
                                </div>
                                <StatusPill active={item.is_active} />
                            </div>
                            <p className="min-h-[44px] text-sm leading-relaxed text-text-secondary">
                                {item.description || t('admin.tenants.noTenants')}
                            </p>
                            <div className="mt-6 flex justify-end gap-2">
                                <ActionButton
                                    variant="secondary"
                                    onClick={() => onToggleTenantStatus(item)}
                                >
                                    {item.is_active
                                        ? t('admin.tenants.actions.disable')
                                        : t('admin.tenants.actions.enable')}
                                </ActionButton>
                                <ActionButton onClick={() => onEditTenant(item)}>
                                    {t('admin.tenants.actions.edit')}
                                </ActionButton>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </Panel>
    )
}
