/**
 * 側邊導覽列元件
 */

import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../store/authStore'
import { authApi } from '../../api/auth'

// Icons
const ChatIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
)

const DocumentIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
)

const SettingsIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
)

const LogoutIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
)

interface SidebarProps {
    isOpen: boolean
    onClose?: () => void
}

export default function Sidebar({ isOpen }: SidebarProps) {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const { user, clearAuth } = useAuthStore()

    const navItems = [
        { path: '/', icon: <ChatIcon />, label: t('nav.chat') },
        { path: '/documents', icon: <DocumentIcon />, label: t('nav.documents') },
        { path: '/settings', icon: <SettingsIcon />, label: t('nav.settings') },
    ]

    const handleLogout = async () => {
        try {
            // 先呼叫後端 API 將 Token 加入黑名單
            await authApi.logout()
        } catch {
            // 即使 API 失敗也繼續清除本地 Token
        }
        clearAuth()
        navigate('/login')
    }

    return (
        <aside
            className={`${isOpen ? 'w-64' : 'w-0'
                } bg-slate-800 dark:bg-slate-950 transition-all duration-300 overflow-hidden flex flex-col h-screen`}
        >
            {/* Logo */}
            <div className="p-4 border-b border-slate-700">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[16px] bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                        <span className="text-xl">🤖</span>
                    </div>
                    <div>
                        <h1 className="text-white font-bold">Corphia AI</h1>
                        <p className="text-slate-400 text-xs">v2.2.0</p>
                    </div>
                </div>
            </div>

            {/* 導覽選單 */}
            <nav className="flex-1 p-3 space-y-1">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded-full transition-colors ${isActive
                                ? 'bg-primary-600/20 text-primary-400'
                                : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                            }`
                        }
                    >
                        {item.icon}
                        <span>{item.label}</span>
                    </NavLink>
                ))}
            </nav>

            {/* 使用者資訊 */}
            <div className="p-4 border-t border-slate-700">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-medium">
                        {user?.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{user?.name}</p>
                        <p className="text-slate-400 text-sm truncate">{user?.email}</p>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="p-2 text-slate-400 hover:text-white transition-colors"
                        title={t('auth.logout')}
                    >
                        <LogoutIcon />
                    </button>
                </div>
            </div>
        </aside>
    )
}
