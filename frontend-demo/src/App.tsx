/**
 * frontend-demo/src/App.tsx
 *
 * Demo 版的 App.tsx：
 * 1. 移除 BackendGate（不需要後端）
 * 2. 啟動時直接注入 mock 使用者（跳過 bootstrapAuth）
 * 3. 加入右下角「⟳ 重設展示」按鈕
 * 4. 其餘路由、主題、i18n 邏輯與原版完全相同
 */

import { useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { ACCENT_COLORS, THEME_COLORS } from '@/design-system'

// Pages（從 frontend/src 載入，alias 已設定）
const Login = lazy(() => import('@/pages/Login'))
const Register = lazy(() => import('@/pages/Register'))
const Chat = lazy(() => import('@/pages/Chat'))
const Documents = lazy(() => import('@/pages/Documents'))
const Admin = lazy(() => import('@/pages/Admin'))
const Share = lazy(() => import('@/pages/Share'))
const NotFound = lazy(() => import('@/pages/NotFound'))

// Global UI（從 frontend/src 載入）
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import SettingsModal from '@/components/ui/SettingsModal'
import { ToastContainer } from '@/components/ui/Toast'
import ProtectedRoute from '@/components/auth/ProtectedRoute'

// Demo 專屬元件
import DemoResetButton from './demo/DemoResetButton'
import { DEMO_USER } from './demo/mockData'

const FallbackLoader = () => (
    <div className="flex items-center justify-center h-[100dvh] w-full bg-bg-base">
        <div className="w-8 h-8 rounded-full border-2 border-corphia-bronze/20 border-t-accent animate-spin"></div>
    </div>
)

export default function App() {
    const { isAuthenticated, isBootstrapped, setAuth, setBootstrapped } = useAuthStore()
    const { theme, setTheme, accentColor, themePreference } = useUIStore()
    const location = useLocation()

    const isPublicRoute =
        location.pathname === '/login' ||
        location.pathname === '/register' ||
        location.pathname.startsWith('/share/')

    const canUseAuthenticatedRedirect = isBootstrapped && isAuthenticated

    // ── Demo：啟動時直接注入 mock 使用者，跳過所有後端認證 ──────────
    useEffect(() => {
        if (!isBootstrapped) {
            setAuth(
                DEMO_USER as any,
                'demo-access-token',
                'demo-refresh-token'
            )
            setBootstrapped(true)
        }
    }, [isBootstrapped, setAuth, setBootstrapped])

    // ── 系統主題監聽（與原版相同）──────────────────────────────────
    useEffect(() => {
        if (themePreference !== 'system') return
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        setTheme(mediaQuery.matches ? 'dark' : 'light')
        const handler = (e: MediaQueryListEvent) => setTheme(e.matches ? 'dark' : 'light')
        mediaQuery.addEventListener('change', handler)
        return () => mediaQuery.removeEventListener('change', handler)
    }, [setTheme, themePreference])

    // ── 主題 & 重點色同步（與原版相同）────────────────────────────
    useEffect(() => {
        const isDark = theme === 'dark'
        const baseBg = isDark ? THEME_COLORS.darkBg : THEME_COLORS.lightBg
        const topBarBg = baseBg
        const csOnly = isDark ? 'only dark' : 'only light'
        const html = document.documentElement

        const presetAccent = ACCENT_COLORS[accentColor]
        let [r, g, b] = (presetAccent || ACCENT_COLORS.default).rgb.split(' ').map(Number)
        if (accentColor.startsWith('#')) {
            const cleaned = accentColor.replace('#', '')
            if (cleaned.length === 6) {
                r = parseInt(cleaned.substring(0, 2), 16)
                g = parseInt(cleaned.substring(2, 4), 16)
                b = parseInt(cleaned.substring(4, 6), 16)
            }
        }
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
        const textOnAccent = luminance > 0.55 ? '#000000' : '#FFFFFF'
        const rgbString = `${r} ${g} ${b}`

        html.style.setProperty('--color-ios-accent-light', rgbString)
        html.style.setProperty('--color-ios-accent-dark', rgbString)
        html.style.setProperty('--text-on-accent', textOnAccent)

        const baseRgb = isDark ? [32, 32, 34] : [250, 250, 248]
        const mix = (ratio: number) => {
            const mr = Math.round(r * ratio + baseRgb[0] * (1 - ratio))
            const mg = Math.round(g * ratio + baseRgb[1] * (1 - ratio))
            const mb = Math.round(b * ratio + baseRgb[2] * (1 - ratio))
            return `${mr} ${mg} ${mb}`
        }
        html.style.setProperty('--border-subtle', mix(0.16))
        html.style.setProperty('--border-strong', mix(0.38))

        if (!accentColor.startsWith('#')) {
            html.setAttribute('data-accent', accentColor)
        } else {
            html.removeAttribute('data-accent')
        }

        if (isDark) {
            html.classList.add('dark')
        } else {
            html.classList.remove('dark')
        }

        if (isDark) {
            html.style.background = THEME_COLORS.darkBgGradient
            document.body.style.background = 'transparent'
        } else {
            html.style.background = baseBg
            document.body.style.background = baseBg
        }
        html.style.backgroundAttachment = 'fixed'
        html.style.colorScheme = csOnly

        const existingThemeColors = document.querySelectorAll('meta[name="theme-color"]')
        existingThemeColors.forEach((m) => m.remove())
        const metaThemeColor = document.createElement('meta')
        metaThemeColor.setAttribute('name', 'theme-color')
        metaThemeColor.setAttribute('content', topBarBg)
        document.head.appendChild(metaThemeColor)

        const existingColorScheme = document.querySelector('meta[name="color-scheme"]')
        if (existingColorScheme) existingColorScheme.remove()
        const metaColorScheme = document.createElement('meta')
        metaColorScheme.setAttribute('name', 'color-scheme')
        metaColorScheme.setAttribute('content', csOnly)
        document.head.appendChild(metaColorScheme)
    }, [theme, accentColor, location.pathname])

    // ── 等待 mock 使用者注入完成 ───────────────────────────────────
    if (!isBootstrapped && !isPublicRoute) {
        return <FallbackLoader />
    }

    return (
        <>
            {/* 頁面切換動畫 */}
            <div key={location.pathname} className="page-transition h-full overflow-hidden">
                <Suspense fallback={<FallbackLoader />}>
                    <Routes location={location}>
                        {/* 公開路由 */}
                        <Route
                            path="/login"
                            element={canUseAuthenticatedRedirect ? <Navigate to="/" replace /> : <Login />}
                        />
                        <Route
                            path="/register"
                            element={canUseAuthenticatedRedirect ? <Navigate to="/" replace /> : <Register />}
                        />
                        <Route path="/share/:conversationId" element={<Share />} />

                        {/* 受保護路由 */}
                        <Route path="/" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
                        <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
                        <Route path="/chat/:conversationId" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
                        <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
                        <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />

                        {/* 404 */}
                        <Route path="*" element={<NotFound />} />
                    </Routes>
                </Suspense>
            </div>

            {/* 全域元件 */}
            <ConfirmModal />
            <SettingsModal />
            <ToastContainer />

            {/* Demo 重設按鈕（固定右下角） */}
            <DemoResetButton />
        </>
    )
}
