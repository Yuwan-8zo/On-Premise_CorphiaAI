/**
 * GlassSwitch — 玻璃切換開關（《Liquid Glass 元件規範》：玻璃切換開關、CSS 32／35、JS 00）
 *
 * 尺寸讀 styles/tokens.css 的 --sw-*（預設：軌道 72×32、旋鈕 42×27、離邊 2.5、放大鏡 67×44，中心不動）
 *   sm＝乘 --sw-sm 倍（預設 0.75，給窄的側欄小工具用）；圓角、凸出量、肩都由這些算
 * 狀態：開＝綠色軌道（#30D158）；關＝主要文字色 20%；變色 0.4 秒等速（鏡內鏡外、肩同一段）
 * 按住：白色旋鈕就是放大鏡最上面的一層，跟著長成 67×44 並淡掉，露出「凹進去」的放大鏡：
 *   軌道在鏡片底下挖洞；鏡內是縮小的整條軌道（寬 0.93、高 0.768）＋肩，同一個容器、同一個顏色；
 *   亮邊只在長邊；外圈 --lens-ring-knob
 * 拖曳：每幀追 30%，拖過中線就切換；點一下：邊長大邊滑過去，過一半開始縮回
 * 鍵盤：空白鍵／Enter（原生 button＋role="switch"）。時間表與共用工具在 lensKit.ts。
 */
import { useEffect, useRef } from 'react'
import { readNum, useCssPx } from '@/lib/cssVars'
import { Loader2 } from '@/components/snow/icons'
import { LENS_SX, LENS_SY, capsuleHole, lensActive, shoulderMask, useLensMotion } from './lensKit'

type Size = 'sm' | 'md' | 'lg'

const SW_VARS = ['--sw-w', '--sw-h', '--sw-knob-w', '--sw-knob-h', '--sw-pad', '--sw-lens-w', '--sw-lens-h'] as const

export interface GlassSwitchProps {
    checked: boolean
    onChange: () => void
    loading?: boolean
    disabled?: boolean
    size?: Size
    'aria-label'?: string
    className?: string
}

export default function GlassSwitch({ checked, onChange, loading = false, disabled = false, size = 'md', className = '', 'aria-label': ariaLabel }: GlassSwitchProps) {
    const px = useCssPx(SW_VARS)
    const s = size === 'sm' ? readNum('--sw-sm') || 1 : 1
    const W = px['--sw-w'] * s, H = px['--sw-h'] * s
    const kw = px['--sw-knob-w'] * s, kh = px['--sw-knob-h'] * s, inset = px['--sw-pad'] * s
    const lensW = px['--sw-lens-w'] * s, lensH = px['--sw-lens-h'] * s
    const xOff = inset + kw / 2, xOn = W - inset - kw / 2
    const isDisabled = disabled || loading

    const lens = useLensMotion(checked ? 1 : 0, (a, b) => Math.abs(a - b) * (xOn - xOff))
    const drag = useRef<{ id: number; sx: number; moved: boolean; rect: DOMRect } | null>(null)
    const skipClick = useRef(false)

    // 外部改變狀態（鍵盤、程式）→ 滑過去
    useEffect(() => {
        const to = checked ? 1 : 0
        if (!drag.current && Math.abs(lens.current.current.pos - to) > 0.001) lens.glideTo(to)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [checked])

    const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
        if (isDisabled || e.button > 0) return
        drag.current = { id: e.pointerId, sx: e.clientX, moved: false, rect: e.currentTarget.getBoundingClientRect() }
        try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* 部分瀏覽器不支援 */ }
        lens.press()
    }
    const onPointerMove = (e: React.PointerEvent) => {
        const d = drag.current
        if (!d || d.id !== e.pointerId) return
        if (!d.moved && Math.abs(e.clientX - d.sx) < 4) return
        d.moved = true
        lens.follow(Math.max(0, Math.min(1, (e.clientX - d.rect.left - xOff) / (xOn - xOff))))
    }
    const finish = (e: React.PointerEvent, commit: boolean) => {
        const d = drag.current
        if (!d || d.id !== e.pointerId) return
        drag.current = null
        skipClick.current = true
        lens.follow(null)
        const cur = checked ? 1 : 0
        // 點一下＝切換；拖曳＝拖過中線才切換
        const next = !commit ? cur : d.moved ? (lens.current.current.pos >= 0.5 ? 1 : 0) : 1 - cur
        lens.glideTo(next)
        if (next !== cur) onChange()
    }

    // ── 幾何 ──
    const f = lens.frame
    const cx = xOff + (xOn - xOff) * f.pos
    const lw = kw + (lensW - kw) * f.grow
    const lh = kh + (lensH - kh) * f.grow
    const L = cx - lw / 2
    const T = H / 2 - lh / 2
    const active = lensActive(f)
    const half = lensW / 2
    const shl = cx * LENS_SX > half ? 1 : 0
    const shr = (W - cx) * LENS_SX > half ? 1 : 0
    const sx = 1 - (1 - LENS_SX) * f.grow
    // 開關用固定比例：軌道、旋鈕、放大鏡全部等比例縮放，固定比例本來就和大小無關（見 lensKit 的 lensCrossScale 說明）
    const sy = 1 - (1 - LENS_SY) * f.grow

    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={ariaLabel}
            disabled={isDisabled}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={(e) => finish(e, true)}
            onPointerCancel={(e) => finish(e, false)}
            onClick={() => {
                // 指標操作已在放開時處理；鍵盤（空白鍵／Enter）與外層 label 的點擊在這裡切換
                if (skipClick.current) { skipClick.current = false; return }
                if (!isDisabled) onChange()
            }}
            className={`glass-switch ${checked ? 'is-on' : ''} relative shrink-0 rounded-full touch-none disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
            style={{ width: W, height: H }}
        >
            {/* 軌道（放大鏡底下挖洞；顏色畫在 ::before） */}
            <span aria-hidden className="glass-switch-track absolute inset-0" style={active ? capsuleHole(L, T, lw, lh) : undefined} />

            {/* 放大鏡（平常＝白色旋鈕） */}
            <span aria-hidden className={`lens absolute ${active ? 'is-active' : ''}`} style={{ left: L, top: T, width: lw, height: lh, borderRadius: lh / 2 }}>
                {active && (
                    <>
                        <span className="lens-ink">
                            <span
                                className="lens-bar"
                                style={{ left: -L, top: -T, width: W, height: H, borderRadius: H / 2, transformOrigin: `${L + lw / 2}px ${T + lh / 2}px`, transform: `scale(${sx}, ${sy})` }}
                            />
                            <span className="lens-wall" style={{ opacity: f.wall, ['--lens-wall-mask' as string]: shoulderMask(lensW, lensH, (lensH - H) / 2, H, false, undefined, LENS_SY) /* 同一組公式：鏡片、比軌道凸出（上下一樣）、軌道高 */ }}>
                                <i className="l" style={{ opacity: shl }} />
                                <i className="r" style={{ opacity: shr }} />
                            </span>
                        </span>
                        <span className="lens-dish" />
                    </>
                )}
                <span className="lens-veil sw-veil flex items-center justify-center" style={{ opacity: f.veil }}>
                    {loading && <Loader2 className="animate-spin text-text-secondary" style={{ width: kh * 0.55, height: kh * 0.55 }} />}
                </span>
            </span>
        </button>
    )
}
