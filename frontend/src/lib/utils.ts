import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

/**
 * 解析後端傳來的時間。後端以 UTC 儲存但字串沒帶時區（例如 2026-10-29T16:16:49），
 * 直接 new Date() 會被當成台灣時間而早 8 小時，這裡補上 Z 再解析。
 */
export function parseServerDate(value: string): Date {
    return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : value + 'Z')
}
