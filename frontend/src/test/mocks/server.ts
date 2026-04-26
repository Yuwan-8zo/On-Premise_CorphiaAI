/**
 * MSW Node.js Server 配置
 *
 * 在 Vitest (Node 環境) 下使用 setupServer，
 * 提供給 setup.ts 啟動/重置/關閉的生命週期管理。
 */

import { setupServer } from 'msw/node'
import { handlers } from './handlers'

/** 測試用 Mock API Server */
export const server = setupServer(...handlers)
