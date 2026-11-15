/**
 * lib/browserFolder：File System Access API 包成「挑出要上傳的檔案」
 *
 * - 不支援的瀏覽器：supportsFolderPicker() 回 false，不嘗試呼叫
 * - 走訪資料夾（含子資料夾）：只收支援的副檔名，跳過隱藏檔／資料夾
 * - 前端先擋一次數量與總大小（真正的上限仍在伺服器）
 * - 使用者按「取消」：AbortError 原樣往外丟，不吞掉
 */
import { afterEach, describe, expect, it } from 'vitest'

import { BROWSER_FOLDER_MAX_FILES, BROWSER_FOLDER_MAX_TOTAL_MB, pickFolder, supportsFolderPicker } from '../browserFolder'

type Entry = ['file', string, string] | ['dir', string, Entry[]]

function makeFile(name: string, content: string): File {
  return new File([content], name, { type: 'text/plain' })
}

/** 建一個假的 FileSystemDirectoryHandle：entries() 依給定的樹狀結構產生 async iterator */
function makeDirHandle(name: string, entries: Entry[]): FileSystemDirectoryHandle {
  const children = entries.map((entry) => {
    if (entry[0] === 'file') {
      const [, fname, content] = entry
      return [fname, { kind: 'file', getFile: async () => makeFile(fname, content) }] as const
    }
    const [, dname, sub] = entry
    return [dname, makeDirHandle(dname, sub)] as const
  })
  return {
    kind: 'directory',
    name,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    entries: () => (async function* () { for (const c of children) yield c })() as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

function mockPicker(handle: FileSystemDirectoryHandle | (() => Promise<FileSystemDirectoryHandle>)) {
  const fn = typeof handle === 'function' ? handle : async () => handle
  ;(window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker = fn
}

afterEach(() => {
  delete (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker
})

describe('supportsFolderPicker', () => {
  it('沒有 showDirectoryPicker 時回 false', () => {
    expect(supportsFolderPicker()).toBe(false)
  })

  it('有 showDirectoryPicker 時回 true', () => {
    mockPicker(makeDirHandle('x', []))
    expect(supportsFolderPicker()).toBe(true)
  })
})

describe('pickFolder', () => {
  it('不支援時丟出看得懂的錯誤', async () => {
    await expect(pickFolder()).rejects.toThrow('不支援')
  })

  it('只收支援的副檔名，子資料夾也會走訪', async () => {
    mockPicker(makeDirHandle('我的資料夾', [
      ['file', 'a.txt', '內容 A'],
      ['file', 'b.exe', 'x'],
      ['dir', 'sub', [
        ['file', 'c.docx', 'content'],
        ['file', '.hidden.txt', 'y'],
      ]],
      ['dir', '.git', [['file', 'config', 'z']]],
    ]))
    const result = await pickFolder()
    expect(result.name).toBe('我的資料夾')
    expect(result.files.map((f) => f.name).sort()).toEqual(['a.txt', 'c.docx'])
    expect(result.tooManyFiles).toBe(false)
  })

  it('子資料夾裡的檔案帶有相對路徑（webkitRelativePath）', async () => {
    mockPicker(makeDirHandle('root', [['dir', 'sub', [['file', 'c.docx', 'x']]]]))
    const result = await pickFolder()
    expect(result.files[0].webkitRelativePath).toBe('sub/c.docx')
  })

  it('超過數量上限時停止，標記 tooManyFiles', async () => {
    const entries: Entry[] = Array.from({ length: BROWSER_FOLDER_MAX_FILES + 5 }, (_, i) => ['file', `f${i}.txt`, 'x'])
    mockPicker(makeDirHandle('大資料夾', entries))
    const result = await pickFolder()
    expect(result.files.length).toBe(BROWSER_FOLDER_MAX_FILES)
    expect(result.tooManyFiles).toBe(true)
  })

  it('超過總大小上限時停止，標記 tooManyFiles', async () => {
    const big = 'x'.repeat(1024 * 1024) // 1 MB
    const entries: Entry[] = Array.from({ length: BROWSER_FOLDER_MAX_TOTAL_MB + 2 }, (_, i) => ['file', `f${i}.txt`, big])
    mockPicker(makeDirHandle('大資料夾', entries))
    const result = await pickFolder()
    const totalMb = result.files.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024
    expect(totalMb).toBeLessThanOrEqual(BROWSER_FOLDER_MAX_TOTAL_MB)
    expect(result.tooManyFiles).toBe(true)
  })

  it('空資料夾：回傳空陣列，不算 tooManyFiles', async () => {
    mockPicker(makeDirHandle('空的', []))
    const result = await pickFolder()
    expect(result.files).toEqual([])
    expect(result.tooManyFiles).toBe(false)
  })

  it('使用者按取消：AbortError 原樣往外丟', async () => {
    mockPicker(async () => { throw new DOMException('使用者取消', 'AbortError') })
    await expect(pickFolder()).rejects.toMatchObject({ name: 'AbortError' })
  })
})
