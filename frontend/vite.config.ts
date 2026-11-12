import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import lanGate from './vite-plugins/lanGate'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
    // lanGate：區域網路開關即時生效（讀專案根目錄的 .runtime/lan.json）
    plugins: [react(), lanGate(path.resolve(__dirname, '../.runtime'))],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    // Vitest 測試配置
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        css: false,
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (!id.includes('node_modules')) return
                    if (id.includes('react-dom') || id.includes('react/')) return 'react-vendor'
                    if (id.includes('react-router')) return 'router'
                    if (id.includes('zustand')) return 'state'
                    if (id.includes('gsap')) return 'gsap'
                    if (id.includes('/motion/') || id.includes('motion/dist')) return 'motion'
                    if (
                        id.includes('react-markdown')
                        || id.includes('remark-gfm')
                        || id.includes('react-syntax-highlighter')
                    ) {
                        return 'markdown'
                    }
                    if (id.includes('recharts')) return 'charts'
                },
            },
        },
        minify: 'esbuild',
        target: 'esnext',
    },
    // BUG-06 修正：僅在 production build 時移除 console/debugger，開發模式保留完整 debug 輸出
    esbuild: mode === 'production' ? { drop: ['console', 'debugger'] } : {},
    server: {
        port: 5173,
        // 一律聽所有網路介面；要不要讓區網裝置進來，由 lanGate 依開關即時決定
        host: '0.0.0.0',
        allowedHosts: true,
        hmr: {
            overlay: false,
        },
        proxy: {
            // xfwd：把連進來的手機／電腦 IP 加在 X-Forwarded-For 最右邊轉給後端
            // （不然所有區網裝置在後端都是 127.0.0.1：稽核紀錄分不出誰、請求次數限制大家共用一份）
            '/api': {
                target: 'http://127.0.0.1:8168',
                changeOrigin: true,
                xfwd: true,
            },
            '/ws': {
                target: 'ws://127.0.0.1:8168',
                ws: true,
                changeOrigin: true,
                xfwd: true,
            },
        },
    },
}))
