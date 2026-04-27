/**
 * App 根組件 - 路由設定
 */

import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useUIStore } from './store/uiStore'
import { bootstrapAuth } from './lib/bootstrapAuth'
import { THEME_COLORS } from './constants/themeColors'

import { lazy, Suspense } from 'react'

// Lazy loaded Pages
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const Chat = lazy(() => import('./pages/Chat'))
const Documents = lazy(() => import('./pages/Documents'))
const Admin = lazy(() => import('./pages/Admin'))
const Share = lazy(() => import('./pages/Share'))
const NotFound = lazy(() => import('./pages/NotFound'))

// 僅在開發環境載入 Component Sandbox
const ComponentsTest = lazy(() => import('./pages/ComponentsTest'))

import { ConfirmModal } from './components/ui/ConfirmModal'
import SettingsModal from './components/ui/SettingsModal'
import { ToastContainer } from './components/ui/Toast'

// Protected Route Component
import ProtectedRoute from './components/auth/ProtectedRoute'

// Global UI Components
const FallbackLoader = () => (
    <div className="flex items-center justify-center h-[100dvh] w-full bg-bg-base">
        <div className="w-8 h-8 rounded-full border-2 border-corphia-bronze/20 border-t-accent animate-spin"></div>
    </div>
)

export default function App() {
    const { isAuthenticated, isBootstrapped } = useAuthStore()
    const { theme, setTheme, accentColor } = useUIStore()
    const location = useLocation()

    // ── 啟動時的 Token 復原流程 ──────────────────────────────────
    // 頁面重新整理後 accessToken 已從記憶體消失，
    // 這裡用 refreshToken 向後端換一張新的 accessToken
    useEffect(() => {
        if (!isBootstrapped) {
            bootstrapAuth()
        }
    }, [isBootstrapped])

    // 監聽系統主題變化（當使用者在 iPhone 設定切換深色/淺色模式時）
    // 同步 App 主題，確保 Safari 底部工具列與 App 保持一致
    // 注意：iOS Safari 底部工具列永遠跟隨系統主題，這是 Apple 的系統限制
    //       唯有讓 App 主題與系統主題一致，才能讓頂部與底部同色
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        const handleSystemThemeChange = (e: MediaQueryListEvent) => {
            setTheme(e.matches ? 'dark' : 'light')
        }
        mediaQuery.addEventListener('change', handleSystemThemeChange)
        return () => mediaQuery.removeEventListener('change', handleSystemThemeChange)
    }, [setTheme])

    // 主題與重點色同步：更新 html/body 背景色 + meta theme-color + data-accent
    // 確保 Safari 頂部狀態列與底部 Home bar 顏色與 App 主題一致
    useEffect(() => {
        const isDark = theme === 'dark'
        const bg = isDark ? THEME_COLORS.darkBg : THEME_COLORS.lightBg
        const csOnly = isDark ? 'only dark' : 'only light'
        const html = document.documentElement

        // 設定重點色
        html.setAttribute('data-accent', accentColor)

        // dark class 切換
        if (isDark) {
            html.classList.add('dark')
        } else {
            html.classList.remove('dark')
        }

        // html/body 背景色即時更新（不依賴 CSS transition）
        if (isDark) {
            html.style.background = THEME_COLORS.darkBgGradient
            document.body.style.background = 'transparent'
            // Safari 需要設定 background-attachment: fixed 才能讓漸層填滿整個 viewport 且不隨滾動延伸
            html.style.backgroundAttachment = 'fixed'
        } else {
            html.style.background = bg
            document.body.style.background = bg
            html.style.backgroundAttachment = 'fixed'
        }

        // color-scheme 更新（控制鍵盤、scrollbar 等原生 UI）
        html.style.colorScheme = csOnly

        // meta[theme-color] 更新（控制 Safari toolbar 顏色）
        // 先移除再新增才能強制 Safari 重新偵測
        const existingThemeColor = document.querySelector('meta[name="theme-color"]')
        if (existingThemeColor) existingThemeColor.remove()
        const metaThemeColor = document.createElement('meta')
        metaThemeColor.setAttribute('name', 'theme-color')
        metaThemeColor.setAttribute('content', bg)
        document.head.appendChild(metaThemeColor)

        // meta[color-scheme] 更新
        const existingColorScheme = document.querySelector('meta[name="color-scheme"]')
        if (existingColorScheme) existingColorScheme.remove()
        const metaColorScheme = document.createElement('meta')
        metaColorScheme.setAttribute('name', 'color-scheme')
        metaColorScheme.setAttribute('content', csOnly)
        document.head.appendChild(metaColorScheme)

    }, [theme, accentColor, location.pathname])

    // ── 等待 bootstrapAuth 完成才渲染路由，避免閃爍 ──────────────
    if (!isBootstrapped) {
        return <FallbackLoader />
    }

    return (
        <>
            {/* 頁面切換動畫：每當 location.pathname 改變時，新頁面會從下方淡入 */}
            <div
                key={location.pathname}
                className="page-transition"
            >
                <Suspense fallback={<FallbackLoader />}>
                    <Routes location={location}>
                        {/* 公開路由 */}
                        <Route
                            path="/login"
                            element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
                        />
                        <Route
                            path="/register"
                            element={isAuthenticated ? <Navigate to="/" replace /> : <Register />}
                        />
                        <Route
                            path="/share/:conversationId"
                            element={<Share />}
                        />
                        
                        {/* 元件測試沙盒 (僅開發環境可見) */}
                        {import.meta.env.DEV && (
                            <Route
                                path="/test-components"
                                element={<ComponentsTest />}
                            />
                        )}

                        {/* 受保護路由 */}
                        <Route
                            path="/"
                            element={
                                <ProtectedRoute>
                                    <Chat />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/chat"
                            element={
                                <ProtectedRoute>
                                    <Chat />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/chat/:conversationId"
                            element={
                                <ProtectedRoute>
                                    <Chat />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/documents"
                            element={
                                <ProtectedRoute>
                                    <Documents />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/admin"
                            element={
                                <ProtectedRoute>
                                    <Admin />
                                </ProtectedRoute>
                            }
                        />

                        {/* 404 */}
                        <Route path="*" element={<NotFound />} />
                    </Routes>
                </Suspense>
            </div>
            
            {/* 全域元件 */}
            <ConfirmModal />
            <SettingsModal />
            <ToastContainer />
        </>
    )
}

