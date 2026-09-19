/** Mock Tenants API */
function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

export interface Tenant { id: string; name: string; slug: string; description?: string; settings?: Record<string, unknown>; is_active: boolean; created_at: string; updated_at: string }
export interface TenantCreate { name: string; slug: string; description?: string; is_active?: boolean }
export interface TenantUpdate { name?: string; slug?: string; description?: string; is_active?: boolean }
export interface TenantListResponse { data: Tenant[]; total: number; page: number; page_size: number; total_pages: number }

const DEMO_TENANTS: Tenant[] = [
    { id: 'tenant-001', name: 'Corp Demo', slug: 'corp-demo', description: '展示用租戶', is_active: true, created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z' },
]

export const tenantsApi = {
    listTenants: async (): Promise<TenantListResponse> => {
        await sleep(300)
        return { data: DEMO_TENANTS, total: 1, page: 1, page_size: 20, total_pages: 1 }
    },
    getTenant: async (id: string): Promise<Tenant> => {
        await sleep(200)
        return DEMO_TENANTS.find((t) => t.id === id) || DEMO_TENANTS[0]
    },
    createTenant: async (data: TenantCreate): Promise<Tenant> => {
        await sleep(400)
        return { id: `tenant-${Date.now()}`, ...data, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    },
    updateTenant: async (id: string, data: TenantUpdate): Promise<Tenant> => {
        await sleep(300)
        return { ...DEMO_TENANTS[0], ...data, id, updated_at: new Date().toISOString() }
    },
    deleteTenant: async (_id: string): Promise<void> => { await sleep(200) },
}
