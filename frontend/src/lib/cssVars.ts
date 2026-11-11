/**
 * 從 CSS 設定讀出實際的數值（設定只在 styles/tokens.css 定義一次，程式不寫死）
 *   - readPx('--dock-w')：用一個隱藏的量測元素把 calc、單位都算好，回傳像素
 *   - readNum('--sw-sm')：沒有單位的倍數
 *   - useCssPx([...])：元件裡用；視窗大小、或根元素的設定（例如 --ui-unit）改變時自動重讀
 */
import { useEffect, useState } from 'react'

let probe: HTMLDivElement | null = null

export function readPx(name: string): number {
    if (typeof document === 'undefined' || !document.body) return 0
    if (!probe || !probe.isConnected) {
        probe = document.createElement('div')
        probe.setAttribute('aria-hidden', 'true')
        probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;left:-9999px;top:0;height:0;'
        document.body.appendChild(probe)
    }
    probe.style.width = `var(${name})`
    return parseFloat(getComputedStyle(probe).width) || 0
}

export function readNum(name: string): number {
    if (typeof document === 'undefined') return 0
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0
}

/** 讀一組像素設定；回傳 name → 像素 */
export function useCssPx(names: readonly string[]): Record<string, number> {
    const key = names.join('|')
    const read = () => Object.fromEntries(names.map((n) => [n, readPx(n)]))
    const [values, setValues] = useState<Record<string, number>>(read)

    useEffect(() => {
        const update = () => setValues((prev) => {
            const next = read()
            return names.every((n) => prev[n] === next[n]) ? prev : next
        })
        update()
        window.addEventListener('resize', update)
        // 根元素的 style／class 改變（例如調整 --ui-unit、切換主題）也重讀
        const mo = new MutationObserver(update)
        mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] })
        return () => { window.removeEventListener('resize', update); mo.disconnect() }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key])

    // 設定名稱換了（例如側欄展開／收合改用不同的內距）：新的名稱當下就讀，不等下一幀
    const missing = names.filter((n) => !(n in values))
    return missing.length ? { ...values, ...Object.fromEntries(missing.map((n) => [n, readPx(n)])) } : values
}

/** 數值或設定名稱（'--seg-pad'）→ 像素；給元件的尺寸參數用 */
export type PxOrVar = number | `--${string}`
