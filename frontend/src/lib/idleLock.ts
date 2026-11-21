/**
 * 閒置自動鎖定的設定與「最後活動時間」（多個分頁共用）
 *
 *   IDLE_LOCK_MS 沒有任何操作多久就鎖；鎖之前 IDLE_WARN_MS 先跳倒數提醒
 *   最後活動時間寫在 localStorage：在任何一個分頁動一下，其他分頁也算有在用（不會一頁鎖、一頁沒鎖）
 *   鎖定狀態也寫在 localStorage：重新整理或開新分頁還是鎖著，要輸入密碼才能解開
 */
export const IDLE_LOCK_MS = 15 * 60_000
export const IDLE_WARN_MS = 60_000
/** 活動時間最多多久寫一次（滑鼠一直動不用每一下都寫） */
export const ACTIVITY_WRITE_MS = 5_000

export const LAST_ACTIVE_KEY = 'corphia-last-active'
export const LOCKED_KEY = 'corphia-locked'

function read(key: string): string | null {
    try { return localStorage.getItem(key) } catch { return null }
}
function write(key: string, value: string | null) {
    try {
        if (value === null) localStorage.removeItem(key)
        else localStorage.setItem(key, value)
    } catch { /* 無痕模式或被封鎖：只在這一頁有效 */ }
}

let memoryLastActive = Date.now()

export function lastActive(): number {
    const v = Number(read(LAST_ACTIVE_KEY))
    return Math.max(memoryLastActive, Number.isFinite(v) ? v : 0)
}

export function markActive(now = Date.now()) {
    memoryLastActive = now
    write(LAST_ACTIVE_KEY, String(now))
}

export const isLocked = () => read(LOCKED_KEY) === '1'
export const setLocked = (locked: boolean) => write(LOCKED_KEY, locked ? '1' : null)

/** 現在離鎖定還剩幾毫秒（≤ 0＝該鎖了） */
export function msUntilLock(now = Date.now(), last = lastActive()): number {
    return last + IDLE_LOCK_MS - now
}
