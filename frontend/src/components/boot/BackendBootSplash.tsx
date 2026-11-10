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

type StepState = 'pending' | 'running' | 'done' | 'error' | 'skipped'

interface LauncherStep {
    key: string
    label: string
    state: StepState
    detail: string
    started_at: number | null
    finished_at: number | null
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
    const size = m.name.match(/(\d+(?:\.\d+)?B)/i)?.[1]?.toUpperCase() ?? m.name
    return `AI 模型 ${size}（${m.size_gb.toFixed(1)} GB）`
}

function modelRow(m: ModelState): Row {
    const map: Record<ModelState['state'], StepState> = {
        pending: 'pending',
        loading: 'running',
        ready: 'done',
        error: 'error',
        not_preloaded: 'skipped',
    }
    const detail =
        m.state === 'not_preloaded'
            ? '不預先載入（需要時再切換）'
            : m.state === 'error'
              ? m.error || '載入失敗'
              : m.state === 'loading'
                ? '從硬碟載入模型權重…'
                : m.state === 'ready'
                  ? m.is_current ? '已載入・使用中' : '已載入・可立即切換'
                  : m.is_current ? '等待載入（使用中的模型）' : '等待載入'
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
    return s >= 60 ? `${Math.floor(s / 60)} 分 ${s % 60} 秒` : `${s} 秒`
}

function StateIcon({ state }: { state: StepState }) {
    if (state === 'running') {
        return <div className="h-4 w-4 rounded-full border-2 border-accent/20 border-t-accent animate-spin" />
    }
    if (state === 'done') {
        return (
            <Check className="h-4 w-4 text-emerald-500" />
        )
    }
    if (state === 'error') {
        return (
            <X className="h-4 w-4 text-red-500" />
        )
    }
    if (state === 'skipped') {
        return <div className="h-0.5 w-3 rounded bg-text-muted/50" />
    }
    return <div className="h-2 w-2 rounded-full bg-text-muted/40" />
}

const STATE_TEXT: Record<StepState, string> = {
    pending: '等待中',
    running: '載入中',
    done: '完成',
    error: '失敗',
    skipped: '略過',
}

interface BackendBootSplashProps {
    /** 全部就緒時觸發 */
    onReady: () => void
}

export default function BackendBootSplash({ onReady }: BackendBootSplashProps) {
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

    if (!firstChecked || readyAtFirstCheck.current) return null

    // ── 組出畫面上的每一列 ──────────────────────────────────────────
    const rows: Row[] = []
    const launcherFresh = launcher && launcher.overall !== 'stopped'
    if (launcherFresh) {
        for (const s of launcher.steps) {
            // 後端已經回應，就算狀態檔慢一步也直接視為完成
            const state: StepState = apiUp && s.state !== 'error' && s.state !== 'skipped' ? 'done' : s.state
            rows.push({ key: s.key, label: s.label, state, detail: s.detail, started: s.started_at, finished: state === 'done' ? (s.finished_at ?? s.started_at) : s.finished_at })
        }
    } else {
        rows.push({ key: 'backend', label: '後端 API 伺服器', state: apiUp ? 'done' : 'running', detail: apiUp ? '已連線' : '等待後端回應…', started: firstSeen.current, finished: apiUp ? firstSeen.current : null })
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
    rows.push({ key: 'rag', label: '文件檢索模型（Embedding）', state: ragState, detail: ragState === 'done' ? '可依企業文件回答' : ragState === 'running' ? '載入中…' : ragState === 'error' ? '載入失敗' : '等待後端', started: null, finished: null })

    if (models.length) {
        // 使用中的模型放最前面，其餘依大小排序
        const sorted = [...models].sort((a, b) => Number(b.is_current) - Number(a.is_current) || a.size_gb - b.size_gb)
        rows.push(...sorted.map(modelRow))
    } else {
        rows.push({ key: 'models', label: 'AI 模型（3B／7B）', state: backendStarted ? 'running' : 'pending', detail: backendStarted ? '載入模型中…' : '等待後端啟動後開始載入', started: null, finished: null })
    }

    const totalStart = launcherFresh ? launcher.started_at : firstSeen.current
    const totalSec = Math.max(0, Math.round(now - totalStart))
    const launcherError = launcherFresh && launcher.overall === 'error'
    const launcherStale =
        launcherFresh && launcher.overall === 'starting' && !apiUp && now - launcher.updated_at > STALE_SEC
    const stopped = launcher?.overall === 'stopped' && !apiUp
    const doneCount = rows.filter((r) => r.state === 'done' || r.state === 'skipped').length

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center overflow-y-auto bg-bg-base">
            <div
                className="absolute inset-0 pointer-events-none opacity-50"
                style={{ background: 'radial-gradient(ellipse 800px 400px at 50% 20%, rgba(180, 148, 102, 0.08), transparent 70%)' }}
            />

            <div className="relative z-10 w-full max-w-xl px-6 py-10">
                <div className="mb-6 flex items-center gap-4">
                    {/* 向量標誌：C 跟文字色、星星跟系統強調色 */}
                    <CorphiaLogo className="h-12 w-12 select-none text-text-primary" />
                    <div className="flex-1">
                        <h1 className="text-xl font-semibold tracking-tight text-text-primary">Corphia AI 啟動中</h1>
                        <p className="text-sm text-text-muted">
                            {allReady ? '全部就緒，正在進入系統…' : `已完成 ${doneCount} / ${rows.length} 項・已經過 ${totalSec >= 60 ? `${Math.floor(totalSec / 60)} 分 ${totalSec % 60} 秒` : `${totalSec} 秒`}`}
                        </p>
                    </div>
                </div>

                <ul className="divide-y divide-[var(--paper-line)] overflow-hidden rounded-[20px] snow-well">
                    {rows.map((r) => (
                        <li key={r.key} className="flex items-center gap-3 px-4 py-3">
                            <div className="flex w-5 justify-center">
                                <StateIcon state={r.state} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className={`text-sm font-medium ${r.state === 'skipped' || r.state === 'pending' ? 'text-text-muted' : 'text-text-primary'}`}>{r.label}</p>
                                {r.detail && <p className={`truncate text-xs ${r.state === 'error' ? 'text-red-500' : 'text-text-muted'}`}>{r.detail}</p>}
                            </div>
                            <div className="shrink-0 text-right">
                                <p className={`text-xs font-medium ${r.state === 'running' ? 'text-accent' : r.state === 'done' ? 'text-emerald-500' : r.state === 'error' ? 'text-red-500' : 'text-text-muted'}`}>{STATE_TEXT[r.state]}</p>
                                <p className="text-[11px] tabular-nums text-text-muted">{fmtSec(r, now)}</p>
                            </div>
                        </li>
                    ))}
                </ul>

                {(launcherError || launcherStale || stopped) && (
                    <div className="mt-4 rounded-[14px] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-text-primary">
                        <p className="font-medium">
                            {stopped ? '系統目前是關閉狀態' : launcherError ? '啟動過程發生錯誤' : '啟動程式沒有回應'}
                        </p>
                        {launcherError && launcher?.message && <p className="mt-1 break-words text-xs text-text-secondary">{launcher.message}</p>}
                        <p className="mt-1 text-xs text-text-secondary">請雙擊「一鍵關閉」，再雙擊「一鍵啟動」。</p>
                    </div>
                )}

                <p className="mt-6 text-center text-[11px] text-text-muted/70">地端部署 · 所有回答都由本機 AI 產生 · 資料 100% 留在本機</p>
            </div>
        </div>
    )
}
