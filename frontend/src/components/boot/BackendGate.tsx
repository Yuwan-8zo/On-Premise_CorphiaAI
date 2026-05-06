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

import { useState, type ReactNode } from 'react'
import BackendBootSplash from './BackendBootSplash'

interface BackendGateProps {
    children: ReactNode
}

export default function BackendGate({ children }: BackendGateProps) {
    const [isReady, setIsReady] = useState(false)

    if (!isReady) {
        return <BackendBootSplash onReady={() => setIsReady(true)} />
    }

    return <>{children}</>
}
