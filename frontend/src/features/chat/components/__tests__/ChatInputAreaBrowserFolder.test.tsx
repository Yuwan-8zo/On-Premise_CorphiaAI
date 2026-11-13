/**
 * ChatInputArea：瀏覽器臨時資料夾（附加／移除／送出後清掉／沒有對話 id 或瀏覽器不支援時不顯示按鈕）
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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
  // 進出場動畫的外框：測試裡直接顯示內容
  AnimatePresence: ({ children }: React.PropsWithChildren) => React.createElement(React.Fragment, null, children),
  motion: { div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => React.createElement('div', props, children) },
}))

vi.mock('@/features/chat/components/PromptMenu', () => ({
  PromptMenu: () => React.createElement('button', { 'data-testid': 'prompt-menu' }, '範本'),
}))

const pickFolder = vi.fn()
const supportsFolderPicker = vi.fn(() => true)
vi.mock('@/lib/browserFolder', () => ({
  // 上限和真的那一份一樣（附加檔案在送出前會先擋一次）
  BROWSER_FOLDER_MAX_FILES: 40,
  BROWSER_FOLDER_MAX_TOTAL_MB: 50,
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

/** 「附加資料夾」收在輸入框左邊的「＋」選單裡：打開選單再點它 */
const pickFolderFromMenu = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByLabelText('chat.moreActions'))
  await user.click(await screen.findByRole('menuitem', { name: 'chat.browserFolder.button' }))
}

describe('ChatInputArea：附加資料夾按鈕的顯示條件', () => {
  it('有對話 id、瀏覽器支援時選單裡有這一項', async () => {
    render(<ChatInputArea {...makeProps()} />)
    await userEvent.click(screen.getByLabelText('chat.moreActions'))
    expect(await screen.findByRole('menuitem', { name: 'chat.browserFolder.button' })).toBeInTheDocument()
  })

  it('沒有對話 id（全新對話）時不顯示', () => {
    render(<ChatInputArea {...makeProps({ conversationId: undefined })} />)
    expect(screen.queryByLabelText('chat.moreActions')).not.toBeInTheDocument()  // 沒有可用的功能，連「＋」都不顯示
  })

  it('瀏覽器不支援選資料夾時，選單裡沒有這一項（但還是可以附加檔案）', async () => {
    supportsFolderPicker.mockReturnValue(false)
    render(<ChatInputArea {...makeProps()} />)
    await userEvent.click(screen.getByLabelText('chat.moreActions'))
    expect(screen.queryByRole('menuitem', { name: 'chat.browserFolder.button' })).not.toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'chat.attachFiles.button' })).toBeInTheDocument()
  })
})

describe('ChatInputArea：附加檔案（只附給下一則訊息）', () => {
  const chooseFiles = (container: HTMLElement, files: File[]) => {
    const input = container.querySelector('input[type="file"][aria-hidden]') as HTMLInputElement
    fireEvent.change(input, { target: { files } })
  }

  it('選好檔案後送到伺服器，輸入框上方出現檔名的小標籤', async () => {
    attach.mockResolvedValue({ accepted: ['報告.pdf'], skipped: [], chars: 100, pii: 0 })
    const { container } = render(<ChatInputArea {...makeProps()} />)
    chooseFiles(container, [new File(['x'], '報告.pdf')])
    await waitFor(() => expect(attach).toHaveBeenCalledWith('conv-1', expect.any(Array)))
    expect(await screen.findByText('報告.pdf')).toBeInTheDocument()
    expect(screen.getByLabelText('chat.browserFolder.remove')).toBeInTheDocument()
  })

  it('全新對話（還沒有 id）：先建立對話再附加', async () => {
    attach.mockResolvedValue({ accepted: ['a.txt', 'b.txt'], skipped: [], chars: 10, pii: 0 })
    const ensureConversation = vi.fn().mockResolvedValue('new-conv')
    const { container } = render(<ChatInputArea {...makeProps({ conversationId: undefined, ensureConversation })} />)
    chooseFiles(container, [new File(['x'], 'a.txt'), new File(['y'], 'b.txt')])
    await waitFor(() => expect(attach).toHaveBeenCalledWith('new-conv', expect.any(Array)))
    expect(ensureConversation).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('chat.attachFiles.chip:{"n":2}')).toBeInTheDocument()
  })

  it('伺服器一個都沒收（格式不支援）：不出現標籤', async () => {
    attach.mockResolvedValue({ accepted: [], skipped: [{ name: 'x.exe', reason: '不支援' }], chars: 0, pii: 0 })
    const { container } = render(<ChatInputArea {...makeProps()} />)
    chooseFiles(container, [new File(['x'], 'x.exe')])
    await waitFor(() => expect(attach).toHaveBeenCalled())
    expect(screen.queryByLabelText('chat.browserFolder.remove')).not.toBeInTheDocument()
  })

  it('超過數量上限：不送到伺服器', async () => {
    const { container } = render(<ChatInputArea {...makeProps()} />)
    chooseFiles(container, Array.from({ length: 41 }, (_, i) => new File(['x'], `f${i}.txt`)))
    await new Promise((r) => setTimeout(r, 20))
    expect(attach).not.toHaveBeenCalled()
  })
})

describe('ChatInputArea：附加與移除', () => {
  it('選好資料夾後出現附加的小標籤', async () => {
    const user = userEvent.setup()
    pickFolder.mockResolvedValue({ name: '我的資料夾', files: [new File(['x'], 'a.txt')], tooManyFiles: false })
    attach.mockResolvedValue({ accepted: ['a.txt'], skipped: [], chars: 10, pii: 0 })
    render(<ChatInputArea {...makeProps()} />)

    await pickFolderFromMenu(user)

    await waitFor(() => expect(attach).toHaveBeenCalledWith('conv-1', expect.any(Array)))
    expect(await screen.findByLabelText('chat.browserFolder.remove')).toBeInTheDocument()
  })

  it('使用者在選取器按取消：不顯示成錯誤、也不出現標籤', async () => {
    const user = userEvent.setup()
    pickFolder.mockRejectedValue(new DOMException('cancelled', 'AbortError'))
    render(<ChatInputArea {...makeProps()} />)

    await pickFolderFromMenu(user)

    await waitFor(() => expect(pickFolder).toHaveBeenCalled())
    expect(attach).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('chat.browserFolder.remove')).not.toBeInTheDocument()
  })

  it('按移除：呼叫 cancel API，標籤消失', async () => {
    const user = userEvent.setup()
    pickFolder.mockResolvedValue({ name: 'docs', files: [new File(['x'], 'a.txt')], tooManyFiles: false })
    attach.mockResolvedValue({ accepted: ['a.txt'], skipped: [], chars: 10, pii: 0 })
    render(<ChatInputArea {...makeProps()} />)
    await pickFolderFromMenu(user)
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
    await pickFolderFromMenu(user)
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
