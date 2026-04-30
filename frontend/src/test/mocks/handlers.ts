/**
 * MSW Mock API Handlers
 *
 * 攔截所有後端 API 請求，提供測試用的假回應。
 * 這讓前端元件測試可以在不啟動後端的情況下正常運作。
 *
 * 使用方式：
 *   server.use(http.post('/api/v1/auth/login', customHandler))
 *   來覆寫特定測試情境的 handler
 */

import { http, HttpResponse } from 'msw'

// ── 測試用假資料 ──────────────────────────────────────────────

const MOCK_USER = {
  id: 'test-user-001',
  email: 'test@corphia.com',
  name: 'Test User',
  role: 'user',
  is_active: true,
  tenant_id: 'test-tenant-001',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
}

const MOCK_TOKENS = {
  access_token: 'mock-access-token-for-testing',
  refresh_token: 'mock-refresh-token-for-testing',
  token_type: 'bearer',
  expires_in: 1800,
}

const MOCK_CONVERSATIONS = [
  {
    id: 'conv-001',
    title: '測試對話 A',
    user_id: 'test-user-001',
    tenant_id: 'test-tenant-001',
    is_pinned: false,
    is_archived: false,
    created_at: '2025-01-01T10:00:00Z',
    updated_at: '2025-01-01T10:00:00Z',
  },
  {
    id: 'conv-002',
    title: '測試對話 B',
    user_id: 'test-user-001',
    tenant_id: 'test-tenant-001',
    is_pinned: true,
    is_archived: false,
    created_at: '2025-01-02T10:00:00Z',
    updated_at: '2025-01-02T10:00:00Z',
  },
]

// ── API Handlers ──────────────────────────────────────────────

export const handlers = [
  http.get('/api/v1/health', () => {
    return HttpResponse.json({ status: 'ok' })
  }),

  // ── 認證 ──────────────────────────────────────────────────
  http.post('/api/v1/auth/login', async ({ request }) => {
    const body = await request.json() as { email: string; password: string }

    if (body.email === 'test@corphia.com' && body.password === 'TestPass123!') {
      return HttpResponse.json(MOCK_TOKENS)
    }

    return HttpResponse.json(
      { detail: '帳號或密碼錯誤' },
      { status: 401 }
    )
  }),

  http.post('/api/v1/auth/logout', () => {
    return HttpResponse.json({ message: '登出成功' })
  }),

  http.get('/api/v1/auth/me', ({ request }) => {
    const auth = request.headers.get('Authorization')
    if (!auth || !auth.startsWith('Bearer ')) {
      return HttpResponse.json({ detail: '未認證' }, { status: 401 })
    }
    return HttpResponse.json(MOCK_USER)
  }),

  http.post('/api/v1/auth/register', async ({ request }) => {
    const body = await request.json() as Record<string, string>
    return HttpResponse.json({
      ...MOCK_USER,
      email: body.email,
      name: body.name || 'New User',
    })
  }),

  http.post('/api/v1/auth/refresh', () => {
    return HttpResponse.json(MOCK_TOKENS)
  }),

  // ── 對話 ──────────────────────────────────────────────────
  http.get('/api/v1/conversations', () => {
    return HttpResponse.json({
      data: MOCK_CONVERSATIONS,
      total: MOCK_CONVERSATIONS.length,
    })
  }),

  http.post('/api/v1/conversations', async ({ request }) => {
    const body = await request.json() as { title?: string }
    return HttpResponse.json(
      {
        id: `conv-${Date.now()}`,
        title: body.title || '新對話',
        user_id: MOCK_USER.id,
        tenant_id: MOCK_USER.tenant_id,
        is_pinned: false,
        is_archived: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { status: 201 }
    )
  }),

  http.get('/api/v1/conversations/:id', ({ params }) => {
    const conv = MOCK_CONVERSATIONS.find((c) => c.id === params.id)
    if (!conv) {
      return HttpResponse.json({ detail: '對話不存在' }, { status: 404 })
    }
    return HttpResponse.json(conv)
  }),

  http.delete('/api/v1/conversations/:id', () => {
    return new HttpResponse(null, { status: 204 })
  }),

  http.get('/api/v1/conversations/:id/messages', () => {
    return HttpResponse.json([])
  }),

  // ── 文件 ──────────────────────────────────────────────────
  http.get('/api/v1/documents', () => {
    return HttpResponse.json({ data: [], total: 0 })
  }),

  http.post('/api/v1/documents/upload', () => {
    return HttpResponse.json({
      id: `doc-${Date.now()}`,
      filename: 'test.txt',
      status: 'pending',
      message: '文件已上傳，正在處理中',
    })
  }),

  // ── 管理員 ────────────────────────────────────────────────
  http.get('/api/v1/admin/stats', ({ request }) => {
    // 簡單模擬：任何有效 Bearer Token 都視為管理員
    const auth = request.headers.get('Authorization')
    if (!auth) {
      return HttpResponse.json({ detail: '未認證' }, { status: 403 })
    }
    return HttpResponse.json({
      status: 'success',
      data: {
        totalUsers: 5,
        totalConversations: 42,
        totalDocuments: 10,
        totalMessages: 200,
      },
    })
  }),
]
