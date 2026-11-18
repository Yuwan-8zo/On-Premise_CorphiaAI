/**
 * SecuritySection：後台「資安閘道」分頁（規則清單、門檻規劃器）
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { SecurityGatesData, SemanticScoresData } from '@/api/admin'
import type { AdminSecurity } from '@/features/admin/hooks/useAdminSecurity'

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string, o?: Record<string, unknown>) => (o && 'n' in o ? `${key}:${o.n}` : key) }),
    initReactI18next: { type: '3rdParty', init: () => {} },
}))

import SecuritySection from '@/features/admin/sections/SecuritySection'

const enabled = { pii: true, dlp: true, injection: true, semantic: false, llm_judge: true, context: true, output: true }
const cfg = { enabled, semantic_block: 0.8, semantic_review: 0.5, semantic_margin: 0.1 }
const daily = [0, 1, 0, 2, 0, 0, 3]

function makeGates(can_edit: boolean): SecurityGatesData {
    return {
        ...cfg,
        window_days: 7,
        depends_on: { llm_judge: 'semantic' },
        messages: 120,
        messages_previous: 100,
        can_edit,
        gates: [
            { key: 'pii', counted: true, hits: 6, previous: 2, daily, daily_previous: daily },
            { key: 'dlp', counted: true, hits: 3, previous: 3, daily, daily_previous: daily },
            { key: 'injection', counted: true, hits: 1, previous: 0, daily, daily_previous: daily },
            { key: 'semantic', counted: true, hits: 0, previous: 0, daily, daily_previous: daily },
            { key: 'llm_judge', counted: true, hits: 0, previous: 0, daily, daily_previous: daily },
            { key: 'context', counted: false },
            { key: 'output', counted: false },
        ],
    }
}
const scores: SemanticScoresData = { ...cfg, keep: 600, scores: [[0.9, 0.2], [0.6, 0.3], [0.2, 0.1], [0.1, 0.1]] }

function makeSecurity(can_edit: boolean, over: Partial<AdminSecurity> = {}): AdminSecurity {
    return {
        gates: makeGates(can_edit), scores, loadError: '', busyKey: null, savingThresholds: false,
        load: vi.fn(async () => {}), toggle: vi.fn(async () => {}), saveThresholds: vi.fn(async () => true),
        ...over,
    }
}

/** 分段切換器的滑鼠操作走 pointer 事件；測試用鍵盤（Enter）切到「門檻」 */
async function openThresholds() {
    screen.getByRole('tab', { name: 'admin.security.tabThresholds' }).focus()
    await userEvent.keyboard('{Enter}')
}

describe('SecuritySection', () => {
    it('每一道閘道一列，次數照後端，不記次數的那兩道顯示「不記次數」', () => {
        render(<SecuritySection security={makeSecurity(true)} />)
        expect(screen.getAllByRole('switch')).toHaveLength(7)
        // 桌機在右邊一欄、手機在描述下面一行（測試環境不套 CSS，兩個都在）
        expect(screen.getAllByText('admin.security.hits:6').length).toBeGreaterThan(0)
        expect(screen.getAllByText('admin.security.notCounted')).toHaveLength(4)
    })

    it('語意比對關掉時，模型複查的開關停用並說明要先開哪一關', () => {
        render(<SecuritySection security={makeSecurity(true)} />)
        const judge = screen.getAllByRole('switch')[4] as HTMLButtonElement   // 順序：pii dlp injection semantic llm_judge …
        expect(judge.disabled).toBe(true)
        expect(screen.getByText('admin.security.needsParent')).toBeTruthy()
    })

    it('工程師點開關會呼叫 toggle；管理員只能看', async () => {
        const sec = makeSecurity(true)
        const { unmount } = render(<SecuritySection security={sec} />)
        await userEvent.click(screen.getAllByRole('switch')[0])
        expect(sec.toggle).toHaveBeenCalledWith('pii')
        unmount()

        render(<SecuritySection security={makeSecurity(false)} />)
        expect(screen.getByText('admin.security.viewOnly')).toBeTruthy()
        screen.getAllByRole('switch').forEach((s) => expect((s as HTMLButtonElement).disabled).toBe(true))
    })

    it('門檻頁：三格比例照目前設定算，方向鍵移動把手後可以儲存', async () => {
        const sec = makeSecurity(true)
        render(<SecuritySection security={sec} />)
        await openThresholds()
        // 4 則：放行 2、複查 1、攔阻 1
        expect(screen.getByText(/admin.security.zoneCount:2/)).toBeTruthy()
        const save = screen.getByText('common.save').closest('button') as HTMLButtonElement
        expect(save.disabled).toBe(true)
        const high = screen.getByRole('slider', { name: 'admin.security.blockThreshold' })
        high.focus()
        await userEvent.keyboard('{ArrowLeft}')
        expect(high.getAttribute('aria-valuenow')).toBe('0.79')
        expect(save.disabled).toBe(false)
        await userEvent.click(save)
        expect(sec.saveThresholds).toHaveBeenCalledWith(0.5, 0.79)
    })

    it('把手不能交叉：複查門檻推不過攔阻門檻', async () => {
        render(<SecuritySection security={makeSecurity(true)} />)
        await openThresholds()
        const low = screen.getByRole('slider', { name: 'admin.security.reviewThreshold' })
        low.focus()
        await userEvent.keyboard('{End}')
        expect(low.getAttribute('aria-valuenow')).toBe('0.79')
    })
})
