/**
 * lensKit — 「凹進去的放大鏡」（折射）共用工具（《Liquid Glass 元件規範》CSS 35、JS 00、JS 00a）
 * 用在 GlassSegmented（分段切換器／工具列）、GlassNav（直向分段）、GlassSwitch（切換開關）、GlassDock（右上選單）。
 *
 * 規範是活的：所有時間、比例、門檻只在 LENS_CFG 定義一次（名稱對照規範設定表的 --glide-*／--lens-*），元件不寫死數字。
 *
 * 構造（每個元件都一樣，只有尺寸和方向不同）：
 *   底（軌道／列）：顏色畫在裡面一層，放大鏡底下挖洞（capsuleHole／roundRectHole，自動內縮 1px）
 *   鏡片：不補色（透明），鏡內＝底的副本（長邊 0.93；短邊依放大鏡大小算，上下露出的凹陷固定佔鏡片短邊的比例，見 lensCrossScale）＋肩（shoulderMask，單一形狀），和底同色
 *   最上層＝平常的樣子（凹陷底盤／白色旋鈕），按下淡掉、縮回時再蓋回
 * 時間表：見 glideProfile（依行程距離在開關與分頁列兩套之間過渡）與 SYS_CURVE（iOS 26 逐幀量的位置曲線）
 */
import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '@/lib/reducedMotion'

/** 設定表（對照規範 :root 的 --lens-*／--glide-*；毫秒、像素、比例） */
export const LENS_CFG = {
    sx: 0.93, // --lens-sx 鏡內的底沿長邊的縮放
    sy: 0.768, // --lens-sy 鏡內的底垂直長邊的縮放（切換開關用；整條列類用 band 依大小算）
    band: 0.17, // --lens-band 折射凹陷（肩）的寬度佔鏡片短邊的比例（整條列類，見 lensCrossScale）
    zoom: 1.12, // --lens-zoom 鏡內文字與圖示放大倍率
    grow: 120, // --lens-grow 按下時原地長大
    veilOut: 100, // --lens-veil-out 平常的樣子淡掉
    veilWait: 30, // --lens-veil-wait 縮回開始後多久，平常的樣子開始蓋回
    veilIn: 120, // --lens-veil-in 平常的樣子蓋滿
    wallOut: 200, // 肩淡掉（--wall-a 0.2 秒）
    hold: 110, // --lens-hold 按下後放大鏡先原地長大，這麼久之後才開始跟手
    follow: 0.3, // --lens-follow 跟手：每幀（60fps）追上差距的比例
    dtMax: 64, // --lens-dt-max 換算跟手時，一幀最多算幾毫秒
    eps: 0.05, // --lens-eps 差距小於這個（px）就直接到位
    // 點一下滑行的判斷式（--glide-*）
    near: 25, // 行程不超過這個：用開關的時間表
    far: 50, // 行程達到這個：用分頁列的時間表；中間線性過渡
    sBase: 320, sK: 0.7, sMax: 540, sAt: 0.5, sShrink: 280, // 開關（短行程）
    lBase: 156, lK: 0.586, lMax: 330, lAt: 0.64, lShrink: 180, // 分頁列（長行程）
    lead: 30, // --glide-lead 滑行的時間從按下之前多久算起
    pressWait: 320, // --lens-press-wait 定點按住多久算長按
    slop: 6, // 手指移動超過這個（px）才算滑動、不是定點按住
    leave: 300, // 放開後放大鏡原地淡出
    edge: 4, // --lens-edge 選單放大鏡：放大後的內容離放大鏡兩端至少留這麼多（寬的項目自動降低放大倍率）
    minRadius: 8, // 選單放大鏡最小圓角（卡片圓角 − 距離太小時）
    dragSlop: 8, // 從觸發鈕拖進選單：手指在選單外這麼近（px）也算進入、放開也算選取（邊緣的項目好選）
} as const

export const LENS_SX = LENS_CFG.sx
export const LENS_SY = LENS_CFG.sy
/** 鏡內內容（文字、圖示）放大倍率，跟著放大鏡一起長大、縮回 */
export const LENS_MAG = LENS_CFG.zoom

