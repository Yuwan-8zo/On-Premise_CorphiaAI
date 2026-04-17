<<<<<<< HEAD
/**
 * App 根組件 - 路由設定
 */

import { useEffect } from 'react'
=======
>>>>>>> 1432944 (feat(init): 建立 Corphia AI Platform v2.2 基礎架構)
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useUIStore } from './store/uiStore'

// Pages
import Login from './pages/Login'
<<<<<<< HEAD
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

    // 應用主題
    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark')
        } else {
            document.documentElement.classList.remove('dark')
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

=======
import Chat from './pages/Chat'
import NotFound from './pages/NotFound'

// Components
import ProtectedRoute from './components/auth/ProtectedRoute'

function App() {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
    const theme = useUIStore((state) => state.theme)

    // 應用主題
    if (theme === 'dark') {
        document.documentElement.classList.add('dark')
    } else {
        document.documentElement.classList.remove('dark')
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
            <Routes>
                {/* 公開路由 */}
                <Route
                    path="/login"
                    element={
                        isAuthenticated ? <Navigate to="/" replace /> : <Login />
                    }
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

                {/* 404 */}
                <Route path="*" element={<NotFound />} />
            </Routes>
        </div>
    )
}

export default App
>>>>>>> 1432944 (feat(init): 建立 Corphia AI Platform v2.2 基礎架構)
