/**
 * layoutSnapshot — 讓重新整理時的整頁骨架和真畫面一模一樣。
 *
 *   離開頁面（重新整理、關分頁、切到背景）的那一刻，量下目前畫面上每一塊的位置與大小：
 *     面板（大塊底色，例如 .paper 卡片）、小方塊（按鈕、膠囊、輸入框、圖示）、每一行文字的位置
 *   存在 localStorage（只存位置、大小、圓角與底色，不存任何文字內容）。
 *   下次載入同一頁、同樣的視窗大小與深淺色時，SkelPage 直接照這份畫骨架；
 *   對不上（第一次、換了視窗大小）才用 Skeleton.tsx 裡手刻的版本。
 *
 *   不要量的區塊（對話框、提示、背景波浪）加 data-skel-skip。
 */

/** 一塊：s＝面板、b＝小方塊、t＝一行文字 */
export interface SnapItem {
    k: 's' | 'b' | 't'
    x: number
    y: number
    w: number
    h: number
    /** 圓角（px） */
    r?: number
    /** 面板：1＝是 .paper（用一樣的玻璃樣子畫）；否則用 bg 底色 */
    p?: 1
    bg?: string
}

interface Snapshot {
    w: number
    h: number
    theme: string
    at: number
    items: SnapItem[]
}

const STORE_KEY = 'corphia.layoutSnapshot.v1'
/** 最多記幾種「頁面 × 視窗大小 × 深淺色」 */
const MAX_SNAPSHOTS = 12
/** 一頁最多記幾塊（太多代表畫面很長，超出部分不需要） */
const MAX_ITEMS = 900
/** 面板的門檻：比這大、而且裡面還有東西的有底色區塊，算「面板」（裡面的東西也要畫） */
const SURFACE_MIN_W = 120
const SURFACE_MIN_H = 56
/** 圖示的大小上限（以下畫成圓點）、大圖的圓角 */
const ICON_MAX = 32
const IMAGE_R = 12
/** 骨架快照放多久還算數（毫秒）：太舊的版面可能已經改過 */
const MAX_AGE = 30 * 24 * 3600 * 1000

/** 依網址分「頁」：同一頁不同對話共用一份 */
export function pageKind(pathname: string): string {
    if (pathname.startsWith('/login')) return 'login'
    if (pathname.startsWith('/admin')) return 'admin'
    if (pathname.startsWith('/share')) return 'share'
    if (pathname.startsWith('/chat/')) return 'chat-conv'
    if (pathname === '/' || pathname.startsWith('/chat')) return 'chat'
    return ''
}

const currentTheme = () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light')
const keyOf = (kind: string, w: number, h: number, theme: string) => `${kind}|${w}x${h}|${theme}`

function readAll(): Record<string, Snapshot> {
    try {
        return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') as Record<string, Snapshot>
    } catch {
        return {}
    }
}

function writeAll(all: Record<string, Snapshot>) {
    // 只留最近的幾份
    const keys = Object.keys(all).sort((a, b) => all[b].at - all[a].at)
    const kept: Record<string, Snapshot> = {}
    keys.slice(0, MAX_SNAPSHOTS).forEach((k) => (kept[k] = all[k]))
    try {
        localStorage.setItem(STORE_KEY, JSON.stringify(kept))
    } catch {
        /* 存不了（無痕、空間滿）就算了，下次用手刻骨架 */
    }
}

const transparent = (c: string) => !c || c === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(c)

/** 圓角：百分比換成 px，超大值（膠囊）夾到短邊的一半 */
function radiusOf(cs: CSSStyleDeclaration, w: number, h: number): number {
    const raw = cs.borderTopLeftRadius
    const v = raw.endsWith('%') ? (parseFloat(raw) / 100) * Math.min(w, h) : parseFloat(raw) || 0
    return Math.round(Math.min(v, Math.min(w, h) / 2))
}

