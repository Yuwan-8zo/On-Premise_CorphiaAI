/**
 * BackendGate — 後端 ready 之前蓋住所有路由
 * ===============================================
 *
 * 包在 <Routes> 外面：
 *   <BackendGate>
 *     <Routes>...</Routes>
 *   </BackendGate>
 *
 * 內部用 BackendBootSplash 顯示啟動畫面，輪詢 /api/v1/health。
 * Backend 回 200 後 ready 設為 true，children 就會渲染。
 *
 * 為什麼用單獨 component 不寫在 App.tsx：
 *   - 隔離 splash 邏輯，App.tsx 已經夠長
 *   - 之後可選擇改成全域 store（如果有別的地方也要知道 backend 狀態）
 */

import { useEffect, useState, type ReactNode } from 'react'

import { useSystemStore } from '@/store/systemStore'

import BackendBootSplash from './BackendBootSplash'
import { SkelPage } from '@/components/ui/SkelPages'

interface BackendGateProps {
    children: ReactNode
}

export default function BackendGate({ children }: BackendGateProps) {
    const [isReady, setIsReady] = useState(false)

    if (!isReady) {
        return (
            <BackendBootSplash
                onReady={() => {
                    useSystemStore.getState().startHealthPolling()
                    setIsReady(true)
                }}
            />
        )
    }

    return (
        <>
            {children}
            <SkelFadeOverlay />
        </>
    )
}

/** 啟動骨架 → 真正內容：骨架留在最上層 0.42 秒淡出後移除 */
function SkelFadeOverlay() {
    const [show, setShow] = useState(true)
    useEffect(() => {
        const t = window.setTimeout(() => setShow(false), 460)
        return () => window.clearTimeout(t)
    }, [])
    if (!show) return null
    return (
        <div className="skel-fade-out" aria-hidden>
            <SkelPage />
        </div>
    )
}
