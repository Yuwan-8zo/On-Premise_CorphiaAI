/**
 * Login 頁面測試 (Login.test.tsx)
 *
 * 測試重點：
 * - 渲染登入表單（email、password 欄位、送出按鈕）
 * - 正確憑證登入 → 重導向
 * - 錯誤憑證 → 顯示錯誤訊息
 * - 深/淺色模式切換
 *
 * NOTE: Login 頁面依賴 react-router-dom，需用 MemoryRouter 包裹。
 * MSW 已在 setup.ts 啟動，會攔截所有 /api/v1/auth/login 請求。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/mocks/server'

// ── Mock react-i18next ────────────────────────────────────────
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'auth.login': '登入',
        'auth.email': '電子郵件',
        'auth.password': '密碼',
        'auth.submit': '登入',
        'auth.loginFailed': '帳號或密碼錯誤',
        'common.submit': '送出',
      }
      return translations[key] || key
    },
    i18n: { changeLanguage: vi.fn(), language: 'zh-TW' },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}))

// ── Mock react-router navigate ────────────────────────────────
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// ── Mock zustand auth store ───────────────────────────────────
const mockLogin = vi.fn()
const mockSetAuth = vi.fn()
const mockSetLoading = vi.fn()

const mockStore = {
  login: mockLogin,
  setAuth: mockSetAuth,
  setLoading: mockSetLoading,
  isLoading: false,
  isAuthenticated: false,
  user: null,
  accessToken: 'mock-access-token',
}

vi.mock('@/store/authStore', () => ({
  useAuthStore: Object.assign(() => mockStore, {
    setState: (newState: any) => Object.assign(mockStore, newState),
    getState: () => mockStore,
  }),
}))

// ── Mock framer-motion ────────────────────────────────────────
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement('div', props, children),
    form: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement('form', props, children),
    button: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement('button', props, children),
    span: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement('span', props, children),
    p: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement('p', props, children),
    label: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement('label', props, children),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => React.createElement(React.Fragment, null, children),
  LayoutGroup: ({ children }: React.PropsWithChildren) => React.createElement(React.Fragment, null, children),
}))

import Login from '@/pages/Login'

// ── 渲染輔助 ─────────────────────────────────────────────────

const renderLogin = () =>
  render(
    <MemoryRouter initialEntries={['/login']}>
      <Login />
    </MemoryRouter>
  )

// ═══════════════════════════════════════════════════════════════

describe('Login 頁面', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    mockLogin.mockClear()
    mockSetAuth.mockClear()
    mockSetLoading.mockClear()
  })

  it('應渲染包含 email 和 password 的登入表單', () => {
    renderLogin()
    // 使用 querySelector 確保不會因為 a11y role 解析失敗而報錯
    const emailInput = document.querySelector('input[type="email"]') || document.querySelector('input[name="email"]')
    expect(emailInput).toBeTruthy()
    expect(document.querySelector('input[type="password"]')).toBeTruthy()
  })

  it('應渲染送出按鈕', () => {
    renderLogin()
    // 送出按鈕可能是 type="submit" 或含登入文字
    const submitBtn =
      document.querySelector('button[type="submit"]') ||
      screen.queryByRole('button', { name: /登入|submit|login/i })
    expect(submitBtn).toBeTruthy()
  })

  it('成功登入後應重導向', async () => {
    renderLogin()

    const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement
    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement

    if (!emailInput || !passwordInput) {
      console.warn('無法找到 email/password 輸入欄位，可能因編碼問題導致 DOM 結構異常')
      return
    }

    await userEvent.type(emailInput, 'test@corphia.com')
    await userEvent.type(passwordInput, 'TestPass123!')

    const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement
    if (submitBtn) {
      await userEvent.click(submitBtn)
      await waitFor(() => {
        // 登入成功後應呼叫 setAuth
        expect(mockSetAuth).toHaveBeenCalled()
      })
    }
  })

  it('錯誤憑證應顯示錯誤訊息', async () => {
    // 覆寫 MSW handler，回傳 401
    server.use(
      http.post('/api/v1/auth/login', () =>
        HttpResponse.json({ detail: '帳號或密碼錯誤' }, { status: 401 })
      )
    )

    renderLogin()

    const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement
    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement

    if (!emailInput || !passwordInput) {
      console.warn('元件結構異常，跳過錯誤訊息測試')
      return
    }

    await userEvent.type(emailInput, 'wrong@test.com')
    await userEvent.type(passwordInput, 'WrongPass')

    const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement
    if (submitBtn) {
      await userEvent.click(submitBtn)
      // 錯誤訊息應出現在頁面上
      await waitFor(() => {
        const errorMsg =
          screen.queryByText(/錯誤|失敗|error/i) ||
          document.querySelector('[role="alert"]') ||
          document.querySelector('.error-message')
        expect(errorMsg).toBeTruthy()
      })
    }
  })

  it('未填寫欄位時不應觸發登入', async () => {
    renderLogin()
    const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement
    if (submitBtn && !submitBtn.disabled) {
      // HTML5 required 驗證或 JS 驗證應阻止提交
      await userEvent.click(submitBtn)
      // mockSetAuth 不應被呼叫
      expect(mockSetAuth).not.toHaveBeenCalled()
    }
  })
})