type Anim = { from: number; to: number; t0: number; dur: number; ease: (x: number) => number } | null
type Key = 'pos' | 'grow' | 'veil' | 'wall'
export type LensFrame = Record<Key, number>

const easeGrow = (x: number) => 1 - Math.pow(1 - x, 3) // ≈ cubic-bezier(.2,.7,.3,1)
const easeTrap = (x: number) => x * x * (3 - 2 * x)
const linear = (x: number) => x

/** 點一下滑行的位置曲線：iOS 26 逐幀量的（時間比例 → 位置比例），中間線性內插 */
const SYS_CURVE: ReadonlyArray<readonly [number, number]> = [
    [0, 0], [0.05, 0.045], [0.1, 0.15], [0.15, 0.27], [0.2, 0.4], [0.25, 0.5], [0.29, 0.6], [0.34, 0.68],
    [0.39, 0.74], [0.44, 0.79], [0.49, 0.83], [0.54, 0.86], [0.59, 0.88], [0.69, 0.92], [0.78, 0.94], [0.88, 0.97], [1, 1],
]
export function glideEase(u: number) {
    if (u <= 0) return 0
    if (u >= 1) return 1
    for (let i = 1; i < SYS_CURVE.length; i++) {
        const [u1, p1] = SYS_CURVE[i]
        if (u <= u1) {
            const [u0, p0] = SYS_CURVE[i - 1]
            return p0 + ((p1 - p0) * (u - u0)) / (u1 - u0)
        }
    }
    return 1
}

/**
 * 判斷式：行程短用開關的時間表，行程長用分頁列的時間表（距離越長越快），中間線性過渡。
 * T＝移動時間；at＝縮小在移動時間的哪個比例開始；ms＝縮小用多久
 */
export function glideProfile(px: number) {
    const C = LENS_CFG
    const d = Math.abs(px)
    const s = Math.max(0, Math.min(1, (d - C.near) / (C.far - C.near)))
    const sT = Math.min(C.sMax, C.sBase + d * C.sK)
    const lT = Math.min(C.lMax, C.lBase + d * C.lK)
    return { T: sT + (lT - sT) * s, at: C.sAt + (C.lAt - C.sAt) * s, ms: C.sShrink + (C.lShrink - C.sShrink) * s }
}

/** 系統減少動態效果（共用判斷在 lib/reducedMotion） */
export const reduceMotion = prefersReducedMotion

/**
 * 放大鏡的時間表。pos＝位置（元件自己定義單位），grow＝0 平常～1 放大鏡，veil＝平常的樣子不透明度，wall＝肩的不透明度
 * distPx(a, b)：兩個位置之間的像素距離（判斷行程長短、算滑動時間用）
 */
