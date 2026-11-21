/**
 * 閒置自動鎖定（登入後的每一頁）
 *
 *   IDLE_LOCK_MS 沒有操作 → 鎖住畫面：內容整片蓋掉（不透明，旁人看不到對話），小 AI 閉上眼睛，
 *   要輸入自己的密碼才能解開（走登入 API，解鎖也會寫進稽核紀錄），或直接登出。
 *   鎖之前 IDLE_WARN_MS 先在頂端跳倒數「即將鎖定」，動一下就取消。
 *   AI 正在回答時不算閒置（使用者可能正在看）。多個分頁共用活動時間與鎖定狀態（lib/idleLock）。
 */
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import Mascot from '@/components/mascot/Mascot'
import FloatingInput from '@/features/auth/components/FloatingInput'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'
import { useChatStore } from '@/store/chatStore'
import { getErrorMessage } from '@/lib/errors'
import {
    ACTIVITY_WRITE_MS, IDLE_WARN_MS, LAST_ACTIVE_KEY, LOCKED_KEY,
    expiredSinceLastVisit, isLocked, markActive, msUntilLock, setLocked as persistLocked,
} from '@/lib/idleLock'

const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const
/** 多久檢查一次剩多少時間 */
const TICK_MS = 1000

export default function IdleLock() {
    const { t } = useTranslation()
    const user = useAuthStore((s) => s.user)
    // 一打開就要判斷：之前就鎖著，或上次操作到現在已經超過鎖定時間（關掉分頁再開不能跳過鎖定）
    const [locked, setLocked] = useState(() => {
        if (isLocked()) return true
        if (!expiredSinceLastVisit()) return false
        persistLocked(true)
        return true
    })
    const [left, setLeft] = useState(Infinity)
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const lastWrite = useRef(0)

    // 使用者有在動 → 記下時間（每 ACTIVITY_WRITE_MS 最多寫一次）
    useEffect(() => {
        if (locked) return
        const onActivity = () => {
            const now = Date.now()
            if (now - lastWrite.current < ACTIVITY_WRITE_MS) return
            lastWrite.current = now
            markActive(now)
            setLeft(Infinity)
        }
        markActive()
        for (const e of ACTIVITY_EVENTS) window.addEventListener(e, onActivity, { passive: true })
        return () => { for (const e of ACTIVITY_EVENTS) window.removeEventListener(e, onActivity) }
    }, [locked])

    // 每秒看一次剩多少時間；AI 回答中不算閒置
    useEffect(() => {
        if (locked) return
        const id = window.setInterval(() => {
            if (useChatStore.getState().isStreaming) { markActive(); setLeft(Infinity); return }
            const ms = msUntilLock()
            if (ms <= 0) {
                persistLocked(true)
                setLocked(true)
                return
            }
            setLeft(ms <= IDLE_WARN_MS ? ms : Infinity)
        }, TICK_MS)
        return () => window.clearInterval(id)
    }, [locked])

    // 其他分頁鎖定／解鎖、或有動作 → 這一頁跟著
    useEffect(() => {
        const onStorage = (e: StorageEvent) => {
            if (e.key === LOCKED_KEY) setLocked(e.newValue === '1')
            if (e.key === LAST_ACTIVE_KEY) setLeft(Infinity)
        }
        window.addEventListener('storage', onStorage)
        return () => window.removeEventListener('storage', onStorage)
    }, [])

    const unlock = async (e: FormEvent) => {
        e.preventDefault()
        if (!user?.email || !password || busy) return
        setBusy(true)
        setError(null)
        try {
            const res = await authApi.login({ email: user.email, password })
            useAuthStore.getState().setAuth(user, res.accessToken, res.refreshToken)
            setPassword('')
            markActive()
            persistLocked(false)
            setLocked(false)
            setLeft(Infinity)
        } catch (err) {
            setError(getErrorMessage(err) || t('ui.idle.wrong'))
        } finally {
            setBusy(false)
        }
    }

    const logout = async () => {
        try { await authApi.logout() } catch { /* 主機連不上也照樣清掉本機的登入 */ }
        persistLocked(false)
        useAuthStore.getState().clearAuth()
        window.location.href = '/login'
    }

    if (!locked) {
        if (left === Infinity) return null
        return (
            <div className="conn-banner-wrap" role="status" aria-live="polite">
                <div className="conn-banner glass-chip">
                    <span>{t('ui.idle.soon', { s: Math.ceil(left / 1000) })}</span>
                    <button type="button" className="conn-cancel" onClick={() => { markActive(); setLeft(Infinity) }}>
                        {t('ui.idle.stay')}
                    </button>
                </div>
            </div>
        )
    }

    return (
        <dialog open className="idle-lock" aria-modal="true" aria-labelledby="idle-lock-title">
            <form className="idle-lock-card paper paper-solid" onSubmit={unlock}>
                <Mascot
                    mood={error ? 'sad' : 'cover'}
                    say={error}
                    sayTone="error"
                    label={t('auth.mascotName')}
                    className="idle-lock-mascot"
                />
                <h2 id="idle-lock-title" className="idle-lock-title">{t('ui.idle.title')}</h2>
                <p className="idle-lock-who">{user?.name}・{user?.email}</p>
                <FloatingInput
                    id="idle-lock-password"
                    label={t('ui.idle.unlockField')}
                    type="password"
                    autoComplete="current-password"
                    autoFocus
                    value={password}
                    error={error ?? undefined}
                    hideErrorText
                    onChange={(e) => { setPassword(e.target.value); setError(null) }}
                />
                <button type="submit" className="btn btn-lg btn-primary w-full" disabled={!password || busy}>
                    {busy ? t('ui.idle.checking') : t('ui.idle.unlock')}
                </button>
                <button type="button" className="idle-lock-logout" onClick={logout}>{t('ui.idle.logout')}</button>
            </form>
        </dialog>
    )
}
