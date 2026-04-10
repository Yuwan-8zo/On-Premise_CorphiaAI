/**
 * App 根組件 - 路由設定
 */

import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
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

    // 應用主題與強制覆蓋 Safari 狀態列顏色 (theme-color)
    useEffect(() => {
        let metaThemeColor = document.querySelector('meta[name="theme-color"]')
        if (!metaThemeColor) {
            metaThemeColor = document.createElement('meta')
            metaThemeColor.setAttribute('name', 'theme-color')
            document.head.appendChild(metaThemeColor)
        }

        if (theme === 'dark') {
            document.documentElement.classList.add('dark')
            metaThemeColor.setAttribute('content', '#1a1a1a') // 對應深色背景
        } else {
            document.documentElement.classList.remove('dark')
            metaThemeColor.setAttribute('content', '#f0f2f5') // 對應淺色背景
        }
    }, [theme])

    return (
        <Routes>
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
    )
}

