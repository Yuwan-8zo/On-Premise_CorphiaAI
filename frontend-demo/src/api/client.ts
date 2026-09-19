/**
 * Mock API Client — Demo 版
 * 取代 axios client，永遠不真正發送 HTTP 請求。
 */

const mockClient = {
    get: (_url: string, _config?: unknown) => Promise.resolve({ data: {}, status: 200 }),
    post: (_url: string, _data?: unknown, _config?: unknown) => Promise.resolve({ data: {}, status: 200 }),
    put: (_url: string, _data?: unknown, _config?: unknown) => Promise.resolve({ data: {}, status: 200 }),
    patch: (_url: string, _data?: unknown, _config?: unknown) => Promise.resolve({ data: {}, status: 200 }),
    delete: (_url: string, _config?: unknown) => Promise.resolve({ data: {}, status: 200 }),
    interceptors: {
        request: { use: () => 0, eject: () => {} },
        response: { use: () => 0, eject: () => {} },
    },
    defaults: { headers: { common: {} } },
}

export default mockClient
export const apiClient = mockClient
