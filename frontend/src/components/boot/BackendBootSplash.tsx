/**
 * BackendBootSplash — 啟動狀態畫面
 * ===================================================
 *
 * 一鍵啟動時，前端會最先開好、瀏覽器馬上打開；後端、資料庫、AI 模型還在載入。
 * 這個畫面逐項顯示每個服務的即時狀態，讓使用者知道「現在在等什麼」：
 *
 *   - /boot-status.json   由 start.py 寫入：Docker、資料庫、AI 引擎、資料表、後端 API
 *   - /api/v1/health      由後端提供：文件檢索模型、每個 AI 模型（3B / 7B / 14B）
 *
 * 全部就緒（使用中的模型、預先載入的模型、文件檢索都完成）才進入系統，
 * 進去之後問問題就不必再等模型載入。
 */

import { Check, X } from '@/components/snow/icons'
import { useEffect, useRef, useState } from 'react'
import { CorphiaLogo } from '@/components/icons/CorphiaIcons'
import { SkelPage } from '@/components/ui/SkelPages'
import WaveBackground from '@/components/ui/WaveBackground'
import { useTranslation } from 'react-i18next'
import i18n from '@/i18n'
import { modelSize } from '@/lib/modelName'

type StepState = 'pending' | 'running' | 'done' | 'error' | 'skipped'

interface LauncherStep {
    key: string
    label: string
    state: StepState
    detail: string
    started_at: number | null
    finished_at: number | null
    /** 說明的代碼（啟動程式提供；前端依它顯示目前語言，沒有就直接用 detail） */
    code?: string | null
}

interface LauncherStatus {
    run_id: string
    overall: 'starting' | 'ready' | 'error' | 'stopped'
    started_at: number
    updated_at: number
    message: string
    steps: LauncherStep[]
}

interface ModelState {
    name: string
    size_gb: number
    state: 'pending' | 'loading' | 'ready' | 'error' | 'not_preloaded'
    is_current: boolean
    started_at: number | null
    finished_at: number | null
    error: string
}

interface Health {
    status: string
    llm: string
    rag: string
    models?: ModelState[]
}

interface Row {
    key: string
    label: string
    state: StepState
    detail: string
    started: number | null
    finished: number | null
}

const POLL_MS = 1000
/** 啟動程式超過這麼久沒更新狀態檔，且後端也沒回應 → 視為啟動程式已停止 */
const STALE_SEC = 45

async function getJson<T>(url: string): Promise<T | null> {
    try {
        const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(2500) })
        if (!res.ok) return null
        return (await res.json()) as T
    } catch {
        return null
    }
}

function modelLabel(m: ModelState): string {
    const size = modelSize(m.name) ?? m.name
    return i18n.t('ui.boot.modelLabel', { size, gb: m.size_gb.toFixed(1) })
}

function modelRow(m: ModelState): Row {
    const map: Record<ModelState['state'], StepState> = {
        pending: 'pending',
        loading: 'running',
        ready: 'done',
        error: 'error',
        not_preloaded: 'skipped',
    }
    // is_current ＝ 系統預設模型（每個人可以各自切換，見後端 model_preference）
    const detail =
        m.state === 'not_preloaded'
            ? i18n.t('ui.boot.detail.notPreloaded')
            : m.state === 'error'
              ? m.error || i18n.t('ui.boot.detail.loadFailed')
              : m.state === 'loading'
                ? i18n.t('ui.boot.detail.loadingWeights')
                : m.state === 'ready'
                  ? i18n.t(m.is_current ? 'ui.boot.detail.readyDefault' : 'ui.boot.detail.readySwitchable')
                  : i18n.t(m.is_current ? 'ui.boot.detail.waitingDefault' : 'ui.boot.detail.waiting')
    return {
        key: `model-${m.name}`,
        label: modelLabel(m),
        state: map[m.state],
        detail,
        started: m.started_at,
        finished: m.finished_at,
    }
}

function fmtSec(row: Row, now: number): string {
    if (!row.started) return ''
    const end = row.finished ?? now
    const s = Math.max(0, Math.round(end - row.started))
    return fmtDuration(s)
}

