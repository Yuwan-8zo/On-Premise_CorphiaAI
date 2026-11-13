/**
 * 執行 Python 的沙盒：政策只允許拿主機的 Python 檔案、檔名安全、哪些語言可以執行
 * （真的把 Python 跑起來要瀏覽器，是手動實測的；這裡測不靠瀏覽器就能驗的規則）
 */
import { describe, expect, it } from 'vitest'
import { PY_RUN_TIMEOUT_MS, isRunnable, runnerCsp, runnerDocument, safeFileName } from '@/lib/pyRunner'

const ORIGIN = 'https://192.168.1.10:8443'

describe('runnerCsp', () => {
  const csp = runnerCsp(ORIGIN)

  it('預設全部禁止，只能向主機的 /pyodide/ 資料夾拿檔案', () => {
    expect(csp).toContain("default-src 'none'")
    expect(csp).toContain(`connect-src ${ORIGIN}/pyodide/`)
    expect(csp.match(/connect-src [^;]*/)?.[0]).toBe(`connect-src ${ORIGIN}/pyodide/`)
  })

  it('連不到這個系統的 API、也連不到任何外部網站', () => {
    expect(csp).not.toMatch(/\*|https?:\/\/(?!192\.168\.1\.10:8443\/pyodide\/)/)
    expect(csp).not.toContain("'self'")
    expect(csp).not.toContain('/api')
  })

  it('背景執行緒只能從記憶體裡的程式開，不能從網址載入', () => {
    expect(csp).toContain('worker-src blob:')
  })
})

describe('runnerDocument', () => {
  const doc = runnerDocument(ORIGIN)

  it('政策寫在文件最前面', () => {
    expect(doc.indexOf('Content-Security-Policy')).toBeLessThan(doc.indexOf('<script'))
    expect(doc).toContain(runnerCsp(ORIGIN))
  })

  it('Python 跑在背景執行緒，框本身只轉送訊息（程式卡住時頁面不會跟著凍結）', () => {
    expect(doc).toContain('new Worker(')
    expect(doc).toContain('event.source === parent')
  })

  it('背景執行緒的程式語法正確（曾經因為字串裡的換行跳脫字元壞掉，一啟動就報語法錯誤）', () => {
    const literal = doc.match(/const source = (".*");\n/)?.[1]
    expect(literal).toBeTruthy()
    const source = JSON.parse(literal as string) as string
    // 只檢查語法，不執行：包成非同步函式（裡面有 await import）
    expect(() => new Function(`return async () => {${source}\n}`)).not.toThrow()
  })

  it('只帶主機自己的位址，沒有任何外部網址', () => {
    const urls = doc.match(/https?:\/\/[^"'\\\s)]+/g) ?? []
    expect(urls.length).toBeGreaterThan(0)
    expect(urls.every((u) => u.startsWith(`${ORIGIN}/pyodide/`))).toBe(true)
  })
})

describe('safeFileName', () => {
  it.each([
    ['報表.xlsx', '報表.xlsx'],
    ['C:\\Users\\me\\data.csv', 'data.csv'],
    ['../../etc/passwd', 'passwd'],
    ['a b (1).csv', 'a b (1).csv'],
    ['x;rm -rf.txt', 'x_rm -rf.txt'],
    ['', 'file'],
  ])('%s → %s', (input, expected) => {
    expect(safeFileName(input)).toBe(expected)
  })

  it('不會留下路徑符號', () => {
    expect(safeFileName('a/b\\c')).not.toMatch(/[\\/]/)
  })
})

describe('isRunnable', () => {
  it.each(['python', 'Python', 'py', 'python3'])('%s 可以執行', (language) => {
    expect(isRunnable(language)).toBe(true)
  })

  it.each(['javascript', 'bash', 'sql', 'html', ''])('%s 不行', (language) => {
    expect(isRunnable(language)).toBe(false)
  })
})

describe('時間上限', () => {
  it('有上限，而且不會短到正常的資料分析跑不完', () => {
    expect(PY_RUN_TIMEOUT_MS).toBeGreaterThanOrEqual(30_000)
    expect(PY_RUN_TIMEOUT_MS).toBeLessThanOrEqual(120_000)
  })
})
