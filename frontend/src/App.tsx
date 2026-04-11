/**
 * App 根組件 - 路由設定
 */

import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useUIStore } from './store/uiStore'

// Pages
import Login from './pages/Login'
import Register from './pages/Register'
import Chat from './pages/Chat'
import Documents from './pages/Documents'
import Settings from './pages/Settings'
import Admin from './pages/Admin'
import NotFound from './pages/NotFound'

// Protected Route Component
import ProtectedRoute from './components/auth/ProtectedRoute'

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

    // 主題同步：讓頂部與底部 Safari 工具列使用【相同邏輯】
    // 策略：移除 meta[theme-color]，讓 iOS Safari 自動採樣頁面背景色
    //       → 頂部狀態列與底部工具列都用相同機制，保持一致
    useEffect(() => {
        const isDark = theme === 'dark'
        const bg = isDark ? '#1a1a1a' : '#f0f2f5'

        // dark class 切換（控制 Tailwind dark: 樣式）
        if (isDark) {
            document.documentElement.classList.add('dark')
        } else {
            document.documentElement.classList.remove('dark')
        }

        // html/body 背景色即時更新（Safari 採樣這個顏色決定兩個工具列的顏色）
        document.documentElement.style.backgroundColor = bg
        document.body.style.backgroundColor = bg

        // color-scheme: only dark/light — 告訴瀏覽器頁面的顏色方案
        // 'only' 關鍵字防止瀏覽器自動套用系統深色模式覆蓋我們的選擇
        const csOnly = isDark ? 'only dark' : 'only light'
        document.documentElement.style.colorScheme = csOnly

        // 同步 meta[color-scheme]（影響系統鍵盤、scrollbar 等原生 UI）
        const existingColorScheme = document.querySelector('meta[name="color-scheme"]')
        if (existingColorScheme) existingColorScheme.remove()
        const metaColorScheme = document.createElement('meta')
        metaColorScheme.setAttribute('name', 'color-scheme')
        metaColorScheme.setAttribute('content', csOnly)
        document.head.appendChild(metaColorScheme)

        // 移除 meta[theme-color]（之前用來控制頂部狀態列，但會造成頂底不一致）
        // 現在讓頂部跟底部都由 iOS 自動採樣頁面背景色決定 → 兩者邏輯相同
        const existingThemeColor = document.querySelector('meta[name="theme-color"]')
        if (existingThemeColor) existingThemeColor.remove()
    }, [theme])

    return (
        // 頁面切換動畫：每當 location.pathname 改變時，新頁面會從下方淡入
        <div
            key={location.pathname}
            className="page-transition"
        >
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
                    path="/settings"
                    element={
                        <ProtectedRoute>
                            <Settings />
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
        </div>
    )
}

