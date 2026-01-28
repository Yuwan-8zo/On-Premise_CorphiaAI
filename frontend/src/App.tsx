import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useUIStore } from './store/uiStore'

// Pages
import Login from './pages/Login'
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
