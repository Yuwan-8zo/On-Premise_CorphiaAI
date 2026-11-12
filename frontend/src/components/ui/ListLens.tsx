/**
 * ListLens — 捲動清單裡「目前項目」的放大鏡（側欄對話清單用）：和設定頁側欄（GlassNav）同一套
 *
 *   平常：放大鏡停在目前那一列，只顯示凹陷底盤（.seg-veil，和 .is-current 原本的底盤一樣）
 *   切換：目前項目換了 → 放大鏡長大（四邊多 --lens-over）、照 glideTo 的時間表滑到新的一列，中途縮回成底盤；
 *         鏡內是清單的複本，放大 LENS_MAG（跟著長大），字用強調色
 *
 * 用法：放在捲動區（要 position: relative）的第一個子元素；要跟著的列加 data-lens-row，目前那一列加 .is-current。
 *   <div className="glass-scroll relative lens-list"><ListLens watch={currentId} />…列…</div>
 * 列本身的底盤由 .lens-list 拿掉（改由放大鏡畫），所以沒有放大鏡時（還沒量好）也不會出現兩層底盤。
 * 長按列＝打開選單、手指拖曳＝捲動，這兩個手勢不變：放大鏡只在「切換」時出現。
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { LENS_MAG, lensActive, useLensMotion } from './lensKit'
import { readPx } from '@/lib/cssVars'

type Box = { cy: number; h: number; left: number; w: number }

export default function ListLens({ watch }: { watch: unknown }) {
    const selfRef = useRef<HTMLDivElement | null>(null)
    const ghostRef = useRef<HTMLDivElement | null>(null)
    const [box, setBox] = useState<Box | null>(null)
    const boxRef = useRef<Box | null>(null)
    const lens = useLensMotion(0, (a, b) => Math.abs(b - a))

    /** 目前那一列在捲動區內容座標裡的位置（捲動時跟著內容走，不用重算） */
    const measure = (): Box | null => {
        const host = selfRef.current?.parentElement
        const row = host?.querySelector<HTMLElement>('[data-lens-row].is-current')
        if (!host || !row || !row.offsetParent) return null
        // 用 offset 量（不受縮放影響）：剛按下的列正在「按下縮小」，用畫面上的框量會偏掉
        let top = 0, left = 0, el: HTMLElement | null = row
        while (el && el !== host) { top += el.offsetTop; left += el.offsetLeft; el = el.offsetParent as HTMLElement | null }
        if (el !== host) return null
        return { cy: top + row.offsetHeight / 2, h: row.offsetHeight, left, w: row.offsetWidth }
    }

    // 目前項目換了：第一次直接放好，之後滑過去
    useLayoutEffect(() => {
        const b = measure()
        const prev = boxRef.current
        boxRef.current = b
        setBox(b)
        if (!b) return
        if (!prev) { lens.jump(b.cy); return }
        if (Math.abs(prev.cy - b.cy) > 0.5) {
            // 鏡內複本：切換當下複製一次清單（不含放大鏡自己），滑行期間不再複製
            const host = selfRef.current?.parentElement, g = ghostRef.current
            if (host && g) {
                const c = host.cloneNode(true) as HTMLElement
                c.querySelector('[data-list-lens]')?.remove()
                c.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'))
                // 複本裡的列不能再被當成「目前那一列」量到（複本在捲動區最前面，會先被找到）
                c.querySelectorAll('[data-lens-row]').forEach((el) => el.removeAttribute('data-lens-row'))
                c.removeAttribute('data-fade')
                c.className = `${host.className} lens-ghost`.replace(/\bglass-scroll\b/, '')
                Object.assign(c.style, { position: 'absolute', left: '0', top: '0', width: `${host.clientWidth}px`, height: `${host.scrollHeight}px`, margin: '0', overflow: 'visible', maskImage: 'none', webkitMaskImage: 'none' })
                c.inert = true
                g.replaceChildren(c)
            }
            lens.glideTo(b.cy)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [watch])

    // 清單大小改變（側欄展開、對話增減）：重新量，直接放好
    useEffect(() => {
        const host = selfRef.current?.parentElement
        if (!host || typeof ResizeObserver === 'undefined') return
        const ro = new ResizeObserver(() => {
            const b = measure()
            boxRef.current = b
            setBox(b)
            if (b && !lensActive(lens.current.current)) lens.jump(b.cy)
        })
        ro.observe(host)
        for (const el of Array.from(host.children)) ro.observe(el)
        return () => ro.disconnect()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const f = lens.frame
    const active = lensActive(f)
    const over = box ? readPx('--lens-over') * f.grow : 0
    const lw = box ? box.w + over * 2 : 0
    const lh = box ? box.h + over * 2 : 0
    const L = box ? box.left - over : 0
    const T = f.pos - lh / 2
    const mag = 1 + (LENS_MAG - 1) * f.grow

    return (
        <div ref={selfRef} data-list-lens aria-hidden="true" className={`absolute left-0 top-0 w-0 h-0 pointer-events-none ${active ? 'z-[2]' : 'z-0'}`}>
            {/* 平常在列的下面（只當底盤）；滑行時蓋到列的上面，鏡內是放大的複本 */}
            {box && (
                <div className={`lens list-lens absolute ${active ? 'is-active' : ''}`} style={{ left: L, top: T, width: lw, height: lh, borderRadius: lh / 2 }}>
                    <div
                        ref={ghostRef}
                        className="absolute left-0 top-0"
                        style={{
                            visibility: active ? 'visible' : 'hidden',
                            transformOrigin: '0 0',
                            transform: `translate(${lw / 2}px, ${lh / 2}px) scale(${mag}) translate(${-lw / 2}px, ${-lh / 2}px) translate(${-L}px, ${-T}px)`,
                        }}
                    />
                    {active && <span className="lens-dish" />}
                    <span className="lens-veil seg-veil" style={{ opacity: f.veil }} />
                </div>
            )}
        </div>
    )
}
