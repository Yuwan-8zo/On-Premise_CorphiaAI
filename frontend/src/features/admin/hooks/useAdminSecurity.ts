/**
 * 後台「資安閘道」分頁的資料與動作：各關的開關與近 7 天命中次數、語意檢查門檻、門檻規劃器要的分數
 * 改開關／門檻只有工程師可以（後端也會擋）；其他角色看得到，開關是停用狀態
 */
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { adminApi, type SecurityGateKey, type SecurityGatesData, type SemanticScoresData } from '@/api/admin'
import { getErrorMessage } from '@/lib/errors'
import { useToastStore } from '@/store/toastStore'

export function useAdminSecurity() {
    const { t } = useTranslation()
    /** null＝還沒讀到 */
    const [gates, setGates] = useState<SecurityGatesData | null>(null)
    const [scores, setScores] = useState<SemanticScoresData | null>(null)
    const [loadError, setLoadError] = useState('')
    /** 正在送出的開關（那一顆顯示讀取中） */
    const [busyKey, setBusyKey] = useState<SecurityGateKey | null>(null)
    const [savingThresholds, setSavingThresholds] = useState(false)

    const load = useCallback(async () => {
        try {
            const [g, s] = await Promise.all([adminApi.getSecurityGates(), adminApi.getSemanticScores()])
            setGates(g)
            setScores(s)
            setLoadError('')
        } catch (err) {
            setLoadError(getErrorMessage(err))
        }
    }, [])

    const toggle = async (key: SecurityGateKey) => {
        if (!gates?.can_edit || busyKey) return
        const next = !gates.enabled[key]
        setBusyKey(key)
        try {
            const cfg = await adminApi.updateSecurityGates({ enabled: { [key]: next } })
            if (cfg) setGates((g) => (g ? { ...g, ...cfg } : g))
            useToastStore.getState().info(t(next ? 'admin.security.turnedOn' : 'admin.security.turnedOff', { name: t(`admin.security.gate.${key}.name`) }))
        } catch (err) {
            useToastStore.getState().error(getErrorMessage(err))
        } finally {
            setBusyKey(null)
        }
    }

    const saveThresholds = async (review: number, block: number) => {
        if (!gates?.can_edit) return false
        setSavingThresholds(true)
        try {
            const cfg = await adminApi.updateSecurityGates({ semantic_review: review, semantic_block: block })
            if (cfg) {
                setGates((g) => (g ? { ...g, ...cfg } : g))
                setScores((s) => (s ? { ...s, ...cfg } : s))
            }
            useToastStore.getState().success(t('admin.security.thresholdSaved'))
            return true
        } catch (err) {
            useToastStore.getState().error(getErrorMessage(err))
            return false
        } finally {
            setSavingThresholds(false)
        }
    }

    return { gates, scores, loadError, busyKey, savingThresholds, load, toggle, saveThresholds }
}

export type AdminSecurity = ReturnType<typeof useAdminSecurity>
