/**
 * lib/desktop：介面和桌面版小幫手之間的橋
 *
 * - 每個動作都帶「這一頁的通行碼」（桌面版發的 window.__corphiaDesktop）；沒有通行碼就照實帶空字串，由小幫手拒絕
 * - 成功的動作回報伺服器寫稽核，只回報摘要（文件名稱、字數），不含文件內容
 * - 小幫手回 ok: false 時丟出給使用者看的原因
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// vi.mock 會被提到檔案最前面執行，所以它用到的假函式要用 vi.hoisted 先建立
const { post, get } = vi.hoisted(() => ({
  post: vi.fn(() => Promise.resolve({ data: { ok: true } })),
  get: vi.fn(),
}))
vi.mock('@/api/client', () => ({ default: { post, get, defaults: { baseURL: '/api/v1' } } }))

import { desktop, desktopRelease } from '../desktop'

type Win = { pywebview?: { api: Record<string, ReturnType<typeof vi.fn>> }; __corphiaDesktop?: string }
const win = window as unknown as Win

const READ = { ok: true, app: 'excel', name: '預算.xlsx / 工作表1', scope: 'selection', text: '部門\t預算\n業務部\t1200000', chars: 21, truncated: false }

beforeEach(() => {
  post.mockClear()
  get.mockReset()
  win.__corphiaDesktop = 'page-token'
  win.pywebview = {
    api: {
      info: vi.fn(async () => ({ ok: true, desktop: true, version: '0.1.2', trusted: true, update: null })),
      update: vi.fn(async () => ({ ok: true, version: '0.1.3' })),
      office_read: vi.fn(async () => READ),
      office_write: vi.fn(async () => ({ ok: true, app: 'word', name: '報告.docx', detail: '已在 Word 游標處寫入 6 段', backup: 'C:/b/報告.bak.docx' })),
      open_file: vi.fn(async () => ({ ok: true, path: 'C:/x/a.docx', name: 'a.docx' })),
    },
  }
})

describe('desktop：通行碼', () => {
  it('每個動作的第一個參數都是這一頁的通行碼', async () => {
    await desktop.info()
    await desktop.read('excel')
    await desktop.write('word', '內容')
    await desktop.update()
    const api = win.pywebview!.api
    expect(api.info).toHaveBeenCalledWith('page-token')
    expect(api.office_read).toHaveBeenCalledWith('page-token', 'excel')
    expect(api.office_write).toHaveBeenCalledWith('page-token', 'word', '內容')
    expect(api.update).toHaveBeenCalledWith('page-token')
  })

  it('開啟檔案：通行碼、檔名、內容（base64）', async () => {
    await desktop.openFile('a.docx', new Blob(['PK-data']))
    const [token, name, b64] = win.pywebview!.api.open_file.mock.calls[0]
    expect(token).toBe('page-token')
    expect(name).toBe('a.docx')
    expect(atob(b64 as string)).toBe('PK-data')
  })

  it('還沒拿到通行碼時帶空字串，小幫手拒絕後把原因丟出來', async () => {
    delete win.__corphiaDesktop
    win.pywebview!.api.office_read = vi.fn(async (token: string) => (token ? READ : { ok: false, error: '這個頁面不能使用桌面功能' }))
    await expect(desktop.read('word')).rejects.toThrow('這個頁面不能使用桌面功能')
    expect(win.pywebview!.api.office_read).toHaveBeenCalledWith('', 'word')
    expect(post).not.toHaveBeenCalled()  // 沒成功就不回報稽核
  })

  it('不在桌面版裡（沒有橋）：丟出看得懂的錯誤', async () => {
    delete win.pywebview
    await expect(desktop.read('word')).rejects.toThrow('桌面版沒有回應')
  })
})

describe('desktop：回報稽核', () => {
  it('讀取只回報摘要，不含文件內容', async () => {
    await desktop.read('excel')
    expect(post).toHaveBeenCalledTimes(1)
    const [url, body] = post.mock.calls[0] as unknown as [string, { action: string; app: string; detail: Record<string, unknown> }]
    expect(url).toBe('/desktop/events')
    expect(body.action).toBe('office_read')
    expect(body.detail).toEqual({ name: '預算.xlsx / 工作表1', scope: 'selection', chars: 21, truncated: false })
    expect(JSON.stringify(body)).not.toContain('1200000')
  })

  it('寫入回報有沒有備份（不回報備份的路徑）', async () => {
    await desktop.write('word', '內容')
    const [, body] = post.mock.calls[0] as unknown as [string, { detail: Record<string, unknown> }]
    expect(body.detail).toEqual({ name: '報告.docx', detail: '已在 Word 游標處寫入 6 段', backup: true })
  })

  it('稽核回報失敗不影響使用者的操作', async () => {
    post.mockImplementationOnce(() => Promise.reject(new Error('offline')))
    await expect(desktop.read('excel')).resolves.toMatchObject({ name: '預算.xlsx / 工作表1' })
  })
})

describe('desktopRelease：伺服器上的安裝檔', () => {
  it('下載網址在同一台伺服器', () => {
    expect(desktopRelease.downloadUrl()).toBe('/api/v1/desktop/download')
  })

  it('查最新版本', async () => {
    get.mockResolvedValue({ data: { available: true, version: '0.1.2', size: 13857788 } })
    await expect(desktopRelease.latest()).resolves.toEqual({ available: true, version: '0.1.2', size: 13857788 })
    expect(get).toHaveBeenCalledWith('/desktop/latest')
  })
})
