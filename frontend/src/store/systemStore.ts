import { create } from 'zustand'

import { fetchHealth, type HealthStatus, isLlmReady } from '@/api/health'

interface SystemState {
    health: HealthStatus | null
    pollStarted: boolean
    startHealthPolling: () => void
    stopHealthPolling: () => void
    refreshHealth: () => Promise<void>
}

let pollTimer: ReturnType<typeof setInterval> | null = null

export const useSystemStore = create<SystemState>((set, get) => ({
    health: null,
    pollStarted: false,

    refreshHealth: async () => {
        try {
            const health = await fetchHealth()
            set({ health })
        } catch {
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
