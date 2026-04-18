import apiClient from './client';

export interface Tenant {
    id: string;
    name: string;
    slug: string;
    description?: string;
    settings?: Record<string, unknown>;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface TenantCreate {
    name: string;
    slug: string;
    description?: string;
    settings?: Record<string, unknown>;
    is_active?: boolean;
}

export interface TenantUpdate {
    name?: string;
    slug?: string;
    description?: string;
    settings?: Record<string, unknown>;
    is_active?: boolean;
}

export interface TenantListResponse {
    data: Tenant[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

export const tenantsApi = {
    /**
     * 列出所有租戶
     */
    listTenants: async (params?: { page?: number; page_size?: number; search?: string; is_active?: boolean }): Promise<TenantListResponse> => {
        const response = await apiClient.get('/tenants', { params });
        return response.data;
    },

    /**
     * 取得指定租戶資訊
     */
    getTenant: async (tenantId: string): Promise<Tenant> => {
        const response = await apiClient.get(`/tenants/${tenantId}`);
        return response.data;
    },

    /**
     * 新增租戶
     */
    createTenant: async (data: TenantCreate): Promise<Tenant> => {
        const response = await apiClient.post('/tenants', data);
        return response.data;
    },

    /**
     * 更新租戶資訊
     */
    updateTenant: async (tenantId: string, data: TenantUpdate): Promise<Tenant> => {
        const response = await apiClient.put(`/tenants/${tenantId}`, data);
        return response.data;
    },

    /**
     * 刪除租戶 (軟刪除)
     */
    deleteTenant: async (tenantId: string): Promise<void> => {
        await apiClient.delete(`/tenants/${tenantId}`);
    },

    /**
     * 啟用租戶
     */
    activateTenant: async (tenantId: string): Promise<void> => {
        await apiClient.post(`/tenants/${tenantId}/activate`);
    }
};
