/**
 * 延後更新的值：來源一直在變（例如 AI 還在一個字一個字寫）時，等它停下來一小段時間才換成新的。
 * 第一次直接給值，不用等。
 */
import { useEffect, useState } from 'react'

export function useDebounced<T>(value: T, delayMs: number): T {
    const [settled, setSettled] = useState(value)
    useEffect(() => {
        const timer = window.setTimeout(() => setSettled(value), delayMs)
        return () => window.clearTimeout(timer)
    }, [value, delayMs])
    return settled
}
