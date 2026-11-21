/**
 * 小 AI 的身體顏色：跟著它「後面的背景色」走（使用者要求）
 *
 *   1. backdropColor：把小 AI 正中心那一點、畫在它後面的所有底色一層一層疊起來（html／body 底色、
 *      各層 div 的底色、背景波浪 SVG 的填色與透明度），得到實際看到的背景色。
 *      「在後面」＝小 AI 的祖先，或文件順序排在小 AI 前面的元素。
 *   2. tintFor：色相照背景；深色背景往亮推、淺色背景往暗推（白眼睛才看得清楚）。
 *      亮推照《Liquid Glass 元件規範》光邊公式：亮度 ＝ min(0.97, 背景亮度 ＋ 0.45)、彩度 ＝ 背景彩度 ×（1.4 − 背景亮度）。
 *      顏色在 OKLCH 裡算（亮度、彩度、色相分開，換亮度時色相不跑掉）。
 */

type RGBA = [number, number, number, number]

/** 背景亮度超過這個算「淺色背景」 */
const LIGHT_BG = 0.6
/** 光邊公式（規範）：深色背景往亮推多少、亮度上限、彩度放大的基準 */
const LIFT = 0.45
const LIFT_MAX = 0.97
const CHROMA_BASE = 1.4
/** 淺色背景：往暗推多少、亮度下限、彩度至少多少（太淡的話白眼睛看不清楚） */
const DROP = 0.38
const DROP_MIN = 0.5
const CHROMA_MIN_LIGHT = 0.06
/** 彩度低於這個算「沒有顏色」的灰 */
const NEUTRAL_C = 0.005

function parseColor(v: string | null | undefined): RGBA | null {
    if (!v) return null
    const m = v.match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number)
    if (p.length < 3 || p.some((n) => Number.isNaN(n))) return null
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]
}

const over = (top: RGBA, base: RGBA): RGBA => {
    const a = top[3]
    return [top[0] * a + base[0] * (1 - a), top[1] * a + base[1] * (1 - a), top[2] * a + base[2] * (1 - a), 1]
}

/** 這個元素自己畫出來的顏色（底色，或 SVG 圖形的填色） */
function paintOf(el: Element): RGBA | null {
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none') return null
    const opacity = parseFloat(cs.opacity) || 0
    // SVG 圖形（背景波浪）：用填色；測試環境（jsdom）沒有 SVGGeometryElement
    if (typeof SVGGeometryElement !== 'undefined' && el instanceof SVGGeometryElement) {
        const fill = parseColor(cs.fill)
        if (!fill) return null
        fill[3] *= opacity * (parseFloat(cs.fillOpacity) || 0)
        return fill[3] > 0 ? fill : null
    }
    const bg = parseColor(cs.backgroundColor)
    if (!bg || bg[3] === 0) return null
    bg[3] *= opacity
    return bg
}

/** 小 AI 正中心那一點、在它後面實際看到的背景色 */
export function backdropColor(mascot: Element): RGBA {
    const r = mascot.getBoundingClientRect()
    const x = r.left + r.width / 2
    const y = r.top + r.height / 2
    let color: RGBA = parseColor(getComputedStyle(document.documentElement).backgroundColor) ?? [0, 0, 0, 1]
    if (color[3] < 1) color = over(color, [255, 255, 255, 1])
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT)
    for (let node: Node | null = document.body; node; node = walker.nextNode()) {
        const el = node as Element
        if (el === mascot) break
        // 小 AI 前面、不是祖先，但會蓋到它上面的（例如固定的浮層）不算：只看蓋住中心點的
        const b = el.getBoundingClientRect()
        if (x < b.left || x > b.right || y < b.top || y > b.bottom) continue
        const paint = paintOf(el)
        if (paint) color = over(paint, color)
    }
    return color
}

// ── sRGB ↔ OKLCH ──
const toLin = (c: number) => {
    const v = c / 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}
const toSrgb = (v: number) => {
    const c = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055
    return Math.round(Math.min(1, Math.max(0, c)) * 255)
}
function toOklch([r, g, b]: RGBA): [number, number, number] {
    const [lr, lg, lb] = [toLin(r), toLin(g), toLin(b)]
    const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
    const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
    const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
    const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
    const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
    const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
    return [L, Math.hypot(A, B), Math.atan2(B, A)]
}
function fromOklch(L: number, C: number, h: number): [number, number, number] {
    const A = C * Math.cos(h)
    const B = C * Math.sin(h)
    const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
    const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
    const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3
    return [
        toSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
        toSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
        toSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    ]
}

/** 背景色 → 小 AI 的顏色（"r g b"，給 CSS 的 rgb(var(--m-tint) / a) 用）＋ 背景是不是淺色 */
export function tintFor(bg: RGBA): { tint: string; light: boolean } {
    const [L, C, h] = toOklch(bg)
    const light = L > LIGHT_BG
    // 背景幾乎沒有顏色（純灰）時色相沒有意義：維持灰，不要硬加彩度（不然會變成隨便一個顏色）
    const neutral = C < NEUTRAL_C
    const rgb = light
        ? fromOklch(Math.max(DROP_MIN, L - DROP), neutral ? C : Math.max(CHROMA_MIN_LIGHT, C * (CHROMA_BASE + L)), h)
        : fromOklch(Math.min(LIFT_MAX, L + LIFT), C * (CHROMA_BASE - L), h)
    return { tint: rgb.join(' '), light }
}
