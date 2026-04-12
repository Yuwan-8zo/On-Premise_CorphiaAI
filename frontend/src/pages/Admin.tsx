/**
 * 管理後台頁面
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { getModels, refreshModels, selectModel, ModelItem } from '../api/models'
import { apiClient } from '../api/client'

// Types
interface UserData {
    id: string
    name: string
    email: string
    role: 'engineer' | 'admin' | 'user'
    isActive: boolean
    createdAt: string
    lastLoginAt?: string
}

interface Stats {
    totalUsers: number
    totalConversations: number
    totalDocuments: number
    totalMessages: number
}

// Icons
const BackIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
)

const UsersIcon = () => (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
)

const ChatIcon = () => (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
)

const DocumentIcon = () => (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
)

const MessageIcon = () => (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
)

type AdminSection = 'overview' | 'users' | 'models' | 'system'

export default function Admin() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const { user } = useAuthStore()
    const { theme, toggleTheme } = useUIStore()

    const [activeSection, setActiveSection] = useState<AdminSection>('overview')
    const [users, setUsers] = useState<UserData[]>([])
    const [stats, setStats] = useState<Stats>({
        totalUsers: 0,
        totalConversations: 0,
        totalDocuments: 0,
        totalMessages: 0,
    })
    const [isLoading, setIsLoading] = useState(false)
    const [models, setModels] = useState<ModelItem[]>([])
    const [modelsDir, setModelsDir] = useState('')
    const [isLoadingModels, setIsLoadingModels] = useState(false)

    // 檢查權限
    useEffect(() => {
        if (user?.role !== 'admin' && user?.role !== 'engineer') {
            navigate('/')
        }
    }, [user, navigate])

    // 載入統計數據
    const loadStats = useCallback(async () => {
        try {
            const response = await apiClient.get('/admin/stats')
            if (response.data && response.data.status === 'success') {
                setStats(response.data.data)
            }
        } catch (err) {
            console.error('載入統計失敗:', err)
        }
    }, [])

    // 載入使用者列表
    const loadUsers = useCallback(async () => {
        setIsLoading(true)
        try {
            // 模擬 API 呼叫
            setUsers([
                {
                    id: '1',
                    name: 'Admin User',
                    email: 'admin@example.com',
                    role: 'admin',
                    isActive: true,
                    createdAt: '2024-01-01T00:00:00Z',
                    lastLoginAt: '2024-01-28T10:00:00Z',
                },
                {
                    id: '2',
                    name: 'Test User',
                    email: 'test@example.com',
                    role: 'user',
                    isActive: true,
                    createdAt: '2024-01-15T00:00:00Z',
                    lastLoginAt: '2024-01-27T15:30:00Z',
                },
            ])
        } catch (err) {
            console.error('載入使用者失敗:', err)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        loadStats()
        loadUsers()
    }, [loadStats, loadUsers])

    // 載入模型列表
    const loadModels = useCallback(async () => {
        setIsLoadingModels(true)
        try {
            const data = await getModels()
            setModels(data.models)
            setModelsDir(data.models_dir)
        } catch (err) {
            console.error('載入模型失敗:', err)
        } finally {
            setIsLoadingModels(false)
        }
    }, [])

    // 切換到模型分頁時載入
    useEffect(() => {
        if (activeSection === 'models') {
            loadModels()
        }
    }, [activeSection, loadModels])

    // 刷新模型
    const handleRefreshModels = async () => {
        setIsLoadingModels(true)
        try {
            const data = await refreshModels()
            setModels(data.models)
        } catch (err) {
            console.error('刷新模型失敗:', err)
        } finally {
            setIsLoadingModels(false)
        }
    }

    // 選擇模型
    const handleSelectModel = async (name: string) => {
        try {
            await selectModel(name)
            // 重新載入模型列表
            loadModels()
        } catch (err) {
            console.error('選擇模型失敗:', err)
        }
    }

    const StatCard = ({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) => (
        <div className="bg-white dark:bg-ios-dark-gray5 rounded-[20px] border border-gray-200 dark:border-white/5 p-8 shadow-sm dark:shadow-none transition-colors">
            <div className="flex items-center gap-5">
                <div className={`w-14 h-14 rounded-[16px] ${color} flex items-center justify-center text-white shadow-sm`}>
                    {icon}
                </div>
                <div>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1 tracking-tight">{value.toLocaleString()}</p>
                    <p className="text-[15px] font-medium text-gray-500 dark:text-gray-400">{label}</p>
                </div>
            </div>
        </div>
    )

    const RoleBadge = ({ role }: { role: UserData['role'] }) => {
        const styles = {
            admin: 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20',
            engineer: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20',
            user: 'bg-gray-50 dark:bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-500/20',
        }
        return (
            <span className={`px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase rounded-full ${styles[role]}`}>
                {role}
            </span>
        )
    }

    return (
        <div className="min-h-screen bg-ios-light-gray5 dark:bg-ios-dark-gray6 transition-colors duration-300">
            {/* 頂部導覽列 */}
            <header className="h-[80px] border-b border-gray-200 dark:border-white/5 flex items-center justify-between px-8 bg-white dark:bg-ios-dark-gray6 transition-colors">
                <div className="flex items-center">
                    <button
                        onClick={() => navigate('/')}
                        className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-ios-dark-gray4 rounded-full mr-4 transition-colors"
                    >
                        <BackIcon />
                    </button>
                    <h1 className="text-xl font-semibold text-gray-900 dark:text-white tracking-wide">
                        🛡️ {t('nav.admin')}
                    </h1>
                </div>
                <button
                    onClick={toggleTheme}
                    className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-ios-dark-gray4 rounded-full transition-colors"
                >
                    {theme === 'dark' ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v2m0 14v2m9-9h-2M5 12H3m14.071-7.071l-1.414 1.414M6.343 17.657l-1.414 1.414m12.728 0l-1.414-1.414M6.343 6.343L4.929 4.929M12 17a5 5 0 100-10 5 5 0 000 10z" />
                        </svg>
                    ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                        </svg>
                    )}
                </button>
            </header>

            <div className="max-w-6xl mx-auto p-8 pt-10">
                {/* 分頁標籤 */}
                <div className="flex gap-3 mb-8">
                    {(['overview', 'users', 'models', 'system'] as AdminSection[]).map((section) => (
                        <button
                            key={section}
                            onClick={() => setActiveSection(section)}
                            className={`px-5 py-2.5 rounded-full font-medium transition-colors border ${activeSection === section
                                ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm'
                                : 'bg-white dark:bg-ios-dark-gray5 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-ios-dark-gray4/50 border-gray-200 dark:border-white/5'
                                }`}
                        >
                            {section === 'overview' && '總覽'}
                            {section === 'users' && '使用者'}
                            {section === 'models' && '模型'}
                            {section === 'system' && '系統'}
                        </button>
                    ))}
                </div>

                {/* 總覽 */}
                {activeSection === 'overview' && (
                    <div className="space-y-6">
                        {/* 統計卡片 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <StatCard
                                icon={<UsersIcon />}
                                label="總使用者"
                                value={stats.totalUsers}
                                color="bg-ios-blue-light"
                            />
                            <StatCard
                                icon={<ChatIcon />}
                                label="總對話"
                                value={stats.totalConversations}
                                color="bg-emerald-500"
                            />
                            <StatCard
                                icon={<DocumentIcon />}
                                label="總文件"
                                value={stats.totalDocuments}
                                color="bg-amber-500"
                            />
                            <StatCard
                                icon={<MessageIcon />}
                                label="總訊息"
                                value={stats.totalMessages}
                                color="bg-purple-500"
                            />
                        </div>

                        {/* 最近活動 */}
                        <div className="bg-white dark:bg-ios-dark-gray5 rounded-[20px] border border-gray-200 dark:border-white/5 p-8 shadow-sm dark:shadow-none transition-colors mt-8">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                                最近活動
                            </h2>
                            <div className="text-gray-500 dark:text-gray-400 text-center py-10 font-medium bg-gray-50 dark:bg-ios-dark-gray6/50 rounded-[20px] border border-dashed border-gray-200 dark:border-white/20">
                                暫無活動記錄
                            </div>
                        </div>
                    </div>
                )}

                {/* 使用者管理 */}
                {activeSection === 'users' && (
                    <div className="bg-white dark:bg-ios-dark-gray5 rounded-[20px] border border-gray-200 dark:border-white/5 overflow-hidden shadow-sm dark:shadow-none transition-colors">
                        <div className="px-8 py-5 border-b border-gray-200 dark:border-white/5 flex items-center justify-between">
                            <h2 className="font-semibold text-gray-900 dark:text-white">
                                使用者列表 ({users.length})
                            </h2>
                            <button className="px-4 py-2 bg-ios-blue-light hover:bg-ios-blue-light/90 text-white text-[15px] font-medium rounded-full transition-colors shadow-sm shadow-ios-blue-light/20">
                                + 新增使用者
                            </button>
                        </div>

                        {isLoading ? (
                            <div className="p-10 text-center text-gray-500 dark:text-gray-400">載入中...</div>
                        ) : (
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-ios-dark-gray6">
                                    <tr>
                                        <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            使用者
                                        </th>
                                        <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            角色
                                        </th>
                                        <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            狀態
                                        </th>
                                        <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            最後登入
                                        </th>
                                        <th className="px-8 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            操作
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                    {users.map((u) => (
                                        <tr key={u.id} className="hover:bg-gray-50/50 dark:hover:bg-ios-dark-gray4 transition-colors">
                                            <td className="px-8 py-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-full bg-ios-blue-light/10 dark:bg-ios-blue-dark/20 flex items-center justify-center text-ios-blue-light dark:text-ios-blue-dark font-semibold text-sm">
                                                        {u.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-900 dark:text-white mb-0.5">{u.name}</p>
                                                        <p className="text-[13px] text-gray-500 dark:text-gray-400">{u.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-4">
                                                <RoleBadge role={u.role} />
                                            </td>
                                            <td className="px-8 py-4">
                                                <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${u.isActive ? 'text-green-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'
                                                    }`}>
                                                    <span className={`w-2 h-2 rounded-full ${u.isActive ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-500'}`} />
                                                    {u.isActive ? '啟用' : '停用'}
                                                </span>
                                            </td>
                                            <td className="px-8 py-4 text-[13px] text-gray-500 dark:text-gray-400">
                                                {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('zh-TW') : '-'}
                                            </td>
                                            <td className="px-8 py-4 text-right">
                                                <button className="text-ios-blue-light hover:text-ios-blue-light/90 dark:text-ios-blue-dark dark:hover:text-ios-blue-dark/90 text-sm font-medium px-3 py-1.5 rounded-full hover:bg-ios-blue-light/5 dark:hover:bg-ios-blue-dark/10 transition-colors">
                                                    編輯
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {/* 模型管理 */}
                {activeSection === 'models' && (
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-ios-dark-gray5 rounded-[20px] border border-gray-200 dark:border-white/5 p-8 shadow-sm dark:shadow-none transition-colors">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                                        🤖 LLM 模型
                                    </h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                        目錄: <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-ios-dark-gray6 font-mono text-[13px]">{modelsDir}</code>
                                    </p>
                                </div>
                                <button
                                    onClick={handleRefreshModels}
                                    disabled={isLoadingModels}
                                    className="px-4 py-2 bg-ios-blue-light hover:bg-ios-blue-light/90 disabled:opacity-50 disabled:hover:bg-ios-blue-light text-white text-[15px] font-medium rounded-full transition-colors shadow-sm shadow-ios-blue-light/20"
                                >
                                    {isLoadingModels ? '掃描中...' : '🔄 重新掃描'}
                                </button>
                            </div>

                            {isLoadingModels ? (
                                <div className="text-center py-10 text-gray-500 dark:text-gray-400">載入中...</div>
                            ) : models.length === 0 ? (
                                <div className="text-center py-10 bg-gray-50 dark:bg-ios-dark-gray6/50 rounded-[20px] border border-dashed border-gray-200 dark:border-white/20">
                                    <p className="text-gray-600 dark:text-gray-300 font-medium">
                                        未找到 GGUF 模型檔案
                                    </p>
                                    <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-2">
                                        請將 .gguf 模型放入 ai_model 目錄
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {models.map((model) => (
                                        <div
                                            key={model.name}
                                            className={`p-5 rounded-[20px] border transition-colors ${model.is_current
                                                ? 'border-ios-blue-light bg-ios-blue-light/5 dark:bg-ios-blue-dark/10 shadow-sm'
                                                : 'border-gray-200 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-ios-dark-gray4/30 hover:border-gray-300 dark:hover:border-white/20'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3">
                                                        <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white">
                                                            {model.name}
                                                        </h3>
                                                        {model.is_current && (
                                                            <span className="px-2.5 py-0.5 text-[11px] font-bold tracking-wide uppercase bg-ios-blue-light text-white rounded-full">
                                                                使用中
                                                            </span>
                                                        )}
                                                        {model.quantization && (
                                                            <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-ios-dark-gray6 border border-gray-200 dark:border-white/5 text-gray-600 dark:text-gray-400 rounded-full font-mono">
                                                                {model.quantization}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-4 mt-2 text-[13px] text-gray-500 dark:text-gray-400">
                                                        <span className="flex items-center gap-1.5"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>{model.size_gb} GB</span>
                                                        <span className="flex items-center gap-1.5"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>{model.filename}</span>
                                                    </div>
                                                </div>
                                                {!model.is_current && (
                                                    <button
                                                        onClick={() => handleSelectModel(model.name)}
                                                        className="px-5 py-2 bg-gray-100 dark:bg-ios-dark-gray6 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-full border border-gray-200 dark:border-white/5 hover:bg-gray-200 dark:hover:bg-ios-dark-gray4 transition-colors"
                                                    >
                                                        選擇
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="bg-white dark:bg-ios-dark-gray5 rounded-[20px] border border-gray-200 dark:border-white/5 p-8 shadow-sm dark:shadow-none transition-colors">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                如何添加新模型
                            </h2>
                            <ol className="list-decimal list-inside space-y-3 text-[15px] text-gray-600 dark:text-gray-400">
                                <li>從 Hugging Face 下載 GGUF 格式的模型</li>
                                <li>將檔案放入 <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-ios-dark-gray6 rounded font-mono text-[13px]">ai_model/</code> 目錄</li>
                                <li>點擊「重新掃描」按鈕</li>
                                <li>選擇要使用的模型</li>
                            </ol>
                        </div>
                    </div>
                )}

                {/* 系統資訊 */}
                {activeSection === 'system' && (
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-ios-dark-gray5 rounded-[20px] border border-gray-200 dark:border-white/5 p-8 shadow-sm dark:shadow-none transition-colors">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                                系統資訊
                            </h2>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-8 text-[15px]">
                                <div>
                                    <p className="text-gray-500 dark:text-gray-400 mb-1">版本</p>
                                    <p className="text-gray-900 dark:text-gray-100 font-medium">2.2.0</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 dark:text-gray-400 mb-1">後端</p>
                                    <p className="text-gray-900 dark:text-gray-100 font-medium">FastAPI</p>
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
                                    <p className="text-gray-500 dark:text-gray-400 mb-1">資料庫</p>
                                    <p className="text-gray-900 dark:text-gray-100 font-medium">SQLite</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 dark:text-gray-400 mb-1">Python</p>
                                    <p className="text-gray-900 dark:text-gray-100 font-medium tracking-wide">3.10+</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-ios-dark-gray5 rounded-[20px] border border-gray-200 dark:border-white/5 p-8 shadow-sm dark:shadow-none transition-colors">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                                維護操作
                            </h2>
                            <div className="flex gap-4">
                                <button className="px-5 py-2.5 bg-gray-100 dark:bg-ios-dark-gray6 text-gray-700 dark:text-gray-300 font-medium rounded-full border border-gray-200 dark:border-white/5 hover:bg-gray-200 dark:hover:bg-ios-dark-gray4 transition-colors">
                                    清除快取
                                </button>
                                <button className="px-5 py-2.5 bg-gray-100 dark:bg-ios-dark-gray6 text-gray-700 dark:text-gray-300 font-medium rounded-full border border-gray-200 dark:border-white/5 hover:bg-gray-200 dark:hover:bg-ios-dark-gray4 transition-colors">
                                    重建索引
                                </button>
                                <button className="px-5 py-2.5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 font-medium rounded-full hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors ml-auto">
                                    重啟服務
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