/** 幾分幾秒（目前語言） */
function fmtDuration(s: number): string {
    return s >= 60 ? i18n.t('ui.boot.minSec', { m: Math.floor(s / 60), s: s % 60 }) : i18n.t('ui.boot.sec', { s })
}

/** 狀態圖示：28 的圓形（Apple 清單列的圖示底），讀取中不轉圈、用強調色圓點呼吸 */
function StateIcon({ state }: { state: StepState }) {
    const tone =
        state === 'done' ? 'bg-[color-mix(in_srgb,var(--sys-green)_15%,transparent)] text-[var(--ink-green)]'
        : state === 'error' ? 'bg-[color-mix(in_srgb,var(--sys-red)_15%,transparent)] text-[var(--danger-ink)]'
        : state === 'running' ? 'bg-accent/15 text-accent'
        : 'bg-[var(--chip)] text-text-muted'
    return (
        <span className={`flex h-[var(--sz-28)] w-[var(--sz-28)] shrink-0 items-center justify-center rounded-full ${tone}`}>
            {state === 'done' && <Check className="h-[var(--sz-14)] w-[var(--sz-14)]" />}
            {state === 'error' && <X className="h-[var(--sz-14)] w-[var(--sz-14)]" />}
            {state === 'running' && <span className="skel h-[var(--sz-10)] w-[var(--sz-10)] !rounded-full !bg-current" />}
            {state === 'skipped' && <span className="h-[var(--sz-2)] w-[var(--sz-10)] rounded-full bg-current" />}
            {state === 'pending' && <span className="h-[var(--sz-6)] w-[var(--sz-6)] rounded-full bg-current opacity-60" />}
        </span>
    )
}

/** 狀態文字（目前語言） */
const stateText = (state: StepState) => i18n.t(`ui.boot.state.${state}`)

interface BackendBootSplashProps {
    /** 全部就緒時觸發 */
    onReady: () => void
}

