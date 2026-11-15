/**
 * 從錯誤物件取出給使用者看的訊息（全站共用）
 *   後端錯誤有兩種格式，都要認得：
 *     - { detail: "信箱已被使用" } 或 { detail: { code, message } }（一般 API 錯誤、訊息被攔阻）
 *     - { error: { code, message } }（欄位檢查失敗、伺服器錯誤、請求過於頻繁）
 *   都沒有就用 fallback（預設：目前語言的「操作失敗」）
 */
import i18n from '@/i18n'

type ErrorBody = { detail?: unknown; error?: { code?: unknown; message?: unknown } }

const body = (err: unknown): ErrorBody | undefined => (err as { response?: { data?: ErrorBody } })?.response?.data

const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined)

export function getErrorMessage(err: unknown, fallback?: string): string {
    const data = body(err)
    const detail = data?.detail
    const fromBackend =
        str(detail) ??
        (detail && typeof detail === 'object' ? str((detail as { message?: unknown }).message) : undefined) ??
        str(data?.error?.message)
    if (fromBackend) return fromBackend
    // 連線錯誤之類的英文訊息（例如 "Request failed with status code 400"）不給使用者看
    if (err instanceof Error && err.message && !(err as { isAxiosError?: boolean }).isAxiosError) return err.message
    return fallback ?? i18n.t('ui.misc.actionFailed')
}
