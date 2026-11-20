import { useAuthStore } from '@/store/authStore'

/**
 * 載入完會停在哪一頁：和 App.tsx 的路由、ProtectedRoute、AdminPage 的導向規則一致。
 * 例如沒登入時打開首頁會被帶到登入頁，這時骨架要畫登入頁，不是聊天頁。改那幾處的導向時這裡要一起改。
 */
export function landingPath(pathname: string): string {
    const { isAuthenticated, user } = useAuthStore.getState()
    const path = pathname === '/register' ? '/login' : pathname
    if (path.startsWith('/login')) return isAuthenticated ? '/' : '/login'
    const isProtected = path === '/' || path === '/chat' || path.startsWith('/chat/') || path.startsWith('/admin')
    if (isProtected && !isAuthenticated) return '/login'
    if (path.startsWith('/admin') && user && user.role !== 'admin' && user.role !== 'engineer') return '/'
    return path
}
