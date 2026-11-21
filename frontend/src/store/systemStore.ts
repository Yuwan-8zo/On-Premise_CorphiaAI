import { create } from 'zustand'

import { fetchHealth, type HealthStatus, isLlmReady } from '@/api/health'

interface SystemState {
    health: HealthStatus | null
    /** 最近一次檢查是否連得上後端（null＝還沒檢查過） */
    online: boolean | null
    /** 連續幾次檢查都連不上（AI 回答時主機回得慢，偶爾一次逾時不算斷線） */
    failStreak: number
    /** 真的斷線了：連續 OFFLINE_AFTER 次連不上，或瀏覽器自己說沒有網路 */
    offline: boolean
    pollStarted: boolean
    startHealthPolling: () => void
    stopHealthPolling: () => void
    refreshHealth: () => Promise<void>
}

let pollTimer: ReturnType<typeof setInterval> | null = null

/** 連續幾次檢查失敗才算斷線 */
export const OFFLINE_AFTER = 2
const browserOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false

export const useSystemStore = create<SystemState>((set, get) => ({
    health: null,
    online: null,
    failStreak: 0,
    offline: false,
    pollStarted: false,

    refreshHealth: async () => {
        try {
            const health = await fetchHealth()
            set({ health, online: true, failStreak: 0, offline: browserOffline() })
        } catch {
            const failStreak = get().failStreak + 1
            set({ online: false, failStreak, offline: failStreak >= OFFLINE_AFTER || browserOffline() })
            // The backend answers slowly while the model is generating; a single
            // timed-out poll must not flip the UI back to "model loading".
            // Only clear the state if we never had a successful reading.
            if (!get().health) set({ health: null })
        }
    },

    startHealthPolling: () => {
        if (get().pollStarted) return
        set({ pollStarted: true })

        const tick = () => {
            if (typeof document !== 'undefined' && document.hidden) return
            void get().refreshHealth()
        }

        void tick()
        pollTimer = setInterval(tick, 3000)
        // 瀏覽器的網路狀態一變就馬上檢查，不用等下一輪
        if (typeof window !== 'undefined') {
            window.addEventListener('online', () => void get().refreshHealth())
            window.addEventListener('offline', () => set({ offline: true }))
        }
    },

    stopHealthPolling: () => {
        if (pollTimer) {
            clearInterval(pollTimer)
            pollTimer = null
        }
        set({ pollStarted: false })
    },
}))

export function selectLlmReady(state: SystemState): boolean {
    return isLlmReady(state.health)
}
