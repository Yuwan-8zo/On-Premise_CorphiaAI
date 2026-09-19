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
export { systemApi } from './system'
export { default as modelsApi } from './models'
export { getModels, selectModel, refreshModels } from './models'
export { getAuditLogs, exportAuditLogsCSV, exportAuditLogsJSON } from './auditLogs'
export { ChatWebSocket, createChatWebSocket } from './websocket'
export type { StreamResponse, WebSocketMessage } from './websocket.types'

// client 是 mock，不需要 axios 實例
export const apiClient = {
    get: () => Promise.resolve({ data: {} }),
    post: () => Promise.resolve({ data: {} }),
    put: () => Promise.resolve({ data: {} }),
    delete: () => Promise.resolve({ data: {} }),
}
