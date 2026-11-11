/**
 * 後台的系統資料：總數統計、AI 模型清單（切換／重新掃描）、區域網路開關
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { adminApi } from '@/api/admin'
import { getModels, refreshModels, selectModel, type ModelItem } from '@/api/models'
import { systemApi } from '@/api/system'
import { getErrorMessage } from '@/lib/errors'
import { useToastStore } from '@/store/toastStore'

export interface Stats {
    totalUsers: number
    totalConversations: number
    totalDocuments: number
    totalMessages: number
}

/** 總數統計 */
export function useAdminStats() {
    const [stats, setStats] = useState<Stats>({ totalUsers: 0, totalConversations: 0, totalDocuments: 0, totalMessages: 0 })
    useEffect(() => {
        adminApi.getStats()
            .then((data) => { if (data) setStats(data) })
            .catch((err) => console.error('Failed to load admin stats:', err))
    }, [])
    return stats
}

/** AI 模型清單 */
export function useAdminModels() {
    const [models, setModels] = useState<ModelItem[]>([])
    const [modelsDir, setModelsDir] = useState('')
    const [isLoadingModels, setIsLoadingModels] = useState(false)

    const loadModels = useCallback(async () => {
        setIsLoadingModels(true)
        try {
            const data = await getModels()
            setModels(data.models)
            setModelsDir(data.models_dir)
        } catch (err) {
            console.error('Failed to load models:', err)
        } finally {
            setIsLoadingModels(false)
        }
    }, [])

    const onRefreshModels = async () => {
        setIsLoadingModels(true)
        try {
            setModels((await refreshModels()).models)
        } catch (err) {
            console.error('Failed to refresh models:', err)
        } finally {
            setIsLoadingModels(false)
        }
    }

    const onSelectModel = async (name: string) => {
        try {
            await selectModel(name)
            loadModels()
        } catch (err) {
            console.error('Failed to select model:', err)
        }
    }

    const currentModel = useMemo(() => models.find((m) => m.is_current), [models])

    return { models, modelsDir, isLoadingModels, currentModel, loadModels, onRefreshModels, onSelectModel }
}

/** 區域網路開關（切換後要重新啟動系統才會生效） */
export function useLanStatus() {
    const { t } = useTranslation()
    const [enabled, setEnabled] = useState(false)
    const [lanIps, setLanIps] = useState<string[]>([])
    const [isLoading, setIsLoading] = useState(false)

    const apply = (s: { enabled?: boolean; lan_ips?: unknown }) => {
        setEnabled(Boolean(s.enabled))
        setLanIps(Array.isArray(s.lan_ips) ? s.lan_ips : [])
    }

    useEffect(() => {
        setIsLoading(true)
        systemApi.getLanStatus()
            .then(apply)
            .catch((err) => console.error('Failed to load LAN status:', err))
            .finally(() => setIsLoading(false))
    }, [])

    const onToggle = async (next: boolean) => {
        setIsLoading(true)
        try {
            apply(await systemApi.toggleLan(next))
            useToastStore.getState().info(t('admin.lan.restartHint', '已更新區域網路設定。請重啟 start.py（或重啟後端/前端）後才會生效。'))
        } catch (err) {
            console.error('Failed to toggle LAN:', err)
            useToastStore.getState().error(getErrorMessage(err))
        } finally {
            setIsLoading(false)
        }
    }

    return { enabled, lanIps, isLoading, onToggle }
}
