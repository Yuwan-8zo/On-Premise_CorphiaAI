/**
 * BackendBootSplash — 啟動狀態畫面
 * ===================================================
 *
 * 一鍵啟動時，前端會最先開好、瀏覽器馬上打開；後端、資料庫、AI 模型還在載入。
 * 這個畫面逐項顯示每個服務的即時狀態，讓使用者知道「現在在等什麼」：
 *
 *   - /boot-status.json   由 start.py 寫入：Docker、資料庫、AI 引擎、資料表、後端 API
 *   - /api/v1/health      由後端提供：文件檢索模型、每個 AI 模型
 *
 * 全部就緒（使用中的模型、預先載入的模型、文件檢索都完成）才進入系統，
 * 進去之後問問題就不必再等模型載入。
 *
 * 排版：一頁放得下、不捲動。
 *   標題＋整體進度條
 *   寬畫面兩欄：左「系統服務」（啟動程式的每一步＋文件檢索）、右「AI 模型」（這次要載入的模型）
 *   不預先載入的模型不各佔一列（模型多了會把畫面撐到要捲），收成右欄最後一列「另外 N 個模型：需要時再載入」
 *   窄畫面（手機）兩組上下排
 */

import { Check, X } from '@/components/snow/icons'
import { useEffect, useRef, useState } from 'react'
import { CorphiaLogo } from '@/components/icons/CorphiaIcons'
import { SkelPage } from '@/components/ui/SkelPages'
import WaveBackground from '@/components/ui/WaveBackground'
import { useTranslation } from 'react-i18next'
import i18n from '@/i18n'
import { formatElapsed } from '@/lib/formatElapsed'
import { modelSize } from '@/lib/modelName'
import { useDesktop } from '@/lib/desktop'

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
/** 「不預先載入的模型」收起來的那一列 */
const IDLE_KEY = 'models-idle'
/** 啟動程式超過這麼久沒更新狀態檔，且後端也沒回應 → 視為啟動程式已停止 */
const STALE_SEC = 45
/** 讀不到啟動程式的進度時，清單照這個順序列出系統服務（和 start.py 的 BOOT_STEPS 一致；Docker 只有連外網搜尋才用，不列） */
const FALLBACK_STEPS = ['database', 'engine', 'schema', 'backend'] as const

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
    return formatElapsed(s, (key, vars) => i18n.t(key, vars))
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
    const isDesktop = useDesktop()
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
        // 讀不到啟動程式的進度（例如服務整個沒在跑）：清單照樣完整列出來，不要只剩一列——
        // 使用者才看得出系統有哪些部分、現在是全部都還沒起來。後端有回應時，它前面的每一步一定都完成了
        for (const key of FALLBACK_STEPS) {
            const isBackend = key === 'backend'
            const state: StepState = apiUp ? 'done' : isBackend ? 'running' : 'pending'
            const detail = apiUp ? (isBackend ? 'connected' : 'ready') : isBackend ? 'waitingBackend' : 'backendNotUp'
            rows.push({
                key, label: i18n.t(`ui.boot.step.${key}`), state, detail: i18n.t(`ui.boot.detail.${detail}`),
                started: isBackend ? firstSeen.current : null, finished: apiUp && isBackend ? firstSeen.current : null,
            })
        }
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

    // AI 模型：這次要載入的各佔一列（使用中的放最前面，其餘依大小）；不預先載入的收成一列
    const modelRows: Row[] = []
    if (models.length) {
        const sorted = [...models].sort((a, b) => Number(b.is_current) - Number(a.is_current) || a.size_gb - b.size_gb)
        modelRows.push(...sorted.filter((m) => m.state !== 'not_preloaded').map(modelRow))
        const idle = sorted.filter((m) => m.state === 'not_preloaded')
        if (idle.length) {
            modelRows.push({
                key: IDLE_KEY,
                label: i18n.t('ui.boot.moreModels', { n: idle.length }),
                state: 'skipped',
                detail: idle.map((m) => modelSize(m.name) ?? m.name).join(i18n.t('ui.boot.listSep')),
                started: null,
                finished: null,
            })
        }
    } else {
        modelRows.push({ key: 'models', label: i18n.t('ui.boot.step.models'), state: backendStarted ? 'running' : 'pending', detail: i18n.t(backendStarted ? 'ui.boot.detail.loadingModels' : 'ui.boot.detail.waitAfterBackend'), started: null, finished: null })
    }

    const totalStart = launcherFresh ? launcher.started_at : firstSeen.current
    const totalSec = Math.max(0, Math.round(now - totalStart))
    const launcherError = launcherFresh && launcher.overall === 'error'
    const launcherStale =
        launcherFresh && launcher.overall === 'starting' && !apiUp && now - launcher.updated_at > STALE_SEC
    const stopped = launcher?.overall === 'stopped' && !apiUp
    // 進度讀不到、後端也一直沒回應：服務根本沒在跑（被關掉、或意外結束）。不說清楚的話，畫面會一直停在「載入中」
    const unreachable = !launcherFresh && !stopped && !apiUp && now - firstSeen.current > STALE_SEC
    // 進度只算「要等的」：收起來的那一列（不預先載入的模型）不算
    const counted = [...rows, ...modelRows].filter((r) => r.key !== IDLE_KEY)
    const doneCount = counted.filter((r) => r.state === 'done' || r.state === 'skipped').length
    const progress = allReady ? 1 : counted.length ? doneCount / counted.length : 0

    /** 一組清單：組名＋Liquid Glass 卡（圓角 26＝狀態圖示 14＋離邊 12，同心）；列 15／20＋13／18 */
    const group = (title: string, list: Row[]) => (
        <section className="min-w-0">
            <h2 className="set-header !px-[var(--sp-12)]">{title}</h2>
            <ul className="boot-list paper !rounded-[var(--r-26)] overflow-hidden">
                {list.map((r) => (
                    <li key={r.key} className="set-row !min-h-0 !gap-[var(--sp-12)] !px-[var(--sp-12)] !py-[var(--sp-5)] md:!py-[var(--sp-8)]">
                        <StateIcon state={r.state} />
                        <div className="min-w-0 flex-1">
                            <p className={`truncate text-[length:var(--fs-15)] leading-[var(--lh-20)] font-semibold ${r.state === 'skipped' || r.state === 'pending' ? 'text-text-muted' : 'text-text-primary'}`}>{r.label}</p>
                            {r.detail && <p className={`break-words text-[length:var(--fs-13)] leading-[var(--lh-18)] ${r.state === 'error' ? 'text-[var(--danger-ink)]' : 'text-text-secondary'}`}>{r.detail}</p>}
                        </div>
                        {/* 收起來的那一列不顯示「略過」——它不是這次要等的東西 */}
                        {r.key !== IDLE_KEY && (
                            <div className="shrink-0 text-right">
                                <p className={`text-[length:var(--fs-13)] leading-[var(--lh-18)] font-semibold ${r.state === 'running' ? 'text-accent' : r.state === 'done' ? 'text-[var(--ink-green)]' : r.state === 'error' ? 'text-[var(--danger-ink)]' : 'text-text-muted'}`}>{stateText(r.state)}</p>
                                <p className="text-[length:var(--fs-12)] leading-[var(--lh-16)] tabular-nums text-text-muted">{fmtSec(r, now)}</p>
                            </div>
                        )}
                    </li>
                ))}
            </ul>
        </section>
    )

    return (
        <div className="fixed inset-0 z-[10000] flex justify-center overflow-y-auto bg-bg-base">
            {/* 背景：系統的波浪圖（同登入、聊天頁） */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden"><WaveBackground /></div>

            <div className="relative z-10 my-auto w-full max-w-[var(--sz-560)] md:max-w-[var(--sz-880)] px-6 py-[var(--sp-12)] md:py-[var(--sp-24)] page-in">
                {/* 標題：品牌圖示＋Title2 22／28 粗體＋Subheadline 15／20 次要字 */}
                <div className="mb-[var(--sp-12)] flex items-center gap-4 px-[var(--sp-12)]">
                    <CorphiaLogo className="h-[var(--sz-44)] w-[var(--sz-44)] shrink-0 select-none text-text-primary" />
                    <div className="min-w-0 flex-1">
                        <h1 className="text-[length:var(--fs-22)] leading-[var(--lh-28)] font-bold text-text-primary [text-wrap:balance]">{i18n.t('ui.boot.title')}</h1>
                        <p className="mt-0.5 text-[length:var(--fs-15)] leading-[var(--lh-20)] text-text-secondary tabular-nums">
                            {allReady ? i18n.t('ui.boot.allReady') : i18n.t('ui.boot.progress', { done: doneCount, total: counted.length, time: fmtDuration(totalSec) })}
                        </p>
                    </div>
                </div>
                {/* 整體進度條：不用讀清單也看得出走到哪 */}
                <div
                    className="mx-[var(--sp-12)] mb-[var(--sp-10)] md:mb-[var(--sp-16)] h-1.5 overflow-hidden rounded-full bg-[var(--chip)]"
                    role="progressbar" aria-valuemin={0} aria-valuemax={counted.length} aria-valuenow={doneCount} aria-label={i18n.t('ui.boot.title')}
                >
                    <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>

                <div className="grid items-start gap-[var(--sp-10)] md:gap-[var(--sp-16)] md:grid-cols-2">
                    {group(i18n.t('ui.boot.groupServices'), rows)}
                    {group(i18n.t('ui.boot.groupModels'), modelRows)}
                </div>

                {(launcherError || launcherStale || stopped || unreachable) && (
                    <div className="paper !rounded-[var(--r-26)] mt-4 px-[var(--sp-20)] py-[var(--sp-14)]">
                        <p className="text-[length:var(--fs-15)] leading-[var(--lh-20)] font-semibold text-[var(--danger-ink)]">
                            {i18n.t(stopped ? 'ui.boot.stopped' : unreachable ? 'ui.boot.unreachable' : launcherError ? 'ui.boot.launchError' : 'ui.boot.noResponse')}
                        </p>
                        {launcherError && launcher?.message && <p className="mt-1 break-words text-[length:var(--fs-13)] leading-[var(--lh-18)] text-text-secondary">{launcher.message}</p>}
                        {/* 桌面版關掉再開就會自己把服務帶起來；瀏覽器要請管理主機的人重新啟動 */}
                        <p className="mt-1 text-[length:var(--fs-13)] leading-[var(--lh-18)] text-text-secondary">{i18n.t(isDesktop ? 'ui.boot.reopenHint' : 'ui.boot.restartHint')}</p>
                    </div>
                )}

                <p className="mt-[var(--sp-10)] md:mt-[var(--sp-16)] text-center text-[length:var(--fs-12)] leading-[var(--lh-16)] text-text-muted">{i18n.t('ui.boot.footer')}</p>
            </div>
        </div>
    )
}
