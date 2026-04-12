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
const NotFound = lazy(() => import('./pages/NotFound'))

import { ConfirmModal } from './components/ui/ConfirmModal'
import SettingsModal from './components/ui/SettingsModal'

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
    const { theme, setTheme } = useUIStore()
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

    // 主題同步：更新 html/body 背景色 + meta theme-color
    // 確保 Safari 頂部狀態列與底部 Home bar 顏色與 App 主題一致
    useEffect(() => {
        const isDark = theme === 'dark'
        
        // 根據當前層級與主題，動態設定 iOS Safari Safe Area（狀態列與底部）的背景色
        // 全部統一使用 Layer 0 (Gray 6) 作為 Safari Safe Area 背景，確保沉浸式體驗
        let bg = isDark ? '#1c1c1e' : '#f2f2f7'

        // dark class 切換
        if (isDark) {
            document.documentElement.classList.add('dark')
        } else {
            document.documentElement.classList.remove('dark')
        }

        // html/body 背景色即時更新（不依賴 CSS transition）
        // 讓 iOS Safari 底部工具列能立刻偵測到新的頁面背景色
        document.documentElement.style.backgroundColor = bg
        document.body.style.backgroundColor = bg

        // 關鍵：使用 'only light'/'only dark' 而非單純 'light'/'dark'
        // 'only' 關鍵字告訴瀏覽器：此頁面【只】支援這個顏色方案，不允許系統偏好覆蓋
        // 這是讓 iOS Safari 底部工具列也跟隨 App 主題的核心機制（參考 Gemini 實作）
        const csOnly = isDark ? 'only dark' : 'only light'
        document.documentElement.style.colorScheme = csOnly

        // 強制 Safari 重新偵測 meta[theme-color]：先移除再新增
        // 直接 setAttribute 有時不會觸發 Safari 的 toolbar 顏色更新
        const existingThemeColor = document.querySelector('meta[name="theme-color"]')
        if (existingThemeColor) existingThemeColor.remove()

        const metaThemeColor = document.createElement('meta')
        metaThemeColor.setAttribute('name', 'theme-color')
        metaThemeColor.setAttribute('content', bg)
        document.head.appendChild(metaThemeColor)

        // color-scheme meta 更新（控制鍵盤、scrollbar 等原生 UI）
        // 同樣使用 'only light'/'only dark' 讓 Safari 底部工具列強制跟隨 App 主題
        const existingColorScheme = document.querySelector('meta[name="color-scheme"]')
        if (existingColorScheme) existingColorScheme.remove()

        const metaColorScheme = document.createElement('meta')
        metaColorScheme.setAttribute('name', 'color-scheme')
        metaColorScheme.setAttribute('content', csOnly)
        document.head.appendChild(metaColorScheme)
    }, [theme, location.pathname])

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
        </>
    )
}

