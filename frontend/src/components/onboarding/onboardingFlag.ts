/**
 * 新手導覽「已看過」的標記（存在瀏覽器，每個帳號分開記）。導覽元件、設定頁的「重新觀看導覽」、聊天頁共用。
 *   v2：改成小 AI 帶的導覽，並且跟帳號綁在一起——新註冊的帳號第一次登入一定會看到，
 *   同一台電腦換別的帳號登入也會各自看一次。（v1 是整台瀏覽器共用一個標記）
 * 讀不到（例如私密瀏覽）時當作已看過，避免每次都跳出來。
 */
const KEY_PREFIX = 'corphia.onboarding.v2.'

const keyOf = (userId: string | undefined) => `${KEY_PREFIX}${userId ?? 'guest'}`

export function isOnboardingDone(userId: string | undefined): boolean {
    try {
        return localStorage.getItem(keyOf(userId)) === '1'
    } catch {
        return true
    }
}

export function markOnboardingDone(userId: string | undefined) {
    try {
        localStorage.setItem(keyOf(userId), '1')
    } catch {
        /* 存不了就算了 */
    }
}

export function resetOnboarding(userId: string | undefined) {
    try {
        localStorage.removeItem(keyOf(userId))
    } catch {
        /* 存不了就算了 */
    }
}
