/**
 * 新手引導「已看過」的標記（存在瀏覽器）。引導元件、設定頁的「重新觀看引導」、聊天頁共用。
 * 讀不到（例如私密瀏覽）時當作已看過，避免每次都跳出來。
 */
export const ONBOARDING_FLAG_KEY = 'corphia.onboarding.v1.done'

export function isOnboardingDone(): boolean {
    try {
        return localStorage.getItem(ONBOARDING_FLAG_KEY) === '1'
    } catch {
        return true
    }
}

export function markOnboardingDone() {
    try {
        localStorage.setItem(ONBOARDING_FLAG_KEY, '1')
    } catch {
        /* 存不了就算了 */
    }
}

export function resetOnboarding() {
    try {
        localStorage.removeItem(ONBOARDING_FLAG_KEY)
    } catch {
        /* 存不了就算了 */
    }
}
