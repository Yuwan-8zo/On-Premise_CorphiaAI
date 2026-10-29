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
                manualChunks(id) {
                    if (!id.includes('node_modules'))
                        return;
                    if (id.includes('react-dom') || id.includes('react/'))
                        return 'react-vendor';
                    if (id.includes('react-router'))
                        return 'router';
                    if (id.includes('zustand'))
                        return 'state';
                    if (id.includes('gsap'))
                        return 'gsap';
                    if (id.includes('/motion/') || id.includes('motion/dist'))
                        return 'motion';
                    if (id.includes('react-markdown')
                        || id.includes('remark-gfm')
                        || id.includes('react-syntax-highlighter')) {
                        return 'markdown';
                    }
                    if (id.includes('recharts'))
                        return 'charts';
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
        allowedHosts: true,
        hmr: {
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
