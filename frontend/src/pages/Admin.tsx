/**
 * 管理後台頁面
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { getModels, refreshModels, selectModel, ModelItem } from '../api/models'

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
            // 模擬 API 呼叫，實際應該從後端取得
            setStats({
                totalUsers: 12,
                totalConversations: 156,
                totalDocuments: 45,
                totalMessages: 1289,
            })
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
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center text-white`}>
                    {icon}
                </div>
                <div>
                    <p className="text-2xl font-bold text-slate-800 dark:text-white">{value.toLocaleString()}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
                </div>
            </div>
        </div>
    )

    const RoleBadge = ({ role }: { role: UserData['role'] }) => {
        const styles = {
            admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
            engineer: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
            user: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300',
        }
        return (
            <span className={`px-2 py-0.5 text-xs rounded-full ${styles[role]}`}>
                {role}
            </span>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
            {/* 頂部導覽列 */}
            <header className="h-14 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 bg-white dark:bg-slate-900">
                <div className="flex items-center">
                    <button
                        onClick={() => navigate('/')}
                        className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg mr-2"
                    >
                        <BackIcon />
                    </button>
                    <h1 className="text-lg font-semibold text-slate-800 dark:text-white">
                        🛡️ {t('nav.admin')}
                    </h1>
                </div>
                <button
                    onClick={toggleTheme}
                    className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                    {theme === 'dark' ? '☀️' : '🌙'}
                </button>
            </header>

            <div className="max-w-6xl mx-auto p-6">
                {/* 分頁標籤 */}
                <div className="flex gap-2 mb-6">
                    {(['overview', 'users', 'models', 'system'] as AdminSection[]).map((section) => (
                        <button
                            key={section}
                            onClick={() => setActiveSection(section)}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeSection === section
                                ? 'bg-primary-600 text-white'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
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
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <StatCard
                                icon={<UsersIcon />}
                                label="總使用者"
                                value={stats.totalUsers}
                                color="bg-primary-500"
                            />
                            <StatCard
                                icon={<ChatIcon />}
                                label="總對話"
                                value={stats.totalConversations}
                                color="bg-green-500"
                            />
                            <StatCard
                                icon={<DocumentIcon />}
                                label="總文件"
                                value={stats.totalDocuments}
                                color="bg-orange-500"
                            />
                            <StatCard
                                icon={<MessageIcon />}
                                label="總訊息"
                                value={stats.totalMessages}
                                color="bg-purple-500"
                            />
                        </div>

                        {/* 最近活動 */}
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                            <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">
                                最近活動
                            </h2>
                            <div className="text-slate-500 dark:text-slate-400 text-center py-8">
                                暫無活動記錄
                            </div>
                        </div>
                    </div>
                )}

                {/* 使用者管理 */}
                {activeSection === 'users' && (
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                            <h2 className="font-semibold text-slate-800 dark:text-white">
                                使用者列表 ({users.length})
                            </h2>
                            <button className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-lg transition-colors">
                                + 新增使用者
                            </button>
                        </div>

                        {isLoading ? (
                            <div className="p-8 text-center text-slate-500">載入中...</div>
                        ) : (
                            <table className="w-full">
                                <thead className="bg-slate-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            使用者
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            角色
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            狀態
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            最後登入
                                        </th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            操作
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {users.map((u) => (
                                        <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-medium">
                                                        {u.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-slate-800 dark:text-white">{u.name}</p>
                                                        <p className="text-sm text-slate-500 dark:text-slate-400">{u.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <RoleBadge role={u.role} />
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1 text-sm ${u.isActive ? 'text-green-600 dark:text-green-400' : 'text-slate-500'
                                                    }`}>
                                                    <span className={`w-2 h-2 rounded-full ${u.isActive ? 'bg-green-500' : 'bg-slate-400'}`} />
                                                    {u.isActive ? '啟用' : '停用'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                                                {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('zh-TW') : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button className="text-primary-600 hover:text-primary-700 dark:text-primary-400 text-sm">
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
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                                        🤖 LLM 模型
                                    </h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                        目錄: {modelsDir}
                                    </p>
                                </div>
                                <button
                                    onClick={handleRefreshModels}
                                    disabled={isLoadingModels}
                                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                                >
                                    {isLoadingModels ? '掃描中...' : '🔄 重新掃描'}
                                </button>
                            </div>

                            {isLoadingModels ? (
                                <div className="text-center py-8 text-slate-500">載入中...</div>
                            ) : models.length === 0 ? (
                                <div className="text-center py-8">
                                    <p className="text-slate-500 dark:text-slate-400">
                                        未找到 GGUF 模型檔案
                                    </p>
                                    <p className="text-sm text-slate-400 mt-2">
                                        請將 .gguf 模型放入 ai_model 目錄
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {models.map((model) => (
                                        <div
                                            key={model.name}
                                            className={`p-4 rounded-lg border ${model.is_current
                                                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="font-medium text-slate-800 dark:text-white">
                                                            {model.name}
                                                        </h3>
                                                        {model.is_current && (
                                                            <span className="px-2 py-0.5 text-xs bg-primary-500 text-white rounded-full">
                                                                使用中
                                                            </span>
                                                        )}
                                                        {model.quantization && (
                                                            <span className="px-2 py-0.5 text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded">
                                                                {model.quantization}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-4 mt-1 text-sm text-slate-500 dark:text-slate-400">
                                                        <span>{model.size_gb} GB</span>
                                                        <span>檔案: {model.filename}</span>
                                                    </div>
                                                </div>
                                                {!model.is_current && (
                                                    <button
                                                        onClick={() => handleSelectModel(model.name)}
                                                        className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
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

                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                            <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-3">
                                如何添加新模型
                            </h2>
                            <ol className="list-decimal list-inside space-y-2 text-sm text-slate-600 dark:text-slate-400">
                                <li>從 Hugging Face 下載 GGUF 格式的模型</li>
                                <li>將檔案放入 <code className="px-1 bg-slate-100 dark:bg-slate-700 rounded">ai_model/</code> 目錄</li>
                                <li>點擊「重新掃描」按鈕</li>
                                <li>選擇要使用的模型</li>
                            </ol>
                        </div>
                    </div>
                )}

                {/* 系統資訊 */}
                {activeSection === 'system' && (
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                            <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">
                                系統資訊
                            </h2>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-slate-500 dark:text-slate-400">版本</p>
                                    <p className="text-slate-800 dark:text-white font-medium">2.2.0</p>
                                </div>
                                <div>
                                    <p className="text-slate-500 dark:text-slate-400">後端</p>
                                    <p className="text-slate-800 dark:text-white font-medium">FastAPI</p>
                                </div>
                                <div>
                                    <p className="text-slate-500 dark:text-slate-400">LLM Engine</p>
                                    <p className="text-slate-800 dark:text-white font-medium">llama.cpp</p>
                                </div>
                                <div>
                                    <p className="text-slate-500 dark:text-slate-400">向量資料庫</p>
                                    <p className="text-slate-800 dark:text-white font-medium">ChromaDB</p>
                                </div>
                                <div>
                                    <p className="text-slate-500 dark:text-slate-400">資料庫</p>
                                    <p className="text-slate-800 dark:text-white font-medium">SQLite</p>
                                </div>
                                <div>
                                    <p className="text-slate-500 dark:text-slate-400">Python</p>
                                    <p className="text-slate-800 dark:text-white font-medium">3.10+</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                            <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">
                                維護操作
                            </h2>
                            <div className="flex gap-3">
                                <button className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                                    清除快取
                                </button>
                                <button className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                                    重建索引
                                </button>
                                <button className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors">
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