export function useLensMotion(initial: number, distPx: (a: number, b: number) => number) {
    const [frame, setFrame] = useState<LensFrame>({ pos: initial, grow: 0, veil: 1, wall: 0 })
    const v = useRef<LensFrame>({ pos: initial, grow: 0, veil: 1, wall: 0 })
    const anim = useRef<Record<Key, Anim>>({ pos: null, grow: null, veil: null, wall: null })
    const follow = useRef<number | null>(null)
    const held = useRef(false)
    const downT = useRef(0)
    const lastT = useRef(0)
    const raf = useRef(0)
    const timer = useRef(0 as unknown as ReturnType<typeof setTimeout>)
    const dist = useRef(distPx)
    dist.current = distPx

    const step = (now: number) => {
        const C = LENS_CFG
        const dt = Math.min(C.dtMax, now - (lastT.current || now)) || 1000 / 60
        lastT.current = now
        let busy = false
        for (const k of ['pos', 'grow', 'veil', 'wall'] as const) {
            const an = anim.current[k]
            if (!an) continue
            if (now < an.t0) { busy = true; continue }
            const u = Math.min(1, (now - an.t0) / an.dur)
            v.current[k] = an.from + (an.to - an.from) * an.ease(u)
            if (u >= 1) anim.current[k] = null
            else busy = true
        }
        if (follow.current !== null) {
            // 按下後先原地長大 hold 毫秒才跟手；跟手比例依實際幀時間換算（60fps 時每幀 30%）
            const holding = now - downT.current < C.hold
            const k = holding ? 0 : 1 - Math.pow(1 - C.follow, (dt * 60) / 1000)
            v.current.pos += (follow.current - v.current.pos) * k
            if (dist.current(v.current.pos, follow.current) < C.eps) v.current.pos = follow.current
            busy = true
        }
        setFrame({ ...v.current })
        raf.current = busy ? requestAnimationFrame(step) : 0
        if (!busy) lastT.current = 0
    }
    const run = () => { if (!raf.current) raf.current = requestAnimationFrame(step) }
    const animate = (k: Key, to: number, dur: number, ease: (x: number) => number, delay = 0) => {
        anim.current[k] = { from: v.current[k], to, t0: performance.now() + delay, dur: Math.max(1, dur), ease }
        run()
    }
    const jump = (pos: number) => {
        clearTimeout(timer.current)
        anim.current = { pos: null, grow: null, veil: null, wall: null }
        follow.current = null
        v.current = { pos, grow: 0, veil: 1, wall: 0 }
        setFrame({ ...v.current })
    }

    useEffect(() => () => { cancelAnimationFrame(raf.current); clearTimeout(timer.current) }, [])

    return {
        frame,
        current: v,
        /** 按下：放大鏡原地長大、平常的樣子淡掉、肩出現 */
        press() {
            held.current = true
            downT.current = performance.now()
            clearTimeout(timer.current)
            if (reduceMotion()) return
            anim.current.pos = null
            anim.current.wall = null
            v.current.wall = 1
            animate('grow', 1, LENS_CFG.grow, easeGrow)
            animate('veil', 0, LENS_CFG.veilOut, linear)
        },
        /** 拖曳：位置每幀追上目標（按下後 hold 毫秒才開始）；null＝停止跟手 */
        follow(target: number | null) {
            follow.current = reduceMotion() ? null : target
            if (target !== null && reduceMotion()) { v.current.pos = target; setFrame({ ...v.current }) }
            run()
        },
        /** 點一下切換／放開吸附：邊長大邊滑，到判斷式算出的比例才開始縮回 */
        glideTo(to: number) {
            const C = LENS_CFG
            held.current = false
            follow.current = null
            clearTimeout(timer.current)
            if (reduceMotion()) { jump(to); return }
            const P = glideProfile(dist.current(v.current.pos, to))
            // 滑行時間從按下之前 lead 毫秒算起
            anim.current.pos = { from: v.current.pos, to, t0: performance.now() - C.lead, dur: Math.max(1, P.T), ease: glideEase }
            run()
            if (v.current.grow < 1) { animate('grow', 1, C.grow, easeGrow); v.current.wall = 1; anim.current.wall = null }
            if (v.current.veil > 0) animate('veil', 0, C.veilOut, linear)
            timer.current = setTimeout(() => {
                if (held.current) return
                animate('grow', 0, P.ms, easeTrap)
                animate('veil', 1, C.veilIn, linear, C.veilWait)
                animate('wall', 0, C.wallOut, linear)
            }, Math.max(0, P.T * P.at - C.lead))
        },
        jump,
    }
}

/**
 * 鏡內的底在「垂直長邊」方向的縮放（整條列類：分段切換器、工具列、直的選單）——依放大鏡大小自適應。
 * 折射的樣子＝鏡內的底比鏡片窄，上下各露出一條凹陷的底面（肩）。這條凹陷的寬度固定佔鏡片短邊的 LENS_CFG.band，
 * 所以放大鏡大（長按變大、直的選單）凹陷跟著寬，放大鏡小凹陷跟著窄，每個元件看起來是同一片玻璃。
 * 側欄「一般／專案」用這個比例時≈原本的固定 0.768。
 * 切換開關不用：它的軌道、旋鈕、放大鏡全部等比例縮放，固定的 LENS_SY 本來就和大小無關。
 * lensCross＝放大鏡短邊、barCross＝底的粗細
 */
