import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
    plugins: [react()],
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
                manualChunks: {
                    vendor: ['react', 'react-dom'],
                    router: ['react-router-dom'],
                    state: ['zustand'],
                    motion: ['gsap', '@gsap/react'],
                    markdown: ['react-markdown', 'remark-gfm', 'react-syntax-highlighter']
                }
            }
        },
        minify: 'esbuild',
        target: 'esnext'
    },
    // BUG-06 修正：僅在 production build 時移除 console/debugger，開發模式保留完整 debug 輸出
    esbuild: mode === 'production' ? { drop: ['console', 'debugger'] } : {},
    server: {
        port: 5173,
        allowedHosts: true,
        hmr: {
            // NOTE: overlay: false 避免在 ngrok / 遠端存取時因 HMR 連線失敗顯示錯誤彈窗
            // HMR 本地仍正常運作；ngrok 環境下 HMR 無法作用但不影響應用功能
            overlay: false,
        },
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:8168',
                changeOrigin: true,
            },
            '/ws': {
                target: 'ws://127.0.0.1:8168',
                ws: true,
                changeOrigin: true,
            },
        },
    },
}));
