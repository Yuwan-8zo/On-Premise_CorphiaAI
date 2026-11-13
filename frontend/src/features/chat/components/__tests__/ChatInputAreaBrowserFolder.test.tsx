/**
 * ChatInputArea：瀏覽器臨時資料夾（附加／移除／送出後清掉／沒有對話 id 或瀏覽器不支援時不顯示按鈕）
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React, { createRef } from 'react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) => (vars ? `${key}:${JSON.stringify(vars)}` : key),
    i18n: { changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}))

vi.mock('@/lib/gsapMotion', () => ({
  motion: { div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => React.createElement('div', props, children) },
}))

vi.mock('@/features/chat/components/PromptMenu', () => ({
  PromptMenu: () => React.createElement('button', { 'data-testid': 'prompt-menu' }, '範本'),
}))

const pickFolder = vi.fn()
const supportsFolderPicker = vi.fn(() => true)
vi.mock('@/lib/browserFolder', () => ({
  pickFolder: (...args: unknown[]) => pickFolder(...args),
  supportsFolderPicker: () => supportsFolderPicker(),
}))

interface PendingResult { files: string[]; chars: number; expires_in_sec: number }
const attach = vi.fn()
const cancel = vi.fn()
const pending = vi.fn(async (_id: string): Promise<PendingResult> => ({ files: [], chars: 0, expires_in_sec: 0 }))
vi.mock('@/api/browserFolder', () => ({
  browserFolderApi: {
    attach: (...a: Parameters<typeof attach>) => attach(...a),
    cancel: (...a: Parameters<typeof cancel>) => cancel(...a),
    pending: (...a: Parameters<typeof pending>) => pending(...a),
  },
}))

import ChatInputArea from '@/features/chat/components/ChatInputArea'

const makeProps = (overrides: Partial<Parameters<typeof ChatInputArea>[0]> = {}) => {
  const inputRef = createRef<HTMLTextAreaElement | null>()
  const fileInputRef = createRef<HTMLInputElement | null>()
  return {
    selectedFolder: null,
    chatMode: 'general' as const,
    conversationId: 'conv-1',
    webSearchEnabled: false,
    webSearchOn: false,
    setWebSearchOn: vi.fn(),
    isConnecting: false,
    isUploading: false,
    uploadProgress: 0,
    uploadedFiles: [],
    isStreaming: false,
    input: 'hi',
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

beforeEach(() => {
  pickFolder.mockReset()
  attach.mockReset()
  cancel.mockReset()
  pending.mockReset().mockResolvedValue({ files: [], chars: 0, expires_in_sec: 0 })
  supportsFolderPicker.mockReturnValue(true)
})

describe('ChatInputArea：附加資料夾按鈕的顯示條件', () => {
  it('有對話 id、瀏覽器支援時顯示按鈕', async () => {
    render(<ChatInputArea {...makeProps()} />)
    expect(await screen.findByLabelText('chat.browserFolder.button')).toBeInTheDocument()
  })

  it('沒有對話 id（全新對話）時不顯示', () => {
    render(<ChatInputArea {...makeProps({ conversationId: undefined })} />)
    expect(screen.queryByLabelText('chat.browserFolder.button')).not.toBeInTheDocument()
  })

  it('瀏覽器不支援時不顯示', () => {
    supportsFolderPicker.mockReturnValue(false)
    render(<ChatInputArea {...makeProps()} />)
    expect(screen.queryByLabelText('chat.browserFolder.button')).not.toBeInTheDocument()
  })
})

describe('ChatInputArea：附加與移除', () => {
  it('選好資料夾後出現附加的小標籤', async () => {
    const user = userEvent.setup()
    pickFolder.mockResolvedValue({ name: '我的資料夾', files: [new File(['x'], 'a.txt')], tooManyFiles: false })
    attach.mockResolvedValue({ accepted: ['a.txt'], skipped: [], chars: 10, pii: 0 })
    render(<ChatInputArea {...makeProps()} />)

    await user.click(await screen.findByLabelText('chat.browserFolder.button'))

    await waitFor(() => expect(attach).toHaveBeenCalledWith('conv-1', expect.any(Array)))
    expect(await screen.findByLabelText('chat.browserFolder.remove')).toBeInTheDocument()
  })

  it('使用者在選取器按取消：不顯示成錯誤、也不出現標籤', async () => {
    const user = userEvent.setup()
    pickFolder.mockRejectedValue(new DOMException('cancelled', 'AbortError'))
    render(<ChatInputArea {...makeProps()} />)

    await user.click(await screen.findByLabelText('chat.browserFolder.button'))

    await waitFor(() => expect(pickFolder).toHaveBeenCalled())
    expect(attach).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('chat.browserFolder.remove')).not.toBeInTheDocument()
  })

  it('按移除：呼叫 cancel API，標籤消失', async () => {
    const user = userEvent.setup()
    pickFolder.mockResolvedValue({ name: 'docs', files: [new File(['x'], 'a.txt')], tooManyFiles: false })
    attach.mockResolvedValue({ accepted: ['a.txt'], skipped: [], chars: 10, pii: 0 })
    render(<ChatInputArea {...makeProps()} />)
    await user.click(await screen.findByLabelText('chat.browserFolder.button'))
    const removeBtn = await screen.findByLabelText('chat.browserFolder.remove')

    await user.click(removeBtn)

    await waitFor(() => expect(cancel).toHaveBeenCalledWith('conv-1'))
    expect(screen.queryByLabelText('chat.browserFolder.remove')).not.toBeInTheDocument()
  })

  it('送出訊息後標籤消失（後端已經用掉這次附加的內容）', async () => {
    const user = userEvent.setup()
    pickFolder.mockResolvedValue({ name: 'docs', files: [new File(['x'], 'a.txt')], tooManyFiles: false })
    attach.mockResolvedValue({ accepted: ['a.txt'], skipped: [], chars: 10, pii: 0 })
    const handleSend = vi.fn()
    render(<ChatInputArea {...makeProps({ handleSend })} />)
    await user.click(await screen.findByLabelText('chat.browserFolder.button'))
    await screen.findByLabelText('chat.browserFolder.remove')

    await user.click(screen.getByLabelText('chat.sendMessage'))

    expect(handleSend).toHaveBeenCalled()
    expect(screen.queryByLabelText('chat.browserFolder.remove')).not.toBeInTheDocument()
  })

  it('換對話時會查詢是否有恢復中的附加（重新整理頁面後的情境）', async () => {
    pending.mockResolvedValue({ files: ['old.txt'], chars: 50, expires_in_sec: 300 })
    render(<ChatInputArea {...makeProps()} />)
    await waitFor(() => expect(pending).toHaveBeenCalledWith('conv-1'))
    expect(await screen.findByLabelText('chat.browserFolder.remove')).toBeInTheDocument()
  })
})