export function lensCrossScale(lensCross: number, barCross: number) {
    if (!(barCross > 0) || !(lensCross > 0)) return LENS_SY
    return Math.min(1, (lensCross * (1 - 2 * LENS_CFG.band)) / barCross)
}

/** 放大鏡是否在作用中（按住、滑動或縮回中）；平常只顯示凹陷底盤／白色旋鈕 */
export const lensActive = (f: LensFrame) => f.grow > 0.001 || f.veil < 0.999

/**
 * 接縫規則：洞一律比鏡片「內縮」HOLE_INSET（1px），讓鏡片蓋住洞的邊緣。
 * 洞和鏡片一樣大時，兩邊的邊緣各只蓋到半個像素，中間會透出後面的顏色，變成一圈隱約的黑線。
 */
export const HOLE_INSET = 1

/**
 * 兩種挖洞共用的遮罩樣式：第一層是整片，後面的形狀全部加起來，再從整片減掉（＝在元素上挖出這個形狀）。
 * count＝圖層數；合成方式的數量＝圖層數 − 1（第一個是「減掉」，其餘是「加起來」）
 */
function holeMask(img: string, size: string, pos: string, count: number): React.CSSProperties {
    const rest = count - 2
    return {
        WebkitMaskImage: img,
        WebkitMaskSize: size,
        WebkitMaskPosition: pos,
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskComposite: ['source-out', ...Array(rest).fill('source-over')].join(', '),
        maskImage: img,
        maskSize: size,
        maskPosition: pos,
        maskRepeat: 'no-repeat',
        maskComposite: ['subtract', ...Array(rest).fill('add')].join(', '),
    } as React.CSSProperties
}

/**
 * 在元素上挖一個膠囊形的洞（x, y, w, h＝鏡片在元素座標裡的位置與大小；橫的或直的膠囊都可以），自動內縮 HOLE_INSET。
 * 照規範：整片減掉兩個圓＋中間長方形
 */
export function capsuleHole(x0: number, y0: number, w0: number, h0: number): React.CSSProperties {
    const x = x0 + HOLE_INSET, y = y0 + HOLE_INSET, w = Math.max(0, w0 - HOLE_INSET * 2), h = Math.max(0, h0 - HOLE_INSET * 2)
    const r = Math.min(h, w) / 2
    const vertical = h > w
    const [c1x, c1y, c2x, c2y] = vertical ? [x + w / 2, y + r, x + w / 2, y + h - r] : [x + r, y + h / 2, x + w - r, y + h / 2]
    const [rw, rh, rx, ry] = vertical ? [w, Math.max(0, h - 2 * r), x, y + r] : [Math.max(0, w - 2 * r), h, x + r, y]
    const img =
        `linear-gradient(#000 0 0), ` +
        `radial-gradient(circle at ${c1x}px ${c1y}px, #000 ${r - 0.5}px, transparent ${r}px), ` +
        `radial-gradient(circle at ${c2x}px ${c2y}px, #000 ${r - 0.5}px, transparent ${r}px), ` +
        `linear-gradient(#000 0 0)`
    const size = `100% 100%, 100% 100%, 100% 100%, ${rw}px ${rh}px`
    const pos = `0 0, 0 0, 0 0, ${rx}px ${ry}px`
    return holeMask(img, size, pos, 4)
}

/**
 * 在元素上挖一個圓角方形的洞（x, y, w, h＝鏡片的位置與大小，r＝鏡片圓角），自動內縮 HOLE_INSET（圓角同心縮小）。
 * 整片減掉四個角的圓＋橫、直兩塊長方形
 */
