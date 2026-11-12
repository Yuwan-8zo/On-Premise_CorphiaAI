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
import { usePolling } from './usePolling'

/** 區網狀態與本機 IP 的重讀間隔 */
const LAN_REFRESH_MS = 5000

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
    // 第一次讀完之前顯示佔位，不先顯示「待機中」
    const [modelsLoaded, setModelsLoaded] = useState(false)

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
            setModelsLoaded(true)
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

    return { models, modelsDir, isLoadingModels, modelsLoaded, currentModel, loadModels, onRefreshModels, onSelectModel }
}

/** 區域網路開關（切換立即生效） */
export function useLanStatus() {
    const { t } = useTranslation()
    // null＝還沒讀到狀態：畫面顯示佔位，不先畫成「關閉」再滑到「開啟」
    const [enabled, setEnabled] = useState<boolean | null>(null)
    const [lanIps, setLanIps] = useState<string[]>([])
    const [isLoading, setIsLoading] = useState(false)

    const apply = (s: { enabled?: boolean; lan_ips?: unknown }) => {
        setEnabled(Boolean(s.enabled))
        setLanIps(Array.isArray(s.lan_ips) ? s.lan_ips : [])
    }

    // 定時重讀：電腦換網路（例如改連手機熱點）後，本機 IP 和 QR code 幾秒內就跟著更新
    const { data: lanStatus } = usePolling(systemApi.getLanStatus, LAN_REFRESH_MS)
    useEffect(() => {
        if (lanStatus) apply(lanStatus)
    }, [lanStatus])

    const onToggle = async (next: boolean) => {
        setIsLoading(true)
        try {
            apply(await systemApi.toggleLan(next))
            useToastStore.getState().info(next
                ? t('admin.lan.onHint', '已開啟區域網路，同一個網路的手機可以掃 QR code 連線')
                : t('admin.lan.offHint', '已關閉區域網路，現在只有這台電腦可以使用'))
        } catch (err) {
            console.error('Failed to toggle LAN:', err)
            useToastStore.getState().error(getErrorMessage(err))
        } finally {
            setIsLoading(false)
        }
    }

    return { enabled, lanIps, isLoading, onToggle }
}
