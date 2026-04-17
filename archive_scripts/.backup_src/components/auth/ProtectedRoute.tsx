/**
 * 受保護路由元件
 */

import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

interface ProtectedRouteProps {
    children: React.ReactNode
    requiredRole?: 'engineer' | 'admin' | 'user'
}

export default function ProtectedRoute({
    children,
    requiredRole,
}: ProtectedRouteProps) {
    const { isAuthenticated, user } = useAuthStore()
    const location = useLocation()

    // 未登入，重導向到登入頁
    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />
    }

    // 角色權限檢查
    if (requiredRole && user) {
        const roleHierarchy = { engineer: 3, admin: 2, user: 1 }
        const userLevel = roleHierarchy[user.role] || 0
        const requiredLevel = roleHierarchy[requiredRole] || 0

        if (userLevel < requiredLevel) {
            return <Navigate to="/" replace />
        }
    }

    return <>{children}</>
}