export default function BackendBootSplash({ onReady }: BackendBootSplashProps) {
    // 換語言時重繪（文字都用 i18n.t 取，這裡只是訂閱語言變化）
    useTranslation()
    const [launcher, setLauncher] = useState<LauncherStatus | null>(null)
    const [health, setHealth] = useState<Health | null>(null)
    const [now, setNow] = useState(() => Date.now() / 1000)
    const firstSeen = useRef(Date.now() / 1000)
    const readyFired = useRef(false)
    // 第一次檢查完成前不畫任何東西；第一次就全部就緒（例如登出後重新載入）→ 直接進入，不閃啟動畫面
    const [firstChecked, setFirstChecked] = useState(false)
    const readyAtFirstCheck = useRef(false)

    useEffect(() => {
        let cancelled = false
        const tick = async () => {
            const [l, h] = await Promise.all([
                getJson<LauncherStatus>(`/boot-status.json?t=${Date.now()}`),
                getJson<Health>('/api/v1/health'),
            ])
            if (cancelled) return
            setLauncher(l)
            setHealth(h)
            setNow(Date.now() / 1000)
            setFirstChecked((was) => {
                if (!was) {
                    const ms = h?.models ?? []
                    readyAtFirstCheck.current = h?.status === 'ok' && h?.llm === 'ready' && h?.rag === 'ready' &&
                        !ms.some((m) => m.state === 'pending' || m.state === 'loading' || m.state === 'error')
                }
                return true
            })
        }
        tick()
        const id = setInterval(tick, POLL_MS)
        return () => {
            cancelled = true
            clearInterval(id)
        }
    }, [])

    const models = health?.models ?? []
    const apiUp = health?.status === 'ok'
    const allReady =
        apiUp &&
        health?.llm === 'ready' &&
        health?.rag === 'ready' &&
        !models.some((m) => m.state === 'pending' || m.state === 'loading' || m.state === 'error')

    useEffect(() => {
        if (allReady && !readyFired.current) {
            readyFired.current = true
            // 一開始就全部就緒：直接進入；啟動過程中才停一下讓使用者看到「全部完成」
            const t = setTimeout(onReady, readyAtFirstCheck.current ? 0 : 900)
            return () => clearTimeout(t)
        }
    }, [allReady, onReady])

    // 等第一次健康檢查、或一開始就全部就緒時：顯示所在頁面的骨架（跟之後載入頁面的骨架接起來，重整不會有一段空白）
    if (!firstChecked || readyAtFirstCheck.current) return <SkelPage />

    // ── 組出畫面上的每一列 ──────────────────────────────────────────
    const rows: Row[] = []
    const launcherFresh = launcher && launcher.overall !== 'stopped'
    if (launcherFresh) {
        for (const s of launcher.steps) {
            // 後端已經回應，就算狀態檔慢一步也直接視為完成
            const state: StepState = apiUp && s.state !== 'error' && s.state !== 'skipped' ? 'done' : s.state
            // 名稱與說明依代碼顯示目前語言；啟動程式沒給代碼的（例如網址、錯誤原因）照原樣
            const label = i18n.t(`ui.boot.step.${s.key}`, { defaultValue: s.label })
            let detail = s.code ? i18n.t(`ui.boot.detail.${s.code}`, { defaultValue: s.detail }) : s.detail
            // 後端已經回應、但狀態檔還寫著「啟動中」：說明也改成已連線，不要「完成」配「啟動中…」
            if (s.key === 'backend' && state === 'done' && s.state !== 'done') detail = i18n.t('ui.boot.detail.connected')
            rows.push({ key: s.key, label, state, detail, started: s.started_at, finished: state === 'done' ? (s.finished_at ?? s.started_at) : s.finished_at })
        }
    } else {
        rows.push({ key: 'backend', label: i18n.t('ui.boot.step.backend'), state: apiUp ? 'done' : 'running', detail: i18n.t(apiUp ? 'ui.boot.detail.connected' : 'ui.boot.detail.waitingBackend'), started: firstSeen.current, finished: apiUp ? firstSeen.current : null })
    }

    // 後端已啟動但正忙著載入模型時，health 偶爾會逾時；這時應顯示「載入中」而不是「等待後端」
    const backendStarted = apiUp || Boolean(launcherFresh && launcher.steps.some((s) => s.key === 'backend' && s.state === 'done'))
    const ragState: StepState = !apiUp
        ? backendStarted ? 'running' : 'pending'
        : health?.rag === 'ready'
          ? 'done'
          : health?.rag === 'error' || health?.rag === 'unavailable'
            ? 'error'
            : 'running'
    const ragDetail = { done: 'ragReady', running: 'loading', error: 'loadFailed', pending: 'backendNotUp', skipped: 'skipped' }[ragState]
    rows.push({ key: 'rag', label: i18n.t('ui.boot.step.rag'), state: ragState, detail: i18n.t(`ui.boot.detail.${ragDetail}`), started: null, finished: null })

    if (models.length) {
        // 使用中的模型放最前面，其餘依大小排序
        const sorted = [...models].sort((a, b) => Number(b.is_current) - Number(a.is_current) || a.size_gb - b.size_gb)
        rows.push(...sorted.map(modelRow))
    } else {
        rows.push({ key: 'models', label: i18n.t('ui.boot.step.models'), state: backendStarted ? 'running' : 'pending', detail: i18n.t(backendStarted ? 'ui.boot.detail.loadingModels' : 'ui.boot.detail.waitAfterBackend'), started: null, finished: null })
    }

    const totalStart = launcherFresh ? launcher.started_at : firstSeen.current
    const totalSec = Math.max(0, Math.round(now - totalStart))
    const launcherError = launcherFresh && launcher.overall === 'error'
    const launcherStale =
        launcherFresh && launcher.overall === 'starting' && !apiUp && now - launcher.updated_at > STALE_SEC
    const stopped = launcher?.overall === 'stopped' && !apiUp
    const doneCount = rows.filter((r) => r.state === 'done' || r.state === 'skipped').length

    return (
        <div className="fixed inset-0 z-[10000] flex justify-center overflow-y-auto bg-bg-base">
            {/* 背景：系統的波浪圖（同登入、聊天頁） */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden"><WaveBackground /></div>

            <div className="relative z-10 my-auto w-full max-w-[var(--sz-560)] px-6 py-8 page-in">
                {/* 標題：品牌圖示＋Title2 22／28 粗體＋Subheadline 15／20 次要字 */}
                <div className="mb-[var(--sp-20)] flex items-center gap-4 px-[var(--sp-12)]">
                    <CorphiaLogo className="h-[var(--sz-44)] w-[var(--sz-44)] shrink-0 select-none text-text-primary" />
                    <div className="min-w-0 flex-1">
                        <h1 className="text-[length:var(--fs-22)] leading-[var(--lh-28)] font-bold text-text-primary [text-wrap:balance]">{i18n.t('ui.boot.title')}</h1>
                        <p className="mt-0.5 text-[length:var(--fs-15)] leading-[var(--lh-20)] text-text-secondary tabular-nums">
                            {allReady ? i18n.t('ui.boot.allReady') : i18n.t('ui.boot.progress', { done: doneCount, total: rows.length, time: fmtDuration(totalSec) })}
                        </p>
                    </div>
                </div>

                {/* 清單：Liquid Glass 卡（圓角 26＝狀態圖示 14＋離邊 12，同心）；列 15／20＋13／18，每列 52 高 */}
                <ul className="boot-list paper !rounded-[var(--r-26)] overflow-hidden">
                    {rows.map((r) => (
                        <li key={r.key} className="set-row !min-h-0 !gap-[var(--sp-12)] !px-[var(--sp-12)] !py-[var(--sp-8)]">
                            <StateIcon state={r.state} />
                            <div className="min-w-0 flex-1">
                                <p className={`text-[length:var(--fs-15)] leading-[var(--lh-20)] font-semibold ${r.state === 'skipped' || r.state === 'pending' ? 'text-text-muted' : 'text-text-primary'}`}>{r.label}</p>
                                {r.detail && <p className={`break-words text-[length:var(--fs-13)] leading-[var(--lh-18)] ${r.state === 'error' ? 'text-[var(--danger-ink)]' : 'text-text-secondary'}`}>{r.detail}</p>}
                            </div>
                            <div className="shrink-0 text-right">
                                <p className={`text-[length:var(--fs-13)] leading-[var(--lh-18)] font-semibold ${r.state === 'running' ? 'text-accent' : r.state === 'done' ? 'text-[var(--ink-green)]' : r.state === 'error' ? 'text-[var(--danger-ink)]' : 'text-text-muted'}`}>{stateText(r.state)}</p>
                                <p className="text-[length:var(--fs-12)] leading-[var(--lh-16)] tabular-nums text-text-muted">{fmtSec(r, now)}</p>
                            </div>
                        </li>
                    ))}
                </ul>

                {(launcherError || launcherStale || stopped) && (
                    <div className="paper !rounded-[var(--r-26)] mt-4 px-[var(--sp-20)] py-[var(--sp-14)]">
                        <p className="text-[length:var(--fs-15)] leading-[var(--lh-20)] font-semibold text-[var(--danger-ink)]">
                            {i18n.t(stopped ? 'ui.boot.stopped' : launcherError ? 'ui.boot.launchError' : 'ui.boot.noResponse')}
                        </p>
                        {launcherError && launcher?.message && <p className="mt-1 break-words text-[length:var(--fs-13)] leading-[var(--lh-18)] text-text-secondary">{launcher.message}</p>}
                        <p className="mt-1 text-[length:var(--fs-13)] leading-[var(--lh-18)] text-text-secondary">{i18n.t('ui.boot.restartHint')}</p>
                    </div>
                )}

                <p className="mt-[var(--sp-20)] text-center text-[length:var(--fs-12)] leading-[var(--lh-16)] text-text-muted">{i18n.t('ui.boot.footer')}</p>
            </div>
        </div>
    )
}
