/**
 * 預覽文件：哪些程式碼可以預覽、政策一定在最前面
 */
import { describe, expect, it } from 'vitest'
import { PREVIEW_CSP, PREVIEW_SANDBOX, buildPreviewDoc, isPreviewable } from '@/lib/previewDoc'

describe('isPreviewable', () => {
  it.each([
    ['html', '<h1>標題</h1>'],
    ['HTML', '<p>大小寫都可以</p>'],
    ['svg', '<svg></svg>'],
    ['xml', '  <svg viewBox="0 0 1 1"></svg>'],
    ['', '<!DOCTYPE html><html></html>'],
    ['', '<svg></svg>'],
  ])('%s 可以預覽', (language, code) => {
    expect(isPreviewable(language, code)).toBe(true)
  })

  it.each([
    ['python', 'print("<html>")'],
    ['javascript', 'document.write("<html>")'],
    ['xml', '<config><item/></config>'],
    ['', '只是一段文字'],
    ['', '<div>沒標語言的片段不猜</div>'],
  ])('%s 不預覽', (language, code) => {
    expect(isPreviewable(language, code)).toBe(false)
  })
})

describe('buildPreviewDoc', () => {
  it('內容安全政策放在模型寫的內容之前（後面再放一條也只會更嚴，改不掉）', () => {
    const code = '<meta http-equiv="Content-Security-Policy" content="default-src *"><script src="https://example.test/x.js"></script>'
    const doc = buildPreviewDoc(code)
    expect(doc.indexOf(PREVIEW_CSP)).toBeGreaterThan(0)
    expect(doc.indexOf(PREVIEW_CSP)).toBeLessThan(doc.indexOf(code))
  })

  it('政策不允許連任何網路、沙盒不給同源權限', () => {
    expect(PREVIEW_CSP).toContain("default-src 'none'")
    expect(PREVIEW_CSP).not.toMatch(/https?:|\*|connect-src|'self'/)
    expect(PREVIEW_SANDBOX).toBe('allow-scripts')
  })

  it('模型寫的內容原樣保留', () => {
    expect(buildPreviewDoc('<svg><circle r="5"/></svg>')).toContain('<svg><circle r="5"/></svg>')
  })
})
