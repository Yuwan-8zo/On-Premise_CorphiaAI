import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * frontend-demo/vite.config.ts
 *
 * 關鍵策略：
 * 1. `@/api/*`  → 本專案的 src/api/*（mock 版本，優先匹配）
 * 2. `@/*`      → ../frontend/src/*（實際 UI 元件，共用，不複製）
 *
 * Vite alias 是「第一個匹配優先」，所以 @/api 放在 @ 前面就能蓋掉 API。
 */
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: [
            // ① Mock API — 優先：這個資料夾裡的 mock 覆蓋原本的 API 呼叫
            {
                find: /^@\/api\/(.*)/,
                replacement: path.resolve(__dirname, './src/api/$1'),
            },
            // ② Demo 專屬資料夾
            {
                find: /^@\/demo\/(.*)/,
                replacement: path.resolve(__dirname, './src/demo/$1'),
            },
            // ③ 其餘所有 @/* → 指向真實 frontend/src（UI 元件、store、hooks 都在這）
            {
                find: '@',
                replacement: path.resolve(__dirname, '../frontend/src'),
            },
        ],
    },
    server: {
        port: 5174,
        allowedHosts: true,
        hmr: { overlay: false },
        // Demo 不需要 proxy，所有 API 已被 mock 取代
    },
    // Tailwind 需要掃描真實 frontend 的 src
    // 這裡用 css preprocessor 處理，tailwind.config.js 已設定 content 路徑
})
