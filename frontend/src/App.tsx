/**
 * App 根組件 - 路由設定
 */

import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useUIStore } from './store/uiStore'

import { lazy, Suspense } from 'react'

// Lazy loaded Pages
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const Chat = lazy(() => import('./pages/Chat'))
const Documents = lazy(() => import('./pages/Documents'))
const Admin = lazy(() => import('./pages/Admin'))
const Share = lazy(() => import('./pages/Share'))
const NotFound = lazy(() => import('./pages/NotFound'))

import { ConfirmModal } from './components/ui/ConfirmModal'
import SettingsModal from './components/ui/SettingsModal'
import { ToastContainer } from './components/ui/Toast'

// Protected Route Component
import ProtectedRoute from './components/auth/ProtectedRoute'

// Global UI Components
const FallbackLoader = () => (
    <div className="flex items-center justify-center h-[100dvh] w-full bg-ios-light-gray6 dark:bg-ios-dark-gray6">
        <div className="w-8 h-8 rounded-full border-2 border-ios-blue-light/20 dark:border-ios-blue-dark/20 border-t-ios-blue-light dark:border-t-ios-blue-dark animate-spin"></div>
    </div>
)

export default function App() {
    const { isAuthenticated } = useAuthStore()
    const { theme, setTheme, accentColor } = useUIStore()
    const location = useLocation()

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
        const bg = isDark ? '#1c1c1e' : '#ffffff'
        const csOnly = isDark ? 'only dark' : 'only light'
        const html = document.documentElement

        // 設定重點色
        html.setAttribute('data-accent', accentColor)

        // ── 關鍵優化：切換前先停用所有 transition ──────────────────
        // 加上 no-transition → 切換 dark class → 下一幀移除 no-transition
        // 這讓背景色、文字色、邊框色同步即時生效，無 300ms 延遲
        html.classList.add('no-transition')

        // dark class 切換（必須在 no-transition 加上後才做）
        if (isDark) {
            html.classList.add('dark')
        } else {
            html.classList.remove('dark')
        }

        // html/body 背景色即時更新（不依賴 CSS transition）
        // 讓 iOS Safari 底部工具列能立刻偵測到新的頁面背景色
        html.style.backgroundColor = bg
        document.body.style.backgroundColor = bg

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

        // ── 下一個繪製幀後恢復 transition ──────────────────────────
        // requestAnimationFrame 保證瀏覽器已完成本次重繪後才恢復
        // 雙層 rAF 確保 iOS Safari 也能正確觸發
        const raf = requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                html.classList.remove('no-transition')
            })
        })
        return () => cancelAnimationFrame(raf)
    }, [theme, accentColor, location.pathname])

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

