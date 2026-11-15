/**
 * CodeRunPanel：執行 Python 的結果區（執行、加資料檔、顯示結果與錯誤、交給 AI）
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) => (vars ? `${key}:${JSON.stringify(vars)}` : key),
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}))

const runPython = vi.fn()
vi.mock('@/lib/pyRunner', async () => {
  const real = await vi.importActual<typeof import('@/lib/pyRunner')>('@/lib/pyRunner')
  return { ...real, runPython: (...args: unknown[]) => runPython(...args) }
})

const appendToChatInput = vi.fn()
vi.mock('@/lib/chatInputBus', () => ({ appendToChatInput: (text: string) => appendToChatInput(text) }))

import CodeRunPanel, { resultForAI } from '@/features/chat/components/CodeRunPanel'

const RESULT = { ok: true, stdout: '資訊部 10.0\n', value: '', images: ['data:image/png;base64,AAAA'], error: '', seconds: 0.4, timedOut: false }
const LABELS = { ran: '我執行了', error: '錯誤：', timedOut: '逾時', images: '（另外畫了 {{n}} 張圖）', nothing: '沒有輸出' }

beforeEach(() => {
  // 測試用的模擬瀏覽器沒有 File.arrayBuffer（真的瀏覽器都有）：補一個
  if (!File.prototype.arrayBuffer) {
    File.prototype.arrayBuffer = function () { return Promise.resolve(new ArrayBuffer(this.size)) }
  }
  runPython.mockReset()
  appendToChatInput.mockReset()
})

describe('CodeRunPanel', () => {
  it('不會自己執行：使用者按了才跑', () => {
    render(<CodeRunPanel code="print(1)" />)
    expect(runPython).not.toHaveBeenCalled()
    expect(screen.getByText('ui.chat.run.note')).toBeInTheDocument()
  })

  it('按執行：顯示印出來的文字、圖、花了多久', async () => {
    runPython.mockResolvedValue(RESULT)
    render(<CodeRunPanel code="print(1)" />)
    await userEvent.click(screen.getByRole('button', { name: 'ui.chat.run.run' }))
    expect(runPython).toHaveBeenCalledWith('print(1)', [])
    expect(await screen.findByText(/資訊部 10\.0/)).toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAttribute('src', RESULT.images[0])
    expect(screen.getByText('ui.chat.run.took:{"s":0.4}')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ui.chat.run.again' })).toBeInTheDocument()
  })

  it('程式出錯：顯示錯誤訊息', async () => {
    runPython.mockResolvedValue({ ...RESULT, ok: false, stdout: '', images: [], error: "NameError: name 'x' is not defined" })
    render(<CodeRunPanel code="x" />)
    await userEvent.click(screen.getByRole('button', { name: 'ui.chat.run.run' }))
    expect(await screen.findByText(/NameError/)).toHaveAttribute('role', 'alert')
  })

  it('跑太久：說明已經中止', async () => {
    runPython.mockResolvedValue({ ...RESULT, ok: false, stdout: '', images: [], timedOut: true })
    render(<CodeRunPanel code="while True: pass" />)
    await userEvent.click(screen.getByRole('button', { name: 'ui.chat.run.run' }))
    expect(await screen.findByText(/ui\.chat\.run\.timedOut/)).toBeInTheDocument()
  })

  it('執行環境沒起來（主機沒有 Python 的檔案）：說明原因，不當成程式的錯', async () => {
    runPython.mockRejectedValue(new Error('缺少套件檔'))
    render(<CodeRunPanel code="print(1)" />)
    await userEvent.click(screen.getByRole('button', { name: 'ui.chat.run.run' }))
    expect(await screen.findByText('ui.chat.run.loadFailed')).toHaveAttribute('role', 'alert')
  })

  it('加入資料檔：執行時交給程式；可以移除', async () => {
    runPython.mockResolvedValue(RESULT)
    render(<CodeRunPanel code="print(1)" />)
    fireEvent.change(screen.getByTestId('run-file-input'), { target: { files: [new File(['a,b\n1,2'], 'data.csv', { type: 'text/csv' })] } })
    expect(await screen.findByText('data.csv')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'ui.chat.run.run' }))
    await waitFor(() => expect(runPython).toHaveBeenCalled())
    expect(runPython.mock.calls[0][1]).toHaveLength(1)
    expect(runPython.mock.calls[0][1][0].name).toBe('data.csv')

    await userEvent.click(screen.getByLabelText('ui.chat.run.removeFile:{"name":"data.csv"}'))
    expect(screen.queryByText('data.csv')).not.toBeInTheDocument()
  })

  it('把結果交給 AI：放進輸入框（不是自動送出）', async () => {
    runPython.mockResolvedValue(RESULT)
    render(<CodeRunPanel code="print(1)" />)
    await userEvent.click(screen.getByRole('button', { name: 'ui.chat.run.run' }))
    await userEvent.click(await screen.findByRole('button', { name: 'ui.chat.run.sendToAI' }))
    expect(appendToChatInput).toHaveBeenCalledTimes(1)
    expect(appendToChatInput.mock.calls[0][0]).toContain('資訊部 10.0')
  })
})

describe('resultForAI', () => {
  it('帶上文字、最後的值、錯誤、畫了幾張圖', () => {
    const text = resultForAI({ ...RESULT, value: '42', error: 'ValueError: 壞了' }, LABELS)
    expect(text).toContain('我執行了')
    expect(text).toContain('資訊部 10.0')
    expect(text).toContain('42')
    expect(text).toContain('錯誤：\nValueError: 壞了')
    expect(text).toContain('（另外畫了 1 張圖）')
  })

  it('沒有任何輸出也說清楚', () => {
    expect(resultForAI({ ...RESULT, stdout: '', images: [] }, LABELS)).toContain('沒有輸出')
  })

  it('很長的輸出會截短（不然一次就把對話塞滿）', () => {
    expect(resultForAI({ ...RESULT, stdout: 'x'.repeat(50_000) }, LABELS).length).toBeLessThan(3200)
  })
})
