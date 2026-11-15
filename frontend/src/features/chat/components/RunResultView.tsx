/**
 * 執行 Python 的結果：印出來的文字、最後一行的值、圖、錯誤訊息、花了多久
 * （程式碼區塊下方的結果區和旁邊的顯示面板共用；fill＝放在面板裡，文字區不限制高度）
 */
import { useTranslation } from 'react-i18next'
import { PY_RUN_TIMEOUT_MS, type PyRunResult } from '@/lib/pyRunner'

const OUTPUT = 'mt-2 overflow-auto rounded-[var(--r-12)] bg-[var(--chip)] p-3 text-[length:var(--fs-13)] leading-relaxed whitespace-pre-wrap break-words selectable-text'
const NOTE = 'mt-2 text-[length:var(--fs-13)]'

export default function RunResultView({ result, fill = false }: { result: PyRunResult; fill?: boolean }) {
    const { t } = useTranslation()
    const output = fill ? OUTPUT : `${OUTPUT} max-h-[var(--sz-320)]`
    const empty = !result.timedOut && !result.error && !result.stdout.trim() && !result.value.trim() && result.images.length === 0
    return (
        <div aria-live="polite">
            {result.timedOut && <p role="alert" className={`${NOTE} text-[var(--danger-ink)]`}>{t('ui.chat.run.timedOut', { s: PY_RUN_TIMEOUT_MS / 1000 })}</p>}
            {result.stdout.trim() && <pre className={output}>{result.stdout}</pre>}
            {result.value.trim() && <pre className={output}>{result.value}</pre>}
            {result.images.map((src, i) => (
                <img key={i} src={src} alt={t('ui.chat.run.imageAlt', { n: i + 1 })} className="mt-2 max-w-full rounded-[var(--r-12)] bg-white" />
            ))}
            {result.error && <pre role="alert" className={`${output} !text-[var(--danger-ink)]`}>{result.error}</pre>}
            {empty && <p className={`${NOTE} text-text-muted`}>{t('ui.chat.run.noOutput')}</p>}
            <p className="mt-1.5 text-[length:var(--fs-12)] tabular-nums text-text-muted">{t('ui.chat.run.took', { s: result.seconds })}</p>
        </div>
    )
}
