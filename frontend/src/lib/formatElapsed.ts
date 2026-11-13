/**
 * 經過了多久：滿一分鐘顯示「幾分幾秒」，還沒滿只顯示秒（不顯示「0 分」）
 * 啟動畫面、AI 思考中的等待時間共用；秒數一直往上疊（210 秒）很難一眼看出是幾分鐘。
 */
const SECONDS_PER_MINUTE = 60

type Translate = (key: string, vars?: Record<string, unknown>) => string

export function formatElapsed(seconds: number, t: Translate): string {
    const total = Math.max(0, Math.floor(seconds))
    if (total < SECONDS_PER_MINUTE) return t('ui.boot.sec', { s: total })
    return t('ui.boot.minSec', { m: Math.floor(total / SECONDS_PER_MINUTE), s: total % SECONDS_PER_MINUTE })
}
