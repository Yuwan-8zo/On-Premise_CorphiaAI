/**
 * ChatInputArea：附加圖片（選檔、貼上、上限、取消、送出後清掉、主機不能看圖時不顯示）
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  AnimatePresence: ({ children }: React.PropsWithChildren) => React.createElement(React.Fragment, null, children),
  motion: { div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => React.createElement('div', props, children) },
}))

vi.mock('@/features/chat/components/PromptMenu', () => ({ PromptMenu: () => null }))

vi.mock('@/lib/browserFolder', () => ({
  BROWSER_FOLDER_MAX_FILES: 40,
  BROWSER_FOLDER_MAX_TOTAL_MB: 50,
  pickFolder: vi.fn(),
  supportsFolderPicker: () => false,
}))
vi.mock('@/api/browserFolder', () => ({
  browserFolderApi: { attach: vi.fn(), cancel: vi.fn(), pending: vi.fn(async () => ({ files: [], chars: 0, expires_in_sec: 0 })) },
}))

const attach = vi.fn()
const cancel = vi.fn()
const pending = vi.fn(async (_id: string): Promise<string[]> => [])
vi.mock('@/api/chatImages', () => ({
  chatImagesApi: {
    attach: (...a: unknown[]) => attach(...a),
    cancel: (...a: unknown[]) => cancel(...a),
    pending: (id: string) => pending(id),
    fetch: vi.fn(async () => new Blob(['x'], { type: 'image/jpeg' })),
  },
}))

import ChatInputArea from '@/features/chat/components/ChatInputArea'

const VISION = { enabled: true, max_images: 4, max_mb: 12 }
const image = (name = 'shot.png', size = 10) => new File([new Uint8Array(size)], name, { type: 'image/png' })

const makeProps = (overrides: Partial<Parameters<typeof ChatInputArea>[0]> = {}) => ({
  selectedFolder: null,
  chatMode: 'general' as const,
  conversationId: 'conv-1',
  vision: VISION,
  isConnecting: false,
  isUploading: false,
  uploadProgress: 0,
  uploadedFiles: [],
  isStreaming: false,
  input: '這張圖是什麼？',
  setInput: vi.fn(),
  inputRef: createRef<HTMLTextAreaElement | null>(),
  fileInputRef: createRef<HTMLInputElement | null>(),
  handleKeyDown: vi.fn(),
  handleStop: vi.fn(),
  handleSend: vi.fn(),
  handleFileUpload: vi.fn(),
  ...overrides,
})

beforeEach(() => {
  attach.mockReset()
  cancel.mockReset()
  pending.mockReset().mockResolvedValue([])
  URL.createObjectURL = vi.fn(() => 'blob:test')
  URL.revokeObjectURL = vi.fn()
})

const choose = (files: File[]) => fireEvent.change(screen.getByTestId('image-input'), { target: { files } })

describe('ChatInputArea：附加圖片', () => {
  it('主機有圖文模型：選單裡有「附加圖片」；選好後上傳並出現標籤', async () => {
    attach.mockResolvedValue({ images: ['a'.repeat(32)], skipped: [] })
    render(<ChatInputArea {...makeProps()} />)
    await userEvent.click(screen.getByLabelText('chat.moreActions'))
    expect(screen.getByRole('menuitem', { name: 'chat.images.button' })).toBeInTheDocument()

    choose([image()])
    await waitFor(() => expect(attach).toHaveBeenCalledWith('conv-1', expect.any(Array)))
    expect(await screen.findByText('chat.images.chip:{"n":1}')).toBeInTheDocument()
  })

  it('主機沒有圖文模型：不顯示入口，貼上圖片也不會上傳', async () => {
    render(<ChatInputArea {...makeProps({ vision: { ...VISION, enabled: false } })} />)
    await userEvent.click(screen.getByLabelText('chat.moreActions'))
    expect(screen.queryByRole('menuitem', { name: 'chat.images.button' })).not.toBeInTheDocument()
    fireEvent.paste(screen.getByRole('textbox'), { clipboardData: { files: [image()] } })
    expect(attach).not.toHaveBeenCalled()
  })

  it('在輸入框貼上截圖：直接附上', async () => {
    attach.mockResolvedValue({ images: ['b'.repeat(32)], skipped: [] })
    render(<ChatInputArea {...makeProps()} />)
    fireEvent.paste(screen.getByRole('textbox'), { clipboardData: { files: [image('clipboard.png')] } })
    await waitFor(() => expect(attach).toHaveBeenCalledTimes(1))
  })

  it('貼上的是文字：不攔截、不上傳', () => {
    render(<ChatInputArea {...makeProps()} />)
    const notPrevented = fireEvent.paste(screen.getByRole('textbox'), { clipboardData: { files: [] } })
    expect(notPrevented).toBe(true)
    expect(attach).not.toHaveBeenCalled()
  })

  it('超過張數或單張太大：不送到伺服器', async () => {
    render(<ChatInputArea {...makeProps()} />)
    choose(Array.from({ length: 5 }, (_, i) => image(`${i}.png`)))
    choose([image('big.png', 13 * 1024 * 1024)])
    await new Promise((r) => setTimeout(r, 20))
    expect(attach).not.toHaveBeenCalled()
  })

  it('不是圖片的檔案直接略過', async () => {
    render(<ChatInputArea {...makeProps()} />)
    choose([new File(['x'], 'a.pdf', { type: 'application/pdf' })])
    await new Promise((r) => setTimeout(r, 20))
    expect(attach).not.toHaveBeenCalled()
  })

  it('按移除：取消附加，標籤消失', async () => {
    pending.mockResolvedValue(['c'.repeat(32)])
    render(<ChatInputArea {...makeProps()} />)
    await userEvent.click(await screen.findByLabelText('chat.images.remove'))
    await waitFor(() => expect(cancel).toHaveBeenCalledWith('conv-1'))
    expect(screen.queryByLabelText('chat.images.remove')).not.toBeInTheDocument()
  })

  it('送出：把圖片編號交給上層（訊息馬上顯示圖片），輸入框上的標籤清掉', async () => {
    pending.mockResolvedValue(['d'.repeat(32), 'e'.repeat(32)])
    const onImagesSent = vi.fn()
    const handleSend = vi.fn()
    render(<ChatInputArea {...makeProps({ onImagesSent, handleSend })} />)
    await screen.findByText('chat.images.chip:{"n":2}')
    await userEvent.click(screen.getByLabelText('chat.sendMessage'))
    expect(onImagesSent).toHaveBeenCalledWith(['d'.repeat(32), 'e'.repeat(32)])
    expect(handleSend).toHaveBeenCalled()
    expect(screen.queryByLabelText('chat.images.remove')).not.toBeInTheDocument()
  })

  it('全新對話（還沒有編號）：先建立對話再附圖', async () => {
    attach.mockResolvedValue({ images: ['f'.repeat(32)], skipped: [] })
    const ensureConversation = vi.fn().mockResolvedValue('new-conv')
    render(<ChatInputArea {...makeProps({ conversationId: undefined, ensureConversation })} />)
    choose([image()])
    await waitFor(() => expect(attach).toHaveBeenCalledWith('new-conv', expect.any(Array)))
  })
})
