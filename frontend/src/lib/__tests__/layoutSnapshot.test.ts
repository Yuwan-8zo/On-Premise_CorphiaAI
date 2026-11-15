/**
 * layoutSnapshot：量畫面時只記「看得到」的部分
 *
 * jsdom 不會排版，所以用 data-rect 指定每一塊的位置大小（x,y,w,h）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { captureLayout } from '@/lib/layoutSnapshot'

let restore: () => void

beforeEach(() => {
    const orig = Element.prototype.getBoundingClientRect
    Element.prototype.getBoundingClientRect = function (this: Element) {
        const [x, y, w, h] = (this.getAttribute('data-rect') || '0,0,0,0').split(',').map(Number)
        return new DOMRect(x, y, w, h)
    }
    restore = () => { Element.prototype.getBoundingClientRect = orig }
    vi.stubGlobal('innerWidth', 1000)
    vi.stubGlobal('innerHeight', 800)
})

afterEach(() => {
    restore()
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
})

const mount = (html: string) => {
    const root = document.createElement('div')
    root.setAttribute('data-rect', '0,0,1000,800')
    root.innerHTML = html
    document.body.appendChild(root)
    return root
}

describe('captureLayout：捲動區的裁切', () => {
    it('被捲到捲動區上面的區塊只記看得到的那一截，不會畫到捲動區外面（蓋住上方的按鈕）', () => {
        const root = mount(`
          <div data-rect="0,100,600,400" style="overflow:auto">
            <div data-rect="0,20,600,200" style="background-color:rgb(40,40,44)"><i data-rect="0,20,10,10"></i></div>
          </div>`)
        const items = captureLayout(root)
        const block = items.find((i) => i.k === 's')!
        expect(block).toMatchObject({ x: 0, y: 100, w: 600, h: 120 })
        expect(items.every((i) => i.y >= 100)).toBe(true)
    })

    it('整塊被捲出去的區塊（連同裡面的東西）完全不記', () => {
        const root = mount(`
          <div data-rect="0,100,600,400" style="overflow:hidden">
            <div data-rect="0,-300,600,200" style="overflow:hidden;background-color:rgb(40,40,44)">
              <button data-rect="10,-290,80,30" style="background-color:rgb(60,60,64)"></button>
            </div>
          </div>`)
        expect(captureLayout(root)).toEqual([])
    })

    it('不裁切的外框（overflow:visible）照舊整塊記', () => {
        const root = mount(`
          <div data-rect="0,100,600,400">
            <button data-rect="10,50,80,30" style="background-color:rgb(60,60,64)"></button>
          </div>`)
        expect(captureLayout(root)).toEqual([expect.objectContaining({ k: 'b', y: 50, h: 30 })])
    })

    it('固定在畫面上的元素（position:fixed）不受外層捲動區裁切', () => {
        const root = mount(`
          <div data-rect="0,100,600,400" style="overflow:hidden">
            <button data-rect="10,10,80,30" style="position:fixed;background-color:rgb(60,60,64)"></button>
          </div>`)
        expect(captureLayout(root)).toEqual([expect.objectContaining({ k: 'b', y: 10, h: 30 })])
    })
})
