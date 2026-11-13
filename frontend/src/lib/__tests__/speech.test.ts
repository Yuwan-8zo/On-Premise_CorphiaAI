/**
 * 朗讀：只挑本機語音、Markdown 轉成唸得出來的字、切句
 */
import { describe, expect, it } from 'vitest'
import { pickVoice, plainText, splitForSpeech } from '@/lib/speech'

const voice = (lang: string, localService: boolean, name = lang) => ({ lang, localService, name })

describe('pickVoice', () => {
  it('語言完全相同的本機語音優先', () => {
    const voices = [voice('zh-CN', true), voice('zh-TW', true), voice('en-US', true)]
    expect(pickVoice(voices, 'zh-TW')?.lang).toBe('zh-TW')
  })

  it('線上語音不用（會把文字送出去），就算語言完全相同', () => {
    const voices = [voice('zh-TW', false, '線上'), voice('zh-CN', true, '本機')]
    expect(pickVoice(voices, 'zh-TW')?.name).toBe('本機')
  })

  it('只有線上語音、或沒有這個語言：回 null', () => {
    expect(pickVoice([voice('zh-TW', false)], 'zh-TW')).toBeNull()
    expect(pickVoice([voice('en-US', true)], 'ja-JP')).toBeNull()
    expect(pickVoice([], 'zh-TW')).toBeNull()
  })

  it('語言代碼用底線的也認得', () => {
    expect(pickVoice([voice('zh_TW', true)], 'zh-TW')?.lang).toBe('zh_TW')
  })
})

describe('plainText', () => {
  it('程式碼區塊不唸，連結只唸文字，拿掉標記符號', () => {
    const md = '## 結論\n\n請看 [官方文件](https://example.test/doc)，**重點**如下：\n\n- 第一點\n- 第二點\n\n```python\nprint("不要唸")\n```\n完畢。'
    const text = plainText(md)
    expect(text).not.toContain('print')
    expect(text).not.toContain('https://')
    expect(text).not.toMatch(/[#*`\[\]]/)
    expect(text).toContain('請看 官方文件')
    expect(text).toContain('第一點')
    expect(text).toContain('完畢。')
  })

  it('表格的分隔線不唸', () => {
    expect(plainText('| 甲 | 乙 |\n|---|---|\n| 1 | 2 |')).not.toContain('---')
  })

  it('整則都是程式碼：沒有可以唸的字', () => {
    expect(plainText('```js\nconsole.log(1)\n```')).toBe('')
  })

  it('還沒寫完的程式碼區塊（沒有結尾）也不唸', () => {
    expect(plainText('說明\n```js\nconst a = 1')).toBe('說明')
  })
})

describe('splitForSpeech', () => {
  it('照句子切', () => {
    expect(splitForSpeech('第一句。第二句？第三句')).toEqual(['第一句。', '第二句？', '第三句'])
  })

  it('太長的句子照長度切，不會漏字', () => {
    const long = '字'.repeat(25)
    const parts = splitForSpeech(long, 10)
    expect(parts.map((p) => p.length)).toEqual([10, 10, 5])
    expect(parts.join('')).toBe(long)
  })

  it('空白不產生空的段落', () => {
    expect(splitForSpeech('  \n \n')).toEqual([])
  })
})
