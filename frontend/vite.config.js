import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
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
                    motion: ['framer-motion'],
                    markdown: ['react-markdown', 'remark-gfm', 'react-syntax-highlighter']
                }
            }
        },
        minify: 'esbuild',
        target: 'esnext'
    },
    esbuild: {
        drop: ['console', 'debugger']
    },
    server: {
        port: 5173,
        allowedHosts: true,
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:8168',
                changeOrigin: true,
            },
            '/ws': {
                target: 'ws://127.0.0.1:8168',
                ws: true,
            },
        },
    },
});
