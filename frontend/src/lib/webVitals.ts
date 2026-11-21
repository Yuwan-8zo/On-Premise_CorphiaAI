/**
 * 使用者體驗量測（Google 開源的 web-vitals）：每個人實際用的時候量，送回這台主機，後台「總覽」看統計
 *
 *   LCP  主要內容多快畫出來        INP  按下去多快有反應（整次使用最慢的那一下）
 *   CLS  版面有沒有亂跳            FCP  第一個東西多快出現        TTFB  主機多快開始回應
 *
 * 隱私：只送數字、好壞等級、哪一頁（路徑第一段，例如 /、/admin；不含對話編號）、哪種裝置；
 *   不送是誰、不送任何畫面或對話內容。沒有登入就不送（後端也要求登入）。
 * 時機：量到就先存著，畫面切到背景或關掉時一次送出（keepalive：關掉頁面也送得出去）；存滿 FLUSH_AT 筆先送一批。
 */
import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals'
import { useAuthStore } from '@/store/authStore'
import { MQ_DESKTOP } from '@/lib/useMediaQuery'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'
/** 存到幾筆先送一批（後端一次最多收 20 筆） */
const FLUSH_AT = 10
/** 手機／平板的分界（和版面一致：768 以上是平板或電腦，1024 以上是電腦） */
const TABLET_MIN = MQ_DESKTOP
const DESKTOP_MIN = '(min-width: 1024px)'

export interface VitalSample {
    name: Metric['name']
    value: number
    rating: Metric['rating']
    page: string
    device: 'mobile' | 'tablet' | 'desktop'
}

/** 只留路徑第一段、小寫英數：/c/<對話編號> → /c，/admin?tab=x → /admin */
export function pageKey(pathname: string): string {
    const first = (pathname.split('/')[1] ?? '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 30)
    return `/${first}`
}

export function deviceKind(): VitalSample['device'] {
    if (typeof window === 'undefined' || !window.matchMedia) return 'desktop'
    if (window.matchMedia(DESKTOP_MIN).matches) return 'desktop'
    return window.matchMedia(TABLET_MIN).matches ? 'tablet' : 'mobile'
}

let queue: VitalSample[] = []
let started = false

export function flushVitals(): void {
    const token = useAuthStore.getState().accessToken
    if (!queue.length) return
    if (!token) { queue = []; return }
    const items = queue.splice(0, 20)
    void fetch(`${API_BASE_URL}/vitals`, {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ items }),
    }).catch(() => undefined) // 量測送不出去不影響使用
}

function record(m: Metric) {
    queue.push({ name: m.name, value: m.value, rating: m.rating, page: pageKey(location.pathname), device: deviceKind() })
    if (queue.length >= FLUSH_AT) flushVitals()
}

/** App 啟動時呼叫一次 */
export function startWebVitals(): void {
    if (started || typeof window === 'undefined') return
    started = true
    onLCP(record)
    onINP(record)
    onCLS(record)
    onFCP(record)
    onTTFB(record)
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushVitals() })
    window.addEventListener('pagehide', flushVitals)
}

/** 測試用 */
export function _queueForTest(): VitalSample[] { return queue }
