/**
 * 設定頁面
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'

// --- Icons ---
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

/** 主題－日間模式 Icon */
const SunIcon = () => (
    <svg className="w-10 h-10 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2m0 14v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M3 12h2m14 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M12 7a5 5 0 1 0 0 10A5 5 0 0 0 12 7z" />
    </svg>
)

/** 主題－夜間模式 Icon */
const MoonIcon = () => (
    <svg className="w-10 h-10 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
)

/** 關於頁面 AI Robot Icon */
const RobotIcon = () => (
    <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15M14.25 3.104c.251.023.501.05.75.082M19.8 15l-2.4 2.4m0 0-2.4 2.4M19.8 15l2.4 2.4m-2.4-2.4-2.4-2.4M9 9h.01M15 9h.01M9 12h6M7.5 19.5h9" />
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
        // 1. 最外層：固定高度視窗，overflow-hidden 確保內容只在 main 區域滾動
        <div className="flex flex-col fixed inset-0 w-full h-[100dvh] bg-[#f0f2f5] dark:bg-[#1a1a1a]">

            {/* 2. 固定頂部 Header：顏色與頁面背景一致 */}
            <header className="shrink-0 h-[64px] flex items-center px-6 bg-[#f0f2f5] dark:bg-[#1a1a1a] border-b border-gray-200/70 dark:border-[#2a2a2a] transition-colors z-20">
                <button
                    onClick={() => navigate('/')}
                    className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-200/60 dark:text-gray-400 dark:hover:text-white dark:hover:bg-[#2a2a2a] rounded-lg mr-4 transition-colors"
                >
                    <BackIcon />
                </button>
                <h1 className="text-[18px] font-semibold text-gray-900 dark:text-white tracking-wide">
                    {t('settings.title')}
                </h1>
            </header>

            {/* 3. 可滾動內容區 */}
            <div className="flex-1 overflow-y-auto min-h-0">
                <div className="max-w-4xl mx-auto p-6 pt-8">
                    <div className="flex gap-6 flex-col md:flex-row">

                        {/* 側邊選單 */}
                        <nav className="md:w-56 flex-shrink-0">
                            <div className="bg-white dark:bg-[#2a2a2a] rounded-[20px] border border-gray-200 dark:border-[#333] overflow-hidden shadow-sm dark:shadow-none transition-colors">
                                {menuItems.map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => setActiveSection(item.id)}
                                        className={`w-full flex items-center gap-4 px-6 py-4 text-left transition-colors ${activeSection === item.id
                                                ? 'bg-[#1877F2]/5 dark:bg-[#1877F2]/10 text-[#1877F2] border-l-[3px] border-[#1877F2]'
                                                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#333]/50 hover:text-gray-900 dark:hover:text-white border-l-[3px] border-transparent'
                                            }`}
                                    >
                                        {item.icon}
                                        <span className="font-medium">{item.label}</span>
                                    </button>
                                ))}
                            </div>
                        </nav>

                        {/* 內容區域 */}
                        <main className="flex-1">
                            <div className="bg-white dark:bg-[#2a2a2a] rounded-[20px] border border-gray-200 dark:border-[#333] p-8 shadow-sm dark:shadow-none transition-colors">

                                {/* 個人資料 */}
                                {activeSection === 'profile' && (
                                    <div>
                                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-8">
                                            {t('settings.profile')}
                                        </h2>

                                        {/* 4. 頭像：圓形 + 首字母呈現 */}
                                        <div className="flex items-center gap-6 mb-8">
                                            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#1877F2] to-[#0a4fa8] flex items-center justify-center text-white text-3xl font-bold shadow-md shrink-0 overflow-hidden">
                                                {user?.name?.charAt(0).toUpperCase() ?? 'U'}
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-1">
                                                    {user?.name}
                                                </h3>
                                                <p className="text-gray-500 dark:text-gray-400 mb-2">
                                                    {user?.email}
                                                </p>
                                                <span className="inline-block px-3 py-1 text-xs font-semibold bg-[#1877F2]/10 dark:bg-[#1877F2]/20 text-[#1877F2] rounded-full tracking-wide">
                                                    {user?.role}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="border-t border-gray-100 dark:border-[#333] pt-8">
                                            <button
                                                onClick={handleLogout}
                                                className="px-6 py-2.5 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 text-sm font-medium rounded-full transition-colors"
                                            >
                                                {t('auth.logout')}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* 外觀設定 */}
                                {activeSection === 'appearance' && (
                                    <div>
                                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-8">
                                            {t('settings.theme')}
                                        </h2>

                                        {/* 5. 主題卡片：用 SVG Icon 取代 emoji */}
                                        <div className="flex gap-6">
                                            {/* 日間模式 */}
                                            <button
                                                onClick={() => theme === 'dark' && toggleTheme()}
                                                className={`flex-1 p-4 rounded-[16px] border-2 transition-all ${theme === 'light'
                                                        ? 'border-[#1877F2] bg-[#1877F2]/5 dark:bg-[#1877F2]/10'
                                                        : 'border-gray-200 dark:border-[#333] hover:border-gray-300 dark:hover:border-[#444]'
                                                    }`}
                                            >
                                                <div className="w-full h-24 rounded-lg bg-white border border-gray-200 mb-4 flex items-center justify-center">
                                                    <SunIcon />
                                                </div>
                                                <p className="text-[15px] font-medium text-gray-900 dark:text-gray-100">
                                                    {t('settings.themeLight')}
                                                </p>
                                            </button>

                                            {/* 夜間模式 */}
                                            <button
                                                onClick={() => theme === 'light' && toggleTheme()}
                                                className={`flex-1 p-4 rounded-[16px] border-2 transition-all ${theme === 'dark'
                                                        ? 'border-[#1877F2] bg-[#1877F2]/5 dark:bg-[#1877F2]/10'
                                                        : 'border-gray-200 dark:border-[#333] hover:border-gray-300 dark:hover:border-[#444]'
                                                    }`}
                                            >
                                                <div className="w-full h-24 rounded-lg bg-[#111111] border border-[#222] mb-4 flex items-center justify-center">
                                                    <MoonIcon />
                                                </div>
                                                <p className="text-[15px] font-medium text-gray-900 dark:text-gray-100">
                                                    {t('settings.themeDark')}
                                                </p>
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* 語言設定 */}
                                {activeSection === 'language' && (
                                    <div>
                                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-8">
                                            {t('settings.language')}
                                        </h2>

                                        <div className="space-y-3">
                                            {languages.map(lang => (
                                                <button
                                                    key={lang.code}
                                                    onClick={() => handleLanguageChange(lang.code)}
                                                    className={`w-full flex items-center justify-between px-6 py-4 rounded-xl transition-colors border ${i18n.language === lang.code
                                                            ? 'bg-[#1877F2]/5 dark:bg-[#1877F2]/10 text-[#1877F2] border-[#1877F2]/30'
                                                            : 'bg-gray-50 dark:bg-[#1a1a1a] hover:bg-gray-100 dark:hover:bg-[#333]/50 text-gray-700 dark:text-gray-300 border-transparent'
                                                        }`}
                                                >
                                                    <span className="font-medium text-[15px]">{lang.label}</span>
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
                                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-8">
                                            {t('settings.about')}
                                        </h2>

                                        <div className="text-center py-10">
                                            <div className="inline-flex items-center justify-center w-24 h-24 rounded-[24px] bg-[#1877F2] mb-6 shadow-md shadow-[#1877F2]/20">
                                                <RobotIcon />
                                            </div>
                                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                                                Corphia AI Platform
                                            </h3>
                                            <p className="text-gray-500 dark:text-gray-400 font-medium mb-6">
                                                版本 2.2.0
                                            </p>
                                            <p className="text-[15px] text-gray-600 dark:text-gray-400 max-w-md mx-auto leading-relaxed">
                                                企業級私有部署 AI 問答系統，支援本地 LLM 推論和 RAG 知識庫檢索。
                                            </p>
                                        </div>

                                        <div className="border-t border-gray-100 dark:border-[#333] pt-8 mt-4">
                                            <div className="grid grid-cols-2 gap-8 text-[15px]">
                                                <div>
                                                    <p className="text-gray-500 dark:text-gray-400 mb-1">技術棧</p>
                                                    <p className="text-gray-900 dark:text-gray-100 font-medium">React + FastAPI</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-500 dark:text-gray-400 mb-1">LLM Engine</p>
                                                    <p className="text-gray-900 dark:text-gray-100 font-medium">llama.cpp</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-500 dark:text-gray-400 mb-1">向量資料庫</p>
                                                    <p className="text-gray-900 dark:text-gray-100 font-medium">ChromaDB</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-500 dark:text-gray-400 mb-1">授權</p>
                                                    <p className="text-gray-900 dark:text-gray-100 font-medium">MIT License</p>
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
        </div>
    )
}
