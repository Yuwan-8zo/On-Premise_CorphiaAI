/**
 * 後台的新增／編輯彈窗：使用者、租戶
 */
import { useTranslation } from 'react-i18next'
import StyledSelect from '@/components/ui/StyledSelect'
import { ActionButton, Field, ModalFrame, inputClass } from './AdminPrimitives'
import type { useAdminUsers } from '../hooks/useAdminUsers'
import type { useAdminTenants } from '../hooks/useAdminTenants'
import { useAuthStore } from '@/store/authStore'

/** 「啟用」勾選列 */
function ActiveToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
    const { t } = useTranslation()
    return (
        <label className="flex items-center justify-between rounded-[var(--r-16)] snow-field px-4 py-3 text-sm text-text-primary">
            {t('admin.tenants.status.active')}
            <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        </label>
    )
}

export function UserFormModal({ users }: { users: ReturnType<typeof useAdminUsers> }) {
    const { t } = useTranslation()
    const { editing, form, setForm, isSubmitting, submit, setIsModalOpen } = users
    const me = useAuthStore((s) => s.user)
    if (!users.isModalOpen) return null
    // 只有 engineer 能指定 engineer；自己的角色不能改（後端也會擋）
    const editingSelf = !!editing && editing.id === me?.id
    const roleOptions = [
        { value: 'user', label: 'User' },
        ...(me?.role === 'engineer' ? [{ value: 'engineer', label: 'Engineer' }] : []),
        { value: 'admin', label: 'Admin' },
    ]
    const set = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }))
    const close = () => setIsModalOpen(false)

    return (
        <ModalFrame onClose={close}>
            <h3 className="mb-6 text-xl font-semibold">{editing ? t('admin.users.editTitle', '編輯使用者') : t('admin.users.addUser', '新增使用者')}</h3>
            <form onSubmit={submit} className="space-y-4">
                <Field label="Name"><input className={inputClass} required value={form.name} onChange={(e) => set({ name: e.target.value })} /></Field>
                <Field label="Email"><input className={inputClass} type="email" required disabled={!!editing} value={form.email} onChange={(e) => set({ email: e.target.value })} /></Field>
                <Field label={editing ? 'New password' : 'Password'}><input className={inputClass} type="password" required={!editing} minLength={8} value={form.password} onChange={(e) => set({ password: e.target.value })} /></Field>
                <Field label="Role">
                    <StyledSelect
                        value={form.role}
                        onChange={(value) => set({ role: value })}
                        disabled={editingSelf}
                        options={roleOptions}
                    />
                </Field>
                <ActiveToggle checked={form.is_active} onChange={(v) => set({ is_active: v })} />
                <div className="flex gap-3 pt-4">
                    <ActionButton variant="secondary" onClick={close}>{t('common.cancel')}</ActionButton>
                    <ActionButton disabled={isSubmitting}>{isSubmitting ? t('common.loading') : t('common.save')}</ActionButton>
                </div>
            </form>
        </ModalFrame>
    )
}

export function TenantFormModal({ tenants }: { tenants: ReturnType<typeof useAdminTenants> }) {
    const { t } = useTranslation()
    const { editing, form, setForm, isSubmitting, submit, setIsModalOpen } = tenants
    const isEngineer = useAuthStore((s) => s.user?.role === 'engineer')
    if (!tenants.isModalOpen) return null
    const set = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }))
    const close = () => setIsModalOpen(false)

    return (
        <ModalFrame onClose={close}>
            <h3 className="mb-6 text-xl font-semibold">{editing ? t('admin.tenants.modal.editTitle') : t('admin.tenants.modal.addTitle')}</h3>
            <form onSubmit={submit} className="space-y-4">
                <Field label={t('admin.tenants.modal.name')}><input className={inputClass} required value={form.name} onChange={(e) => set({ name: e.target.value })} /></Field>
                <Field label="Slug"><input className={inputClass} required value={form.slug} onChange={(e) => set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} /></Field>
                <Field label={t('admin.tenants.modal.description')}><textarea className={inputClass} rows={3} value={form.description} onChange={(e) => set({ description: e.target.value })} /></Field>
                {/* 停用／啟用租戶只有 engineer 能改 */}
                {isEngineer && <ActiveToggle checked={form.is_active} onChange={(v) => set({ is_active: v })} />}
                <div className="flex gap-3 pt-4">
                    <ActionButton variant="secondary" onClick={close}>{t('admin.tenants.modal.cancel')}</ActionButton>
                    <ActionButton disabled={isSubmitting}>{isSubmitting ? t('common.loading') : t('admin.tenants.modal.submit')}</ActionButton>
                </div>
            </form>
        </ModalFrame>
    )
}
