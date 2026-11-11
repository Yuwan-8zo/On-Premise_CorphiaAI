import { systemApi } from '@/api/system'
import { useSharedPolling } from './usePolling'

/** 系統健康資料（LLM、CPU、記憶體）：後台各卡片共用同一次輪詢，每 5 秒更新 */
export const HEALTH_POLL_MS = 5000

export function useHealthDetailed() {
    return useSharedPolling('system-health-detailed', systemApi.getHealthDetailed, HEALTH_POLL_MS)
}
