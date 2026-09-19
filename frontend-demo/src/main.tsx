/**
 * frontend-demo/src/main.tsx
 *
 * Demo 專案的進入點：
 * - 永遠是「已登入」狀態（mock 使用者）
 * - 不需要後端，所有 API 走 mock
 * - 啟動後直接進入 chat 頁面
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// i18n — 透過 alias 載入真實 frontend 的語系設定（翻譯已靜態 import，可打包）
import '@/i18n/index'

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <BrowserRouter
            future={{
                v7_startTransition: true,
                v7_relativeSplatPath: true,
            }}
        >
            <App />
        </BrowserRouter>
    </StrictMode>,
)
