/**
 * WebSearchNote：每則回答下面「有沒有連外網」的標示
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) => (vars ? `${key}:${JSON.stringify(vars)}` : key),
  }),
}))

import WebSearchNote from '@/features/chat/components/WebSearchNote'

const SOURCES = [
  { title: '中央氣象署', url: 'https://example.test/a' },
  { title: '', url: 'https://example.test/b' },
]

describe('WebSearchNote', () => {
  it('已連外網：顯示送出去的關鍵字與筆數，點開看得到每一筆來源', async () => {
    render(<WebSearchNote info={{ used: true, query: '台北 天氣', sources: SOURCES }} />)
    const summary = screen.getByRole('button', { name: 'chat.webNote.online:{"query":"台北 天氣","n":2}' })
    expect(summary).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link')).not.toBeInTheDocument()

    await userEvent.click(summary)

    const links = screen.getAllByRole('link')
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['https://example.test/a', 'https://example.test/b'])
    expect(links[0]).toHaveTextContent('中央氣象署')
    expect(links[1]).toHaveTextContent('https://example.test/b') // 沒有標題就顯示網址
    expect(links[0]).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('已連外網但沒有查到結果：不能展開', () => {
    render(<WebSearchNote info={{ used: true, query: '冷門', sources: [] }} />)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('未連外網：可以按「連網重答」', async () => {
    const onSearchAgain = vi.fn()
    render(<WebSearchNote info={{ used: false }} onSearchAgain={onSearchAgain} />)
    expect(screen.getByText('chat.webNote.offline')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'chat.webNote.searchAgain' }))
    expect(onSearchAgain).toHaveBeenCalledTimes(1)
  })

  it('這一題可能需要即時資訊：換一句提醒', () => {
    render(<WebSearchNote info={{ used: false, suggested: true }} onSearchAgain={() => {}} />)
    expect(screen.getByText('chat.webNote.suggested')).toBeInTheDocument()
  })

  it('政策是完全不連外網（沒有給 onSearchAgain）：只有標示，沒有按鈕', () => {
    render(<WebSearchNote info={{ used: false }} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('被擋下來：說明原因，不提供重試（同一個關鍵字再送也一樣會被擋）', () => {
    render(<WebSearchNote info={{ used: false, blocked: '命中列管字詞' }} onSearchAgain={() => {}} />)
    expect(screen.getByText('chat.webNote.blocked:{"reason":"命中列管字詞"}')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