export function roundRectHole(x0: number, y0: number, w0: number, h0: number, r0: number): React.CSSProperties {
    const x = x0 + HOLE_INSET, y = y0 + HOLE_INSET, w = Math.max(0, w0 - HOLE_INSET * 2), h = Math.max(0, h0 - HOLE_INSET * 2)
    const R = Math.min(r0 - HOLE_INSET, w / 2, h / 2)
    const circle = (cx: number, cy: number) => `radial-gradient(circle at ${cx}px ${cy}px, #000 ${R - 0.5}px, transparent ${R}px)`
    const layers = [
        'linear-gradient(#000 0 0)',
        circle(x + R, y + R), circle(x + w - R, y + R), circle(x + R, y + h - R), circle(x + w - R, y + h - R),
        'linear-gradient(#000 0 0)', 'linear-gradient(#000 0 0)',
    ]
    const size = ['100% 100%', '100% 100%', '100% 100%', '100% 100%', '100% 100%', `${Math.max(0, w - 2 * R)}px ${h}px`, `${w}px ${Math.max(0, h - 2 * R)}px`].join(', ')
    const pos = ['0 0', '0 0', '0 0', '0 0', '0 0', `${x + R}px ${y}px`, `${x}px ${y + R}px`].join(', ')
    return holeMask(layers.join(', '), size, pos, layers.length)
}

/**
 * 肩的遮罩（規範 JS：maskURI）。W、H＝放大鏡長大後的寬高；o＝放大鏡比底多出去的量；barH＝底的高度。
 * 底的上緣在鏡緣上的交點是 xr；底面從 xr 再往裡 2 開始，用圓弧從「底原本的上緣」彎到「縮小後的上緣」，兩端各留一塊（寬 zw）給肩。
 * 接縫規則：肩是單一形狀（整片減掉上下兩條底面），不另外畫沿鏡緣的細線、不疊漸層——
 * 規範 maskURI 原本那條「往中間消失的細線」會和縮小的底交界，在底面兩端留下隱約的線（違反「鏡內不疊線」）
 */
const maskCache = new Map<string, string>()
/**
 * vertical＝直的放大鏡：W、H 仍是「長邊、短邊」，畫好後整組轉 90 度，輸出寬 H、高 W 的遮罩；rad＝鏡片圓角（預設膠囊 H/2）
 * sy＝鏡內副本的短邊縮放，要和副本實際用的一樣（預設依大小算；切換開關用固定的 LENS_SY）
 */
export function shoulderMask(W: number, H: number, o: number, barH: number, vertical = false, rad?: number, sy = lensCrossScale(H, barH)) {
    const key = [W, H, o, barH, rad ?? 0, sy].map((n) => n.toFixed(3)).join('x') + (vertical ? 'v' : '')
    const hit = maskCache.get(key)
    if (hit) return hit
    const f = (n: number) => +n.toFixed(2)
    const r = rad ?? H / 2
    const xr = r - Math.sqrt(Math.max(0, r * r - (r - o) * (r - o)))
    // 底的副本縮放後的上緣（和鏡內副本用同一個縮放）
    const bandY = f(H / 2 - (barH * sy) / 2 + 0.2)
    const cs = f(xr + 2)
    const rx = f(Math.max(0, bandY - o + 1.3))
    const [vw, vh] = vertical ? [H, W] : [W, H]
    const cut = bandY > 0.5
        ? `<rect x='${cs}' y='-8' width='${f(W - cs * 2)}' height='${f(bandY + 8)}' rx='${rx}' fill='#000'/><rect x='${cs}' y='${f(H - bandY)}' width='${f(W - cs * 2)}' height='${f(bandY + 8)}' rx='${rx}' fill='#000'/>`
        : ''
    const svg =
        `<svg xmlns='http://www.w3.org/2000/svg' width='${f(vw * 10)}' height='${f(vh * 10)}' viewBox='0 0 ${f(vw)} ${f(vh)}' preserveAspectRatio='none'>` +
        `<defs><mask id='m'><rect width='${f(W)}' height='${f(H)}' fill='#fff'/>` +
        cut +
        `</mask></defs><g${vertical ? ` transform='translate(${f(H)} 0) rotate(90)'` : ''}><rect width='${f(W)}' height='${f(H)}' fill='#fff' mask='url(#m)'/></g></svg>`
    const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
    maskCache.set(key, url)
    return url
}

