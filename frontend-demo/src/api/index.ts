/**
 * Demo API Index — 匯出所有 mock API
 * 取代 frontend/src/api/index.ts
 */

export { authApi } from './auth'
export { conversationsApi } from './conversations'
export { documentsApi } from './documents'
export { foldersApi } from './folders'
export { tenantsApi } from './tenants'
export { usersApi } from './users'
export { adminApi } from './admin'
export type { TenantUsageStats, UserLockoutStatus, ModelIntegrityInfo } from './admin'
export { systemApi } from './system'
export type { RuntimeInfo } from './system'
export { default as modelsApi, getModels, selectModel, refreshModels } from './models'
export { getAuditLogs, exportAuditLogsCSV, exportAuditLogsJSON, ACTION_LABELS, RESOURCE_LABELS } from './auditLogs'
export { ChatWebSocket, createChatWebSocket } from './websocket'
export type { StreamResponse, WebSocketMessage } from './websocket.types'
export { healthApi, fetchHealth, isLlmReady, isApiReady } from './health'

// client stub（防止元件直接 import apiClient 時報錯）
export const apiClient = {
    get: () => Promise.resolve({ data: {} }),
    post: () => Promise.resolve({ data: {} }),
    put: () => Promise.resolve({ data: {} }),
    patch: () => Promise.resolve({ data: {} }),
    delete: () => Promise.resolve({ data: {} }),
    interceptors: {
        request: { use: () => 0, eject: () => {} },
        response: { use: () => 0, eject: () => {} },
    },
    defaults: { headers: { common: {} } },
}
