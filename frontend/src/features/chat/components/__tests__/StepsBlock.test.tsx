/**
 * StepsBlock：AI 這一題自己做了哪些步驟
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: unknown) => (vars && typeof vars === 'object' ? `${key}:${JSON.stringify(vars)}` : key),
  }),
}))

import StepsBlock from '@/features/chat/components/StepsBlock'

const STEPS = [
  { tool: 'search_documents', summary: '查文件「特休」：找到 2 段', ok: true },
  { tool: 'web_search', summary: '連外網被擋下：命中列管字詞', ok: false },
]

describe('StepsBlock', () => {
  it('沒有步驟、也沒有正在做的事：不顯示', () => {
    const { container } = render(<StepsBlock steps={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('做完後收成一行，點開看得到每一步和有沒有成功', async () => {
    render(<StepsBlock steps={STEPS} />)
    const summary = screen.getByRole('button', { name: 'ui.chat.steps.count:{"n":2}' })
    expect(screen.queryByText('查文件「特休」：找到 2 段')).not.toBeInTheDocument()

    await userEvent.click(summary)

    expect(screen.getByText('查文件「特休」：找到 2 段')).toBeInTheDocument()
    expect(screen.getByText('連外網被擋下：命中列管字詞')).toBeInTheDocument()
    expect(screen.getByLabelText('ui.chat.steps.ok')).toBeInTheDocument()
    expect(screen.getByLabelText('ui.chat.steps.failed')).toBeInTheDocument()
  })

  it('正在用工具：顯示在做什麼', () => {
    render(<StepsBlock steps={[]} working="web_search" />)
    expect(screen.getByRole('status')).toHaveTextContent('ui.chat.steps.working.web_search')
  })

  it('之後新增、這裡還不認得的工具也照樣顯示', async () => {
    render(<StepsBlock steps={[{ tool: 'new_tool', summary: '做了一件新的事', ok: true }]} working="new_tool" />)
    await userEvent.click(screen.getByRole('button'))
    expect(screen.getByText('做了一件新的事')).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
