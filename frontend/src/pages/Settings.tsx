/**
 * 設定頁面
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'

// Icons
const BackIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
)

const UserIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
)

const PaletteIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
    </svg>
)

const GlobeIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
)

const InfoIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
)

type SettingSection = 'profile' | 'appearance' | 'language' | 'about'

export default function Settings() {
    const { t, i18n } = useTranslation()
    const navigate = useNavigate()
    const { user, clearAuth } = useAuthStore()
    const { theme, toggleTheme } = useUIStore()

    const [activeSection, setActiveSection] = useState<SettingSection>('profile')

    const menuItems = [
        { id: 'profile' as const, icon: <UserIcon />, label: t('settings.profile') },
        { id: 'appearance' as const, icon: <PaletteIcon />, label: t('settings.theme') },
        { id: 'language' as const, icon: <GlobeIcon />, label: t('settings.language') },
        { id: 'about' as const, icon: <InfoIcon />, label: t('settings.about') },
    ]

    const languages = [
        { code: 'zh-TW', label: '繁體中文' },
        { code: 'en-US', label: 'English' },
        { code: 'ja-JP', label: '日本語' },
    ]

    const handleLanguageChange = (langCode: string) => {
        i18n.changeLanguage(langCode)
        localStorage.setItem('language', langCode)
    }

    const handleLogout = () => {
        clearAuth()
        navigate('/login')
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
            {/* 頂部導覽列 */}
            <header className="h-14 border-b border-slate-200 dark:border-slate-800 flex items-center px-4 bg-white dark:bg-slate-900">
                <button
                    onClick={() => navigate('/')}
                    className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg mr-2"
                >
                    <BackIcon />
                </button>
                <h1 className="text-lg font-semibold text-slate-800 dark:text-white">
                    {t('settings.title')}
                </h1>
            </header>

            <div className="max-w-4xl mx-auto p-6">
                <div className="flex gap-6">
                    {/* 側邊選單 */}
                    <nav className="w-64 flex-shrink-0">
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                            {menuItems.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveSection(item.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${activeSection === item.id
                                            ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 border-l-3 border-primary-500'
                                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                        }`}
                                >
                                    {item.icon}
                                    <span>{item.label}</span>
                                </button>
                            ))}
                        </div>
                    </nav>

                    {/* 內容區域 */}
                    <main className="flex-1">
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                            {/* 個人資料 */}
                            {activeSection === 'profile' && (
                                <div>
                                    <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-6">
                                        {t('settings.profile')}
                                    </h2>

                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-3xl font-bold">
                                            {user?.name?.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-medium text-slate-800 dark:text-white">
                                                {user?.name}
                                            </h3>
                                            <p className="text-slate-500 dark:text-slate-400">
                                                {user?.email}
                                            </p>
                                            <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded">
                                                {user?.role}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                                        <button
                                            onClick={handleLogout}
                                            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                                        >
                                            {t('auth.logout')}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* 外觀設定 */}
                            {activeSection === 'appearance' && (
                                <div>
                                    <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-6">
                                        {t('settings.theme')}
                                    </h2>

                                    <div className="space-y-4">
                                        <div className="flex gap-4">
                                            <button
                                                onClick={() => theme === 'dark' && toggleTheme()}
                                                className={`flex-1 p-4 rounded-xl border-2 transition-all ${theme === 'light'
                                                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                                    }`}
                                            >
                                                <div className="w-full h-24 rounded-lg bg-white border border-slate-200 mb-3 flex items-center justify-center">
                                                    <span className="text-2xl">☀️</span>
                                                </div>
                                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                    {t('settings.themeLight')}
                                                </p>
                                            </button>

                                            <button
                                                onClick={() => theme === 'light' && toggleTheme()}
                                                className={`flex-1 p-4 rounded-xl border-2 transition-all ${theme === 'dark'
                                                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                                    }`}
                                            >
                                                <div className="w-full h-24 rounded-lg bg-slate-800 border border-slate-700 mb-3 flex items-center justify-center">
                                                    <span className="text-2xl">🌙</span>
                                                </div>
                                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                    {t('settings.themeDark')}
                                                </p>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 語言設定 */}
                            {activeSection === 'language' && (
                                <div>
                                    <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-6">
                                        {t('settings.language')}
                                    </h2>

                                    <div className="space-y-2">
                                        {languages.map(lang => (
                                            <button
                                                key={lang.code}
                                                onClick={() => handleLanguageChange(lang.code)}
                                                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${i18n.language === lang.code
                                                        ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                                                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'
                                                    }`}
                                            >
                                                <span>{lang.label}</span>
                                                {i18n.language === lang.code && (
                                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 關於 */}
                            {activeSection === 'about' && (
                                <div>
                                    <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-6">
                                        {t('settings.about')}
                                    </h2>

                                    <div className="text-center py-8">
                                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 mb-4">
                                            <span className="text-4xl">🤖</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1">
                                            Corphia AI Platform
                                        </h3>
                                        <p className="text-slate-500 dark:text-slate-400 mb-4">
                                            版本 2.2.0
                                        </p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                                            企業級私有部署 AI 問答系統，支援本地 LLM 推論和 RAG 知識庫檢索。
                                        </p>
                                    </div>

                                    <div className="border-t border-slate-200 dark:border-slate-700 pt-6 mt-6">
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <p className="text-slate-500 dark:text-slate-400">技術棧</p>
                                                <p className="text-slate-700 dark:text-slate-300">React + FastAPI</p>
                                            </div>
                                            <div>
                                                <p className="text-slate-500 dark:text-slate-400">LLM Engine</p>
                                                <p className="text-slate-700 dark:text-slate-300">llama.cpp</p>
                                            </div>
                                            <div>
                                                <p className="text-slate-500 dark:text-slate-400">向量資料庫</p>
                                                <p className="text-slate-700 dark:text-slate-300">ChromaDB</p>
                                            </div>
                                            <div>
                                                <p className="text-slate-500 dark:text-slate-400">授權</p>
                                                <p className="text-slate-700 dark:text-slate-300">MIT License</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </main>
                </div>
            </div>
        </div>
    )
}
