/**
 * 旁邊的顯示面板：開啟、切換版本、新版本自動跟上、關閉、內容消失時的處理
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) => (vars ? `${key}:${JSON.stringify(vars)}` : key),
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}))

import SidePanel from '@/features/chat/components/SidePanel'
import { useSidePanelItem } from '@/features/chat/hooks/useSidePanelItem'
import { orderedItems, useSidePanelStore } from '@/store/sidePanelStore'
import { useUIStore } from '@/store/uiStore'

const RESULT = { ok: true, stdout: '資訊部 10.0\n', value: '', images: [], error: '', seconds: 0.4, timedOut: false }

/** 對話裡的一個成品區塊（和真的程式碼區塊一樣向面板登記） */
function Block({ code, label }: { code: string; label: string }) {
  const { ref, openInPanel, shownInPanel } = useSidePanelItem({ kind: 'page', code, language: 'html' })
  return <div ref={ref}><button type="button" aria-pressed={shownInPanel} onClick={openInPanel}>{label}</button></div>
}

function Run() {
  const { ref, openInPanel } = useSidePanelItem({ kind: 'run', result: RESULT })
  return <div ref={ref}><button type="button" onClick={openInPanel}>看結果</button></div>
}

const frameDoc = () => screen.getByTitle('ui.chat.codeFile.previewTitle').getAttribute('srcdoc') ?? ''
const flush = () => act(async () => { await Promise.resolve() })

beforeEach(() => {
  useSidePanelStore.setState({ items: {}, currentId: null, open: false })
  useUIStore.setState({ sidebarOpen: true })
})

describe('SidePanel', () => {
  it('沒有開啟時不佔位置', () => {
    render(<><Block code="<h1>一</h1>" label="開一" /><SidePanel /></>)
    expect(screen.queryByTestId('side-panel')).not.toBeInTheDocument()
  })

  it('按「在旁邊開啟」：顯示成品（關在沙盒裡），那一顆按鈕標成按下', async () => {
    render(<><Block code="<h1>一</h1>" label="開一" /><SidePanel /></>)
    await userEvent.click(screen.getByRole('button', { name: '開一' }))
    const frame = screen.getByTitle('ui.chat.codeFile.previewTitle')
    expect(frame).toHaveAttribute('sandbox', 'allow-scripts')
    expect(frameDoc()).toContain('<h1>一</h1>')
    expect(frameDoc()).toContain('Content-Security-Policy')
    expect(screen.getByRole('button', { name: '開一' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('有兩個版本：可以切回舊的', async () => {
    render(<><Block code="<h1>一</h1>" label="開一" /><Block code="<h1>二</h1>" label="開二" /><SidePanel /></>)
    await userEvent.click(screen.getByRole('button', { name: '開二' }))
    expect(screen.getByText('2/2')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'ui.message.prevVersion' }))
    expect(screen.getByText('1/2')).toBeInTheDocument()
    expect(frameDoc()).toContain('<h1>一</h1>')
  })

  it('面板開著時 AI 寫出新的一版：自動換成最新的', async () => {
    const view = render(<><Block code="<h1>一</h1>" label="開一" /><SidePanel /></>)
    await userEvent.click(screen.getByRole('button', { name: '開一' }))
    view.rerender(<><Block code="<h1>一</h1>" label="開一" /><Block code="<h1>二</h1>" label="開二" /><SidePanel /></>)
    expect(screen.getByText('2/2')).toBeInTheDocument()
    expect(frameDoc()).toContain('<h1>二</h1>')
  })

  it('往上載入的舊訊息不會搶走現在看的', async () => {
    const view = render(<><Block key="b" code="<h1>二</h1>" label="開二" /><SidePanel /></>)
    await userEvent.click(screen.getByRole('button', { name: '開二' }))
    view.rerender(<><Block key="a" code="<h1>一</h1>" label="開一" /><Block key="b" code="<h1>二</h1>" label="開二" /><SidePanel /></>)
    expect(screen.getByText('2/2')).toBeInTheDocument()
    expect(frameDoc()).toContain('<h1>二</h1>')
  })

  it('看程式碼／看畫面可以切換', async () => {
    render(<><Block code="<h1>一</h1>" label="開一" /><SidePanel /></>)
    await userEvent.click(screen.getByRole('button', { name: '開一' }))
    await userEvent.click(screen.getByRole('button', { name: 'ui.chat.codeFile.showCode' }))
    expect(screen.queryByTitle('ui.chat.codeFile.previewTitle')).not.toBeInTheDocument()
    expect(screen.getByText('<h1>一</h1>')).toBeInTheDocument()
  })

  it('執行結果也用同一個面板', async () => {
    render(<><Run /><SidePanel /></>)
    await userEvent.click(screen.getByRole('button', { name: '看結果' }))
    expect(screen.getByText('ui.chat.sidePanel.runTitle')).toBeInTheDocument()
    expect(screen.getByText(/資訊部 10\.0/)).toBeInTheDocument()
  })

  it('關閉鈕和 Esc 都能關', async () => {
    render(<><Block code="<h1>一</h1>" label="開一" /><SidePanel /></>)
    await userEvent.click(screen.getByRole('button', { name: '開一' }))
    await userEvent.click(screen.getByRole('button', { name: 'ui.chat.sidePanel.close' }))
    expect(screen.queryByTestId('side-panel')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '開一' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByTestId('side-panel')).not.toBeInTheDocument()
  })

  it('正在看的內容不見了（換對話）：退到剩下的最後一版，都沒有了就關掉', async () => {
    const view = render(<><Block key="a" code="<h1>一</h1>" label="開一" /><Block key="b" code="<h1>二</h1>" label="開二" /><SidePanel /></>)
    await userEvent.click(screen.getByRole('button', { name: '開二' }))
    view.rerender(<><Block key="a" code="<h1>一</h1>" label="開一" /><SidePanel /></>)
    await flush()
    expect(frameDoc()).toContain('<h1>一</h1>')
    view.rerender(<><SidePanel /></>)
    await flush()
    expect(screen.queryByTestId('side-panel')).not.toBeInTheDocument()
    expect(useSidePanelStore.getState().open).toBe(false)
  })
})

describe('orderedItems', () => {
  it('照在畫面上的先後排，不是登記的先後；不同種類分開', () => {
    const first = document.createElement('div'); const second = document.createElement('div')
    document.body.append(first, second)
    const items = {
      late: { id: 'late', kind: 'page' as const, code: 'b', language: 'html', el: second },
      early: { id: 'early', kind: 'page' as const, code: 'a', language: 'html', el: first },
      run: { id: 'run', kind: 'run' as const, result: RESULT, el: first },
    }
    expect(orderedItems(items, 'page').map((i) => i.id)).toEqual(['early', 'late'])
    expect(orderedItems(items, 'run').map((i) => i.id)).toEqual(['run'])
    first.remove(); second.remove()
  })
})
