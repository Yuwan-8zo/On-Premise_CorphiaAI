/**
 * 經過時間的顯示：滿一分鐘才出現「分」
 */
import { describe, expect, it } from 'vitest'
import { formatElapsed } from '@/lib/formatElapsed'

const t = (key: string, vars?: Record<string, unknown>) =>
  key === 'ui.boot.minSec' ? `${vars?.m} 分 ${vars?.s} 秒` : `${vars?.s} 秒`

describe('formatElapsed', () => {
  it.each([
    [0, '0 秒'],
    [59, '59 秒'],
    [60, '1 分 0 秒'],
    [210, '3 分 30 秒'],
    [3725, '62 分 5 秒'],
    [12.9, '12 秒'],
    [-3, '0 秒'],
  ])('%s 秒 → %s', (seconds, expected) => {
    expect(formatElapsed(seconds, t)).toBe(expected)
  })
})
