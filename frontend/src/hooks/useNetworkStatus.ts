/**
 * useNetworkStatus — 監聽瀏覽器是否連得上外部網路。
 *
 * 用法：
 *   const isOnline = useNetworkStatus()
 *   if (!isOnline) showToast('請先連網')
 *
 * 為什麼存在：
 *   Corphia AI 主體（前端 + 後端 + LLM + RAG）100% 地端可用，
 *   但「公開網址（ngrok）」這項功能本質上需要建立到外部 ngrok 服務的
 *   通道，使用者離線時點下去會掛 20 秒等 timeout 然後失敗，體感很差。
 *   這個 hook 讓 UI 提早攔下來、顯示提示，不打 API。
 *
 * 偵測機制（兩層）：
 *   1. navigator.onLine：瀏覽器層的旗標，立即可讀。
 *      限制：只看本機是否有「任何」網卡連著（含內網），無法保證能到 internet。
 *   2. online / offline events：當網卡狀態變化時瀏覽器主動派發。
 *
 * 為什麼不額外 ping 外部 endpoint 驗證：
 *   - Corphia AI 強調「100% 地端可用」，主動向外部送封包違反設計原則
 *   - navigator.onLine = false 已能涵蓋「明確離線」這個多數場景
 *   - 內網能通但外網不通的邊緣情境：使用者按下後仍會失敗，
 *     交給 systemApi.startNgrok() 自己的 timeout / error catch 處理
 */

import { useEffect, useState } from 'react'

export function useNetworkStatus(): boolean {
    // SSR 安全：navigator 在伺服器端不存在
    const [isOnline, setIsOnline] = useState<boolean>(() => {
        if (typeof navigator === 'undefined') return true
        return navigator.onLine
    })

    useEffect(() => {
        if (typeof window === 'undefined') return

        const handleOnline = () => setIsOnline(true)
        const handleOffline = () => setIsOnline(false)

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        // 掛載時校準一次（覆蓋 SSR 預設值）
        setIsOnline(navigator.onLine)

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [])

    return isOnline
}

export default useNetworkStatus
