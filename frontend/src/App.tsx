/**
 * App 根組件 - 路由設定
 */

import { useEffect, useRef } from 'react'
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
    const { theme } = useUIStore()
    const location = useLocation()

    // 主題同步：更新 html/body 背景色 + meta theme-color
    // 確保 Safari 頂部狀態列與底部 Home bar 顏色與 App 主題一致
    useEffect(() => {
        const isDark = theme === 'dark'
        const bg = isDark ? '#1a1a1a' : '#f0f2f5'

        // html 元素背景（控制 iOS Safari 頂部 safe-area 顏色）
        document.documentElement.style.backgroundColor = bg
        // body 背景（控制 iOS Safari 底部 safe-area 顏色）
        document.body.style.backgroundColor = bg
        // color-scheme 讓 Safari UI 元素（鍵盤、滑動條）隨主題變色
        document.documentElement.style.colorScheme = isDark ? 'dark' : 'light'

        // dark class 切換
        if (isDark) {
            document.documentElement.classList.add('dark')
        } else {
            document.documentElement.classList.remove('dark')
        }

        // meta[name="theme-color"] - 控制 Android Chrome/Safari 瀏覽器 toolbar 顏色
        let metaThemeColor = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null
        if (!metaThemeColor) {
            metaThemeColor = document.createElement('meta') as HTMLMetaElement
            metaThemeColor.setAttribute('name', 'theme-color')
            document.head.appendChild(metaThemeColor)
        }
        metaThemeColor.setAttribute('content', bg)
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

