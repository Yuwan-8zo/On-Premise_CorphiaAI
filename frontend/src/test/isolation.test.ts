/**
 * 地端系統的底線：頁面不向外部網站要任何東西
 *
 * 2026-11-13 的真實流程測試抓到 index.html 每次載入都連 Google 字型；這裡把它變成固定的檢查，以後不小心加回來會直接失敗：
 *   - index.html 不載入外部的樣式、字型、腳本
 *   - 頁面的安全政策（Content-Security-Policy）不列任何外部來源：瀏覽器層級就擋掉對外連線
 *   - 程式裡不寫死外部網址去連（說明用的網址放在註解、命名空間不算）
 *
 * 真的需要連某個外部服務時：在 index.html 的政策裡只加那一個網址，並把它加進下面的 ALLOWED_ORIGINS，說明用途。
 */

import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const FRONTEND = path.resolve(__dirname, '..', '..')
const html = fs.readFileSync(path.join(FRONTEND, 'index.html'), 'utf8')

/** 刻意允許的外部來源（目前沒有） */
const ALLOWED_ORIGINS: string[] = []
/** 政策裡可以出現的來源寫法：自己這台、行內、內嵌資料、同站的即時連線 */
const LOCAL_SOURCES = new Set(["'self'", "'unsafe-inline'", "'unsafe-eval'", "'none'", 'data:', 'blob:', 'ws:', 'wss:'])

function cspDirectives(): Map<string, string[]> {
  const meta = html.match(/<meta[^>]+http-equiv="Content-Security-Policy"[^>]+content="([^"]+)"/i)
  expect(meta, 'index.html 要有 Content-Security-Policy').not.toBeNull()
  const out = new Map<string, string[]>()
  for (const part of meta![1].split(';').map((s) => s.trim()).filter(Boolean)) {
    const [name, ...sources] = part.split(/\s+/)
    out.set(name, sources)
  }
  return out
}

describe('index.html 不向外部要東西', () => {
  it('沒有外部的樣式、字型、腳本、預先連線', () => {
    const withoutComments = html.replace(/<!--[\s\S]*?-->/g, '')
    const tags = withoutComments.match(/<(link|script|img|iframe|source)\b[^>]*>/gi) || []
    const external = tags.filter((tag) => {
      if (/rel="canonical"/i.test(tag)) return false  // 只是標示網址，瀏覽器不會去抓
      const url = tag.match(/(?:href|src)="([^"]+)"/i)?.[1] || ''
      return /^(https?:)?\/\//i.test(url) && !ALLOWED_ORIGINS.some((o) => url.startsWith(o))
    })
    expect(external).toEqual([])
  })

  it('安全政策只允許自己這台伺服器', () => {
    const csp = cspDirectives()
    for (const name of ['default-src', 'script-src', 'style-src', 'font-src', 'img-src', 'media-src', 'connect-src']) {
      expect(csp.has(name), `政策要有 ${name}`).toBe(true)
    }
    for (const [name, sources] of csp) {
      const foreign = sources.filter((s) => !LOCAL_SOURCES.has(s) && !ALLOWED_ORIGINS.includes(s))
      expect(foreign, `${name} 不可以列外部來源`).toEqual([])
    }
  })

  it('圖片、字型、連線不可以整類開放（http: / https: / *）', () => {
    const csp = cspDirectives()
    for (const [name, sources] of csp) {
      expect(sources.filter((s) => ['*', 'http:', 'https:'].includes(s)), name).toEqual([])
    }
  })
})

describe('程式裡不寫死外部網址去連', () => {
  const SKIP_DIRS = new Set(['__tests__', 'test', 'locales', 'assets'])
  const files: string[] = []
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) { if (!SKIP_DIRS.has(entry.name)) walk(full) }
      else if (/\.(ts|tsx|css)$/.test(entry.name) && !/\.test\./.test(entry.name)) files.push(full)
    }
  }
  walk(path.join(FRONTEND, 'src'))

  it('掃得到原始碼', () => {
    expect(files.length).toBeGreaterThan(50)
  })

  it('沒有外部網址（註解、命名空間、說明連結除外）', () => {
    // 不會造成連線的：XML 命名空間、範例網域；註解整段拿掉再找
    const harmless = /^https?:\/\/(www\.w3\.org|example\.(com|org)|[\w.-]*\.example)(\/|$)/i
    const found: string[] = []
    for (const file of files) {
      const code = fs.readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')          // 區塊註解
        .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')   // 行註解（不動字串裡的 http://）
      for (const m of code.matchAll(/https?:\/\/[^\s"'`)<>]+/g)) {
        const url = m[0]
        if (harmless.test(url) || ALLOWED_ORIGINS.some((o) => url.startsWith(o))) continue
        if (/^https?:\/\/(localhost|127\.0\.0\.1)/.test(url)) continue
        found.push(`${path.relative(FRONTEND, file)}: ${url}`)
      }
    }
    expect(found).toEqual([])
  })
})
