/**
 * ChatInputArea 元件測試 (ChatInputArea.test.tsx)
 *
 * 測試重點：
 * - 基本渲染
 * - 輸入文字與送出
 * - Enter 鍵送出
 * - 空白訊息禁止送出
 * - 串流中顯示停止按鈕
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React, { createRef } from 'react'

// NOTE: i18n 在測試環境需要 mock，避免初始化錯誤
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
}))

// framer-motion 在 jsdom 環境下 mock 成簡單 div
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement('div', props, children),
  },
}))

// PromptMenu 不是此測試重點，mock 掉
vi.mock('@/components/chat/PromptMenu', () => ({
  PromptMenu: ({ disabled }: { disabled: boolean }) =>
    React.createElement('button', { 'data-testid': 'prompt-menu', disabled }, '範本'),
}))

import ChatInputArea from '@/components/chat/ChatInputArea'

// ── 預設 Props Factory ─────────────────────────────────────────

const makeDefaultProps = (overrides: Partial<Parameters<typeof ChatInputArea>[0]> = {}) => {
  const inputRef = createRef<HTMLTextAreaElement | null>()
  const fileInputRef = createRef<HTMLInputElement | null>()

  return {
    selectedFolder: null,
    chatMode: 'general' as const,
    isConnecting: false,
    isUploading: false,
    uploadProgress: 0,
    uploadedFiles: [],
    isStreaming: false,
    input: '',
    setInput: vi.fn(),
    inputRef,
    fileInputRef,
    handleKeyDown: vi.fn(),
    handleStop: vi.fn(),
    handleSend: vi.fn(),
    handleFileUpload: vi.fn(),
    ...overrides,
  }
}

// ═══════════════════════════════════════════════════════════════

describe('ChatInputArea', () => {
  it('應該正常渲染輸入框', () => {
    render(<ChatInputArea {...makeDefaultProps()} />)
    const textarea = screen.getByRole('textbox')
    expect(textarea).toBeInTheDocument()
  })

  it('selectedFolder 有值時不渲染輸入框', () => {
    render(<ChatInputArea {...makeDefaultProps({ selectedFolder: 'project-folder-1' })} />)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('輸入文字時呼叫 setInput', async () => {
    const setInput = vi.fn()
    render(<ChatInputArea {...makeDefaultProps({ setInput })} />)
    const textarea = screen.getByRole('textbox')
    await userEvent.type(textarea, 'Hello')
    expect(setInput).toHaveBeenCalled()
  })

  it('input 為空時送出按鈕應 disabled', () => {
    render(<ChatInputArea {...makeDefaultProps({ input: '' })} />)
    // SendDotBtn 包在 button 裡，且 disabled={!input.trim() || isConnecting}
    const sendBtn = screen.getByRole('button', { hidden: true })
    // 找最後一個 button（送出按鈕）
    const buttons = screen.getAllByRole('button', { hidden: true })
    const sendButton = buttons[buttons.length - 1]
    expect(sendButton).toBeDisabled()
  })

  it('input 有內容時送出按鈕可點擊', () => {
    render(<ChatInputArea {...makeDefaultProps({ input: '你好，AI！' })} />)
    const buttons = screen.getAllByRole('button', { hidden: true })
    const sendButton = buttons[buttons.length - 1]
    expect(sendButton).not.toBeDisabled()
  })

  it('點擊送出按鈕呼叫 handleSend', async () => {
    const handleSend = vi.fn()
    render(<ChatInputArea {...makeDefaultProps({ input: '測試訊息', handleSend })} />)
    const buttons = screen.getAllByRole('button', { hidden: true })
    const sendButton = buttons[buttons.length - 1]
    await userEvent.click(sendButton)
    expect(handleSend).toHaveBeenCalledTimes(1)
  })

  it('按下 Enter 呼叫 handleKeyDown', async () => {
    const handleKeyDown = vi.fn()
    render(<ChatInputArea {...makeDefaultProps({ input: '測試', handleKeyDown })} />)
    const textarea = screen.getByRole('textbox')
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' })
    expect(handleKeyDown).toHaveBeenCalled()
  })

  it('isStreaming 時顯示停止按鈕而非送出按鈕', () => {
    const handleStop = vi.fn()
    render(<ChatInputArea {...makeDefaultProps({ isStreaming: true, handleStop })} />)
    // 停止按鈕應存在
    const buttons = screen.getAllByRole('button', { hidden: true })
    const lastBtn = buttons[buttons.length - 1]
    // 點擊後應呼叫 handleStop
    fireEvent.click(lastBtn)
    expect(handleStop).toHaveBeenCalled()
  })

  it('isConnecting 時 textarea 應 disabled', () => {
    render(<ChatInputArea {...makeDefaultProps({ isConnecting: true })} />)
    const textarea = screen.getByRole('textbox')
    expect(textarea).toBeDisabled()
  })

  it('有上傳檔案時顯示檔案名稱標籤', () => {
    const files = [new File(['content'], 'test.pdf', { type: 'application/pdf' })]
    render(<ChatInputArea {...makeDefaultProps({ uploadedFiles: files })} />)
    expect(screen.getByText('test.pdf')).toBeInTheDocument()
  })
})
