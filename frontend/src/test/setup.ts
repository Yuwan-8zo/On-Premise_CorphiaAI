/**
 * 前端測試全域初始化設定
 *
 * 在每個測試檔案執行前自動載入：
 * - @testing-library/jest-dom 的 DOM 自定義 matcher
 * - MSW (Mock Service Worker) 的初始化配置
 */

import '@testing-library/jest-dom'
import { server } from './mocks/server'

// ── MSW 生命週期 ──────────────────────────────────────────────
// 在所有測試開始前啟動 mock server
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))

// 每個測試結束後重置 handler（避免 handler 狀態殘留影響下一個測試）
afterEach(() => server.resetHandlers())

// 所有測試完成後關閉 mock server
afterAll(() => server.close())