/** 量目前畫面 */
export function captureLayout(root: Element = document.body): SnapItem[] {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const items: SnapItem[] = []
    const inView = (r: DOMRect) => r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < vw && r.top < vh
    const push = (k: SnapItem['k'], r: DOMRect, extra: Partial<SnapItem> = {}) => {
        if (items.length >= MAX_ITEMS) return
        items.push({ k, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), ...extra })
    }

    const walk = (el: Element) => {
        if (items.length >= MAX_ITEMS) return
        const role = el.getAttribute('role')
        if (el.hasAttribute('data-skel-skip') || role === 'dialog' || role === 'tooltip' || role === 'alert') return
        const cs = getComputedStyle(el)
        if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) return
        const r = el.getBoundingClientRect()
        const tag = el.tagName
        // 圖示、圖片：一個小方塊
        if (tag === 'svg' || tag === 'IMG' || tag === 'CANVAS' || tag === 'VIDEO') {
            // 小圖示畫成圓點；大圖（字標、圖表）畫成圓角方塊
            const m = Math.min(r.width, r.height)
            if (inView(r)) push('b', r, { r: radiusOf(cs, r.width, r.height) || Math.round(m <= ICON_MAX ? m / 2 : Math.min(IMAGE_R, m / 4)) })
            return
        }
        const hasBg = !transparent(cs.backgroundColor) || cs.backgroundImage !== 'none' || (cs.backdropFilter && cs.backdropFilter !== 'none')
        const isField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
        const isPaper = el.classList.contains('paper')
        if ((hasBg || isField) && inView(r)) {
            const big = r.width >= SURFACE_MIN_W && r.height >= SURFACE_MIN_H && el.childElementCount > 0
            if (isPaper || (big && !isField)) {
                push('s', r, { r: radiusOf(cs, r.width, r.height), ...(isPaper ? { p: 1 as const } : { bg: cs.backgroundColor }) })
            } else {
                // 按鈕、膠囊、輸入框：整塊一個灰方塊，裡面的字和圖示不用再畫
                push('b', r, { r: radiusOf(cs, r.width, r.height) })
                return
            }
        }
        for (const child of Array.from(el.childNodes)) {
            if (child.nodeType === Node.TEXT_NODE) {
                const text = child.textContent || ''
                if (!text.trim()) continue
                const range = document.createRange()
                range.selectNodeContents(child)
                const fs = parseFloat(cs.fontSize) || 14
                for (const lr of Array.from(range.getClientRects())) {
                    if (!inView(lr)) continue
                    // 灰條高度＝字身（字級 × 0.78），垂直置中在這一行
                    const bh = Math.round(fs * 0.78)
                    push('t', new DOMRect(lr.left, lr.top + (lr.height - bh) / 2, lr.width, bh))
                }
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                walk(child as Element)
            }
        }
    }
    walk(root)
    return items
}

/** 離開頁面時記下目前版面 */
export function saveLayoutSnapshot(pathname: string) {
    const kind = pageKind(pathname)
    if (!kind) return
    // 正在載入（畫面上還有骨架）、開著對話框時不記
    if (document.querySelector('.skel, .skel-text, [role="dialog"], .skel-fade-out')) return
    const root = document.getElementById('root')
    if (!root) return
    const items = captureLayout(root)
    if (items.length < 5) return
    const all = readAll()
    const w = window.innerWidth
    const h = window.innerHeight
    const theme = currentTheme()
    all[keyOf(kind, w, h, theme)] = { w, h, theme, at: Date.now(), items }
    writeAll(all)
}

/** 這一頁、這個視窗大小、這個深淺色有沒有記過；有就回傳 */
export function loadLayoutSnapshot(pathname: string): SnapItem[] | null {
    const kind = pageKind(pathname)
    if (!kind || typeof window === 'undefined') return null
    const snap = readAll()[keyOf(kind, window.innerWidth, window.innerHeight, currentTheme())]
    if (!snap || Date.now() - snap.at > MAX_AGE) return null
    return snap.items
}

/** 掛一次：離開頁面、切到背景時記下版面（App 啟動時呼叫） */
export function installLayoutSnapshot() {
    const save = () => saveLayoutSnapshot(window.location.pathname)
    window.addEventListener('pagehide', save)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') save()
    })
}
