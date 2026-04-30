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
    const { theme, setTheme, accentColor, themePreference } = useUIStore()
    const location = useLocation()
    const isPublicRoute =
        location.pathname === '/login' ||
        location.pathname === '/register' ||
        location.pathname.startsWith('/share/')
    const canUseAuthenticatedRedirect = isBootstrapped && isAuthenticated

    // ── 啟動時的 Token 復原流程 ──────────────────────────────────
    // 頁面重新整理後 accessToken 已從記憶體消失，
    // 這裡用 refreshToken 向後端換一張新的 accessToken
    useEffect(() => {
        if (!isBootstrapped) {
            bootstrapAuth()
        }
    }, [isBootstrapped])

    // 監聽系統主題變化（當使用者在 iPhone 設定切換深色/淺色模式時）
    // 只有當使用者偏好是「跟隨系統」時，才把 App 主題自動同步
    // 若使用者已明確選擇 light/dark，則尊重該選擇，不被系統覆蓋
    // 注意：iOS Safari 底部工具列永遠跟隨系統主題，這是 Apple 的系統限制
    useEffect(() => {
        if (themePreference !== 'system') return
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        // 進入 system 模式時，先把目前的系統值寫一次
        setTheme(mediaQuery.matches ? 'dark' : 'light')
        const handleSystemThemeChange = (e: MediaQueryListEvent) => {
            setTheme(e.matches ? 'dark' : 'light')
        }
        mediaQuery.addEventListener('change', handleSystemThemeChange)
        return () => mediaQuery.removeEventListener('change', handleSystemThemeChange)
    }, [setTheme, themePreference])

    // 主題與重點色同步：更新 html/body 背景色 + meta theme-color + data-accent
    // 確保 Safari 頂部狀態列與底部 Home bar 顏色與 App 主題一致
    // route-aware：'/' 或 '/chat*' 路徑用 surface 色（跟 sidebar 對齊），其他用 base 色
    useEffect(() => {
        const isDark = theme === 'dark'
        const path = location.pathname
        const isChatPath = path === '/' || path.startsWith('/chat')
        const baseBg = isDark ? THEME_COLORS.darkBg : THEME_COLORS.lightBg
        const surfaceBg = isDark ? THEME_COLORS.darkSurface : THEME_COLORS.lightSurface
        // meta[theme-color] 用：使用者實際看到的最頂端那條顏色
        // chat 頁的 sidebar 是 surface 色，登入頁直接是 base 漸層的最上方
        const topBarBg = isChatPath ? surfaceBg : baseBg
        const csOnly = isDark ? 'only dark' : 'only light'
        const html = document.documentElement

        // 解析 accentColor (Hex -> RGB) 並計算對比色
        let r = 137, g = 110, b = 83 // default Corphia Bronze
        if (accentColor.startsWith('#')) {
            const cleaned = accentColor.replace('#', '')
            if (cleaned.length === 6) {
                r = parseInt(cleaned.substring(0, 2), 16)
                g = parseInt(cleaned.substring(2, 4), 16)
                b = parseInt(cleaned.substring(4, 6), 16)
            }
        }
        
        // 亮度公式 (Luminance) 來決定文字該用深色或淺色
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
        const textOnAccent = luminance > 0.55 ? '#000000' : '#FFFFFF'
        const rgbString = `${r} ${g} ${b}`

        // 動態注入 CSS 變數
        html.style.setProperty('--color-ios-accent-light', rgbString)
        html.style.setProperty('--color-ios-accent-dark', rgbString)
        html.style.setProperty('--text-on-accent', textOnAccent)
        
        // 保留 data-accent 給一些可能的舊邏輯（如果有的話）
        if (!accentColor.startsWith('#')) {
            html.setAttribute('data-accent', accentColor)
        } else {
            html.removeAttribute('data-accent')
        }

        // dark class 切換
        if (isDark) {
            html.classList.add('dark')
        } else {
            html.classList.remove('dark')
        }

        // html/body 背景色即時更新（不依賴 CSS transition）
        // 深色用整片漸層（從 darkBg 漸到 #101012），淺色用單一 baseBg
        if (isDark) {
            html.style.background = THEME_COLORS.darkBgGradient
            document.body.style.background = 'transparent'
        } else {
            html.style.background = baseBg
            document.body.style.background = baseBg
        }
        // Safari 需要 background-attachment: fixed 漸層才會固定不隨滾動拉長
        html.style.backgroundAttachment = 'fixed'

        // color-scheme 更新（控制鍵盤、scrollbar 等原生 UI）
        html.style.colorScheme = csOnly

        // meta[theme-color] 更新（控制 Safari toolbar 顏色）
        // 先把所有 theme-color 移掉再新增單一動態值，強制 Safari 重新偵測
        // 用 topBarBg 而非 bg —— chat 頁面要對齊 sidebar 的 surface 色，不是 base
        const existingThemeColors = document.querySelectorAll('meta[name="theme-color"]')
        existingThemeColors.forEach((m) => m.remove())
        const metaThemeColor = document.createElement('meta')
        metaThemeColor.setAttribute('name', 'theme-color')
        metaThemeColor.setAttribute('content', topBarBg)
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
    if (!isBootstrapped && !isPublicRoute) {
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
                            element={canUseAuthenticatedRedirect ? <Navigate to="/" replace /> : <Login />}
                        />
                        <Route
                            path="/register"
                            element={canUseAuthenticatedRedirect ? <Navigate to="/" replace /> : <Register />}
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

