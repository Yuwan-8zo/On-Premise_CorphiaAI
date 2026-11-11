import { useCallback, useLayoutEffect, useRef } from 'react'

/**
 * 回傳一個「永遠是同一個」的函式，呼叫時執行最新版本的 fn。
 * 傳給有 memo 的子元件（例如每一則訊息）時用：父元件重新繪製也不會讓子元件跟著重畫。
 */
export function useStableCallback<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
    const ref = useRef(fn)
    useLayoutEffect(() => {
        ref.current = fn
    })
    return useCallback((...args: A) => ref.current(...args), [])
}
