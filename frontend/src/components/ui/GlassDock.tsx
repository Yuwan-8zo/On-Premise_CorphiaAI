/**
 * GlassDock — 玻璃選單鈕（《Liquid Glass 元件規範》：右下選單的邏輯；放在右上角，所以往下展開）
 *
 * 尺寸全部讀 styles/tokens.css 的 --dock-*（以下數字是預設值）
 * 平常：只有一顆玻璃圓鈕（外殼 40、按鈕 36，配合頂部列高度）
 * 點一下：往下展開只有圖示的直列（列距 42），⋯ 變成 ×；再點一下、點外面或按 Esc 收合；滑鼠停留在左邊顯示名稱
 * 定點按住 0.32 秒、或按下後直接往下滑：列變寬成 79、圓角 33，每列 75×62 並顯示文字
 *   （同心放大：寬版右上角圓弧（半徑 33）和圓鈕（半徑 20）同一個圓心，外殼往上、往右各外擴 13；放大鏡四邊凸出外殼一樣多）
 *   放大鏡 93×88、圓角 40，跟著手指（每幀追 30%），中心不超過第一列與最後一列；
 *   鏡內圖示與文字放大 1.12 倍並變強調色，鏡片底下原本的項目隱藏（不重影）
 * 放開：在項目上就執行該項目；在 × 上只關閉；選單立刻收合，放大鏡留在原地 0.3 秒淡出並縮到 0.95
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useCssPx } from '@/lib/cssVars'
import { MoreHorizontal, X } from '@/components/snow/icons'
import Tooltip from '@/components/ui/Tooltip'
import { LENS_CFG, LENS_MAG, LENS_SX, LENS_SY, reduceMotion, roundRectHole, shoulderMask } from './lensKit'
import { useTranslation } from 'react-i18next'

export interface DockItem {
    id: string
    label: string
    icon: React.ReactNode
    tone?: 'danger' | 'success'
    onSelect: () => void
}

interface Props {
    items: DockItem[]
    'aria-label'?: string
    className?: string
}

// 尺寸都在 styles/tokens.css 的 --dock-*（不寫死）；凸出量、同心圓角、外擴量由它們算
const DOCK_VARS = ['--dock-n', '--dock-btn', '--dock-gap', '--dock-pad', '--dock-w', '--dock-r', '--dock-row-w', '--dock-row-h', '--dock-lens-w', '--dock-lens-h'] as const
const LONG_PRESS_MS = LENS_CFG.pressWait

export default function GlassDock({ items, className = '', 'aria-label': ariaLabelProp }: Props) {
    const { t } = useTranslation()
    const ariaLabel = ariaLabelProp ?? t('ui.dock.menu')
    const [open, setOpen] = useState(false)
    const [wide, setWide] = useState(false)
    const [lensY, setLensY] = useState<number | null>(null) // 放大鏡中心（相對外殼頂端）
    const [leaving, setLeaving] = useState<{ y: number } | null>(null)
    const wrapRef = useRef<HTMLDivElement>(null)
    const press = useRef<{ id: number; y0: number; timer: number; wideNow: boolean; startedOpen: boolean } | null>(null)
    const target = useRef(0)
    const cur = useRef(0)
    const raf = useRef(0)

    // 尺寸（窄：配合頂部列；寬：照規範）
    const px = useCssPx(DOCK_VARS)
    const SHELL_N = px['--dock-n'], BTN_N = px['--dock-btn'], GAP_N = px['--dock-gap'], PAD = px['--dock-pad']
    const SHELL_W = px['--dock-w'], R_WIDE = px['--dock-r'], ROW_W = px['--dock-row-w'], ROW_H = px['--dock-row-h']
    // 放大鏡＝圓角方形（寬高接近 1：1，四邊留直線段）
    const LENS_W = px['--dock-lens-w'], LENS_H = px['--dock-lens-h']
    const LENS_OUT = (LENS_W - SHELL_W) / 2 // 放大鏡凸出外殼的量（四邊一樣，同心）
    const LENS_R = R_WIDE + LENS_OUT // 同心：外殼圓角＋凸出量
    const GROW_OUT = R_WIDE - SHELL_N / 2 // 同心放大：外殼往上、往右外擴，右上角圓弧和圓鈕同一個圓心
    // 肩的遮罩（長邊＝鏡片高、短邊＝鏡片寬）
    const DOCK_WALL = useMemo(() => shoulderMask(LENS_H, LENS_W, LENS_OUT, SHELL_W, true, LENS_R), [LENS_H, LENS_W, LENS_OUT, SHELL_W, LENS_R])

    // 列：第 0 列＝選單鈕（⋯／×），後面是項目
    const rows = items.length + 1
    const rowH = wide ? ROW_H : BTN_N
    const gap = wide ? 0 : GAP_N
    const shellW = wide ? SHELL_W : SHELL_N
    const shellH = open ? PAD * 2 + rows * rowH + (rows - 1) * gap : SHELL_N

    const close = () => {
        setOpen(false); setWide(false); setLensY(null)
        cancelAnimationFrame(raf.current); raf.current = 0
    }

    // 點外面、Esc 收合
    useEffect(() => {
        if (!open) return
        const onDown = (e: PointerEvent) => { if (!wrapRef.current?.contains(e.target as Node)) close() }
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
        window.addEventListener('pointerdown', onDown)
        window.addEventListener('keydown', onKey)
        return () => { window.removeEventListener('pointerdown', onDown); window.removeEventListener('keydown', onKey) }
    }, [open])

    useEffect(() => () => cancelAnimationFrame(raf.current), [])

    // 放大鏡跟手：每幀追上 30%
    const loop = () => {
        cur.current += (target.current - cur.current) * (reduceMotion() ? 1 : LENS_CFG.follow)
        setLensY(cur.current)
        raf.current = Math.abs(target.current - cur.current) > 0.3 ? requestAnimationFrame(loop) : 0
        if (!raf.current) setLensY(target.current)
    }
    const follow = (y: number) => {
        target.current = y
        if (!raf.current) raf.current = requestAnimationFrame(loop)
    }
    // 放大鏡中心的範圍：四邊凸出外殼都是 LENS_OUT（和左右一樣），不會頂到螢幕上緣
    const wideH = PAD * 2 + rows * ROW_H
    const shellX = wide ? SHELL_N + GROW_OUT - SHELL_W : 0 // 外殼左緣（相對選單鈕）
    const shellY = wide ? -GROW_OUT : 0 // 外殼上緣（相對選單鈕）
    const yToWide = (clientY: number) => {
        const r = wrapRef.current!.getBoundingClientRect()
        const y = clientY - r.top + GROW_OUT // 換成寬版外殼的座標（外殼上緣在選單鈕上方 13）
        return Math.max(LENS_H / 2 - LENS_OUT, Math.min(wideH - LENS_H / 2 + LENS_OUT, y))
    }
    const enterWide = (clientY: number) => {
        setOpen(true); setWide(true)
        const y = yToWide(clientY)
        cur.current = y; target.current = y
        setLensY(y)
    }

    const onPointerDown = (e: React.PointerEvent) => {
        if (e.button > 0) return
        const startedOpen = open
        const timer = window.setTimeout(() => {
            if (press.current) { press.current.wideNow = true; enterWide(press.current.y0) }
        }, LONG_PRESS_MS)
        press.current = { id: e.pointerId, y0: e.clientY, timer, wideNow: false, startedOpen }
        try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* 部分瀏覽器不支援 */ }
    }
    const onPointerMove = (e: React.PointerEvent) => {
        const p = press.current
        if (!p || p.id !== e.pointerId) return
        if (!p.wideNow && Math.abs(e.clientY - p.y0) > LENS_CFG.slop) {
            // 直接滑動：立刻展開有文字的選單
            clearTimeout(p.timer); p.wideNow = true; enterWide(e.clientY)
            return
        }
        if (p.wideNow) follow(yToWide(e.clientY))
    }
    const finish = (e: React.PointerEvent, commit: boolean) => {
        const p = press.current
        if (!p || p.id !== e.pointerId) return
        clearTimeout(p.timer)
        press.current = null
        if (p.wideNow) {
            const y = cur.current
            const idx = Math.round((y - PAD - ROW_H / 2) / ROW_H)
            // 放大鏡留在原地 0.3 秒淡出並縮到 0.95，選單立刻收合
            setLeaving({ y })
            window.setTimeout(() => setLeaving(null), LENS_CFG.leave)
            close()
            if (commit && idx >= 1 && idx <= items.length) items[idx - 1].onSelect()
            return
        }
        if (!commit) return
        // 點一下：點在選單鈕上＝開合；點在項目上＝執行並收合
        const r = wrapRef.current!.getBoundingClientRect()
        const idx = Math.round((e.clientY - r.top - PAD - BTN_N / 2) / (BTN_N + GAP_N))
        if (idx <= 0 || !p.startedOpen) { setOpen((o) => !o); return }
        if (idx <= items.length) { close(); items[idx - 1].onSelect() }
    }

    // 放大鏡幾何（寬版）
    const lensL = shellW / 2 - LENS_W / 2
    const lensT = lensY !== null ? lensY - LENS_H / 2 : 0
    // 規範：選單的玻璃（模糊、底色、光邊）和鏡片底下的項目，在鏡片位置整個挖掉，改由鏡片自己做一整片模糊
    const lensOn = wide && lensY !== null
    const hole = lensOn ? roundRectHole(lensL, lensT, LENS_W, LENS_H, LENS_R) : undefined
    // 肩：鏡內縮小的選單（縱向 0.93）在那一側延伸到鏡片外才接上；移到最上／最下一格時那一側淡掉，底面順著選單的圓頭彎過去
    const lensCY = lensT + LENS_H / 2
    const shTop = lensCY * LENS_SX > LENS_H / 2 ? 1 : 0
    const shBottom = (wideH - lensCY) * LENS_SX > LENS_H / 2 ? 1 : 0

    const rowContent = (i: number, ghost: boolean) => {
        const isBtn = i === 0
        const it = isBtn ? null : items[i - 1]
        const icon = isBtn ? (open ? <X /> : <MoreHorizontal />) : it!.icon
        const tone = it?.tone === 'danger' ? 'text-[#ff4245]' : it?.tone === 'success' ? 'text-[#30d158]' : 'text-text-primary'
        // 放大鏡出現時：鏡片外的項目一律白色；鏡片蓋到的項目才變色（一般＝強調色，驗證＝綠、刪除＝紅）
        const lensTone = it?.tone === 'danger' || it?.tone === 'success' ? tone : 'text-accent'
        return (
            <span
                key={i}
                className={`dock-row ${wide ? 'is-wide' : ''} ${ghost ? lensTone : lensY !== null ? 'text-text-primary' : tone}`}
                style={{ width: wide ? ROW_W : BTN_N, height: rowH }}
            >
                <span className="dock-icon">{icon}</span>
                {wide && <span className="dock-label">{isBtn ? t('common.close') : it!.label}</span>}
            </span>
        )
    }

    return (
        <div
            ref={wrapRef}
            className={`dock-wrap ${className}`}
            style={{ width: SHELL_N, height: SHELL_N }}
        >
            <div
                role="menu"
                aria-label={ariaLabel}
                className={`dock-shell glass-chip ${open ? 'is-open' : ''}`}
                style={{
                    width: shellW,
                    height: shellH,
                    borderRadius: wide ? R_WIDE : SHELL_N / 2,
                    transform: `translate(${shellX}px, ${shellY}px)`, // 同心放大：右上角圓弧和圓鈕同一個圓心
                    ['--R' as string]: `${wide ? R_WIDE : SHELL_N / 2}px`,
                    ...hole,
                }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={(e) => finish(e, true)}
                onPointerCancel={(e) => finish(e, false)}
                onContextMenu={(e) => e.preventDefault()}
            >
                <div className="dock-rows" style={{ padding: PAD, gap }}>
                    {Array.from({ length: open ? rows : 1 }, (_, i) => {
                        const isBtn = i === 0
                        const node = rowContent(i, false)
                        // 圖示模式：滑鼠停留時在左邊顯示名稱（長按展開有文字時不顯示）
                        if (wide) return node
                        return (
                            <Tooltip key={i} placement="left" label={isBtn ? (open ? t('common.close') : ariaLabel) : items[i - 1].label}>
                                <button
                                    type="button"
                                    role={isBtn ? undefined : 'menuitem'}
                                    aria-label={isBtn ? (open ? t('ui.dock.closeMenu') : ariaLabel) : items[i - 1].label}
                                    aria-expanded={isBtn ? open : undefined}
                                    onKeyDown={(e) => {
                                        if (e.key !== 'Enter' && e.key !== ' ') return
                                        e.preventDefault()
                                        if (isBtn) setOpen((o) => !o)
                                        else { close(); items[i - 1].onSelect() }
                                    }}
                                    className={`dock-btn ${isBtn && open ? '' : ''}`}
                                >
                                    {node}
                                </button>
                            </Tooltip>
                        )
                    })}
                </div>
            </div>

            {/* 放大鏡（直的，規範右下選單：93×88、圓角 40） */}
            {wide && lensY !== null && (
                <div
                    aria-hidden
                    className="lens is-active is-v dock-lens"
                    style={{ left: shellX + lensL, top: shellY + lensT, width: LENS_W, height: LENS_H, borderRadius: LENS_R }}
                >
                    {/* 凹陷：跟一般／專案同一套——縮小的選單（橫向 0.768、縱向 0.93）＋肩（鏡內整片挖掉左右兩條底面），
                        肩分上下兩半，最上／最下一格時那一半淡掉，露出選單的圓頭 */}
                    <span className="lens-ink">
                        <span
                            className="lens-bar"
                            style={{
                                left: -lensL, top: -lensT, width: shellW, height: wideH, borderRadius: R_WIDE,
                                transformOrigin: `${lensL + LENS_W / 2}px ${lensT + LENS_H / 2}px`,
                                transform: `scale(${LENS_SY}, ${LENS_SX})`,
                            }}
                        />
                        {/* 肩：跟一般／專案同一個遮罩（底面末端用圓弧彎進肩裡，不是直角），轉 90 度 */}
                        <span className="lens-wall" style={{ ['--lens-wall-mask' as string]: DOCK_WALL }}>
                            <i className="t" style={{ opacity: shTop }} />
                            <i className="b" style={{ opacity: shBottom }} />
                        </span>
                    </span>
                    <div
                        className="absolute left-0 top-0 flex flex-col"
                        style={{
                            width: shellW,
                            padding: PAD,
                            transformOrigin: '0 0',
                            transform: `translate(${LENS_W / 2}px, ${LENS_H / 2}px) scale(${LENS_MAG}) translate(${-LENS_W / 2}px, ${-LENS_H / 2}px) translate(${-lensL}px, ${-lensT}px)`,
                        }}
                    >
                        {Array.from({ length: rows }, (_, i) => rowContent(i, true))}
                    </div>
                    <span className="lens-dish" />
                </div>
            )}
            {leaving && (
                <div
                    aria-hidden
                    className="lens is-active is-v dock-lens is-leaving"
                    style={{ left: SHELL_N + GROW_OUT - SHELL_W / 2 - LENS_W / 2, top: -GROW_OUT + leaving.y - LENS_H / 2, width: LENS_W, height: LENS_H, borderRadius: LENS_R }}
                />
            )}
        </div>
    )
}
