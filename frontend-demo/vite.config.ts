import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { viteSingleFile } from 'vite-plugin-singlefile'

/**
 * frontend-demo/vite.config.ts
 *
 * 策略：
 *   @/api/*  → ./src/api/*   (mock API，優先)
 *   @/demo/* → ./src/demo/*  (demo 元件)
 *   @/*      → ../frontend/src/*  (真實 UI 元件，共用不複製)
 *
 * build 使用 vite-plugin-singlefile → 輸出單一 index.html（所有 JS/CSS 內嵌）
 * 雙擊即可在瀏覽器開啟，不需要任何伺服器。
 */
export default defineConfig({
    plugins: [
        react(),
        viteSingleFile(), // 輸出單一 HTML，所有資源 inline
    ],
    resolve: {
        alias: [
            // ① Mock API — 優先蓋掉真實 API
            { find: /^@\/api\/(.*)/, replacement: path.resolve(__dirname, './src/api/$1') },
            // ② GSAP mock — 避免 registerPlugin 在 bundle 環境報錯
            { find: /^@\/lib\/gsap$/, replacement: path.resolve(__dirname, './src/lib/gsap') },
            { find: /^@\/lib\/gsapMotion$/, replacement: path.resolve(__dirname, './src/lib/gsapMotion') },
            // ③ Demo 元件
            { find: /^@\/demo\/(.*)/, replacement: path.resolve(__dirname, './src/demo/$1') },
            // ④ 其餘所有 @/* → 真實 frontend/src
            { find: '@', replacement: path.resolve(__dirname, '../frontend/src') },
        ],
    },
    build: {
        outDir: 'dist',
        // vite-plugin-singlefile 需要這些設定
        assetsInlineLimit: 100 * 1024 * 1024, // 所有資源都 inline（不管大小）
        cssCodeSplit: false,
        rollupOptions: {
            output: {
                inlineDynamicImports: true, // lazy import 也 inline
            },
        },
        target: 'esnext',
    },
    css: {
        preprocessorOptions: {},
    },
    server: {
        port: 5174,
        allowedHosts: true,
        hmr: { overlay: false },
    },
})
