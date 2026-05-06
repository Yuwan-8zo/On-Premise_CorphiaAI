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
        refetch()
        const id = setInterval(refetch, intervalMs)
        return () => clearInterval(id)
    }, [refetch, intervalMs, enabled])

    return { data, error, refetch }
}
