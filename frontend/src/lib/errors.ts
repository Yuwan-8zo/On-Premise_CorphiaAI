/**
 * 從錯誤物件取出給使用者看的訊息（全站共用）
 *   優先用後端回的 detail（例如「信箱已被使用」），其次是錯誤本身的訊息，都沒有就用 fallback
 */
export function getErrorMessage(err: unknown, fallback = '操作失敗'): string {
    const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
    if (typeof detail === 'string' && detail) return detail
    if (err instanceof Error && err.message) return err.message
    return fallback
}
