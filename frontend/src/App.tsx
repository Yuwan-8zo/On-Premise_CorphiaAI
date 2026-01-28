import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useUIStore } from './store/uiStore'

// Pages & Layouts
import MainLayout from './components/layout/MainLayout'
import Login from './pages/Login'
import Chat from './pages/Chat'
import Documents from './pages/Documents'
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
        <Routes>
            {/* 公開路由 */}
            <Route
                path="/login"
                element={
                    isAuthenticated ? <Navigate to="/" replace /> : <Login />
                }
            />

            {/* 受保護路由 (MainLayout) */}
            <Route
                element={
                    <ProtectedRoute>
                        <MainLayout />
                    </ProtectedRoute>
                }
            >
                <Route path="/" element={<Chat />} />
                <Route path="/documents" element={<Documents />} />
                <Route path="/settings" element={<div>Settings Page (Coming Soon)</div>} />
            </Route>

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
        </Routes>
    )
}

export default App
