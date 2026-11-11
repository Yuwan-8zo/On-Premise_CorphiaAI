/**
 * usePolling — 每 N 毫秒輪詢一次後端，把結果存成 state。
 *
 * ⚠️ 以前有一個會無限 fetch 的 bug：
 *   呼叫端慣例都是傳 inline arrow function：
 *
 *     const { data } = usePolling(async () => api.getXxx(), 5000)
 *
 *   每次 render 都產生「新的 arrow function reference」，所以：
 *     1. fetcher 引用變了 → useCallback 的 refetch 重建 →
 *     2. useEffect 的 [refetch] 變了 → effect 重跑 →
 *     3. effect 內 `refetch()` 立即呼叫一次 →
 *     4. setData 觸發 re-render → 回到 1
 *
 *   這個正回授會在幾百毫秒內把 backend 打爆，全域 rate limit 直接炸開。
 *
 * 修法：把 fetcher 存在 ref，refetch 不依賴它，useEffect 也不依賴 fetcher。
 *   只有 intervalMs / enabled 變化才重建 interval，正常情況下整個生命週期
 *   只設一次 setInterval。
 */
import { useEffect, useRef, useState, useCallback } from 'react'

export function usePolling<T>(
    fetcher: () => Promise<T>,
    intervalMs: number,
    enabled = true,
): { data: T | null; error: Error | null; refetch: () => void } {
    const [data, setData] = useState<T | null>(null)
    const [error, setError] = useState<Error | null>(null)

    // 把最新的 fetcher 寫到 ref；ref 變動不會觸發 re-render，
    // 也不會讓下面的 useCallback / useEffect 跟著重建。
    const fetcherRef = useRef(fetcher)
    fetcherRef.current = fetcher

    // 空 deps → refetch 永遠是同一個 reference
    const refetch = useCallback(async () => {
        try {
            setData(await fetcherRef.current())
            setError(null)
        } catch (e) {
            setError(e as Error)
        }
    }, [])

    useEffect(() => {
        if (!enabled) return

        const tick = () => {
            if (typeof document !== 'undefined' && document.hidden) return
            void refetch()
        }

        tick()
        const id = setInterval(tick, intervalMs)
        return () => clearInterval(id)
    }, [refetch, intervalMs, enabled])

    return { data, error, refetch }
}

// ---------------------------------------------------------------------------
// useSharedPolling — 多個元件要同一份資料時共用一次輪詢（同一個 key 只打一次 API）。
// 第一個使用的元件開始輪詢、最後一個離開時停止；新加入的元件立刻拿到目前的資料。
// ---------------------------------------------------------------------------
type Shared = { data: unknown; listeners: Set<(d: unknown) => void>; timer: ReturnType<typeof setInterval> | null }
const sharedPolls = new Map<string, Shared>()

export function useSharedPolling<T>(key: string, fetcher: () => Promise<T>, intervalMs: number): T | null {
    const fetcherRef = useRef(fetcher)
    fetcherRef.current = fetcher
    const [data, setData] = useState<T | null>(() => (sharedPolls.get(key)?.data as T | undefined) ?? null)

    useEffect(() => {
        let entry = sharedPolls.get(key)
        if (!entry) {
            entry = { data: null, listeners: new Set(), timer: null }
            sharedPolls.set(key, entry)
        }
        const e = entry
        const listener = (d: unknown) => setData(d as T)
        e.listeners.add(listener)
        if (e.data !== null) setData(e.data as T)

        if (!e.timer) {
            const tick = async () => {
                if (typeof document !== 'undefined' && document.hidden) return
                try {
                    e.data = await fetcherRef.current()
                    e.listeners.forEach((l) => l(e.data))
                } catch {
                    /* 下一輪再試 */
                }
            }
            void tick()
            e.timer = setInterval(tick, intervalMs)
        }
        return () => {
            e.listeners.delete(listener)
            if (!e.listeners.size) {
                if (e.timer) clearInterval(e.timer)
                sharedPolls.delete(key)
            }
        }
    }, [key, intervalMs])

    return data
}
