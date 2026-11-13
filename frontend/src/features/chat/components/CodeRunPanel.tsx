/**
 * 執行 Python 的結果區（在程式碼區塊下方）
 *
 * 使用者看過 AI 寫的程式後自己按「執行」；程式跑在這台裝置瀏覽器的沙盒裡（lib/pyRunner.ts），不在主機上。
 *   - 可以加入資料檔（Excel、CSV…）讓程式讀：檔案只留在這台裝置，不會上傳
 *   - 結果：印出來的文字、最後一行的值、畫的圖、錯誤訊息
 *   - 「交給 AI」：把結果放進輸入框（不自動送出），讓 AI 接著解讀或修正程式
 */
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from '@/components/snow/icons'
import MaterialIcon from '@/components/icons/MaterialIcon'
import { appendToChatInput } from '@/lib/chatInputBus'
import { useSidePanelItem } from '@/features/chat/hooks/useSidePanelItem'
import { CODE_BUTTON as BUTTON, OpenInPanelButton } from './CodeButtons'
import RunResultView from './RunResultView'
import { PY_RUN_TIMEOUT_MS, runPython, safeFileName, type PyRunFile, type PyRunResult } from '@/lib/pyRunner'

/** 資料檔的上限：太大的檔案在瀏覽器裡會把記憶體用光 */
const MAX_DATA_FILES = 5
const MAX_DATA_FILE_MB = 20
/** 交給 AI 的結果最多帶多少字（太長會把對話塞滿） */
const RESULT_FOR_AI_CHARS = 3000


type Phase = 'idle' | 'running' | 'done'

/** 給 AI 看的結果文字 */
export function resultForAI(result: PyRunResult, labels: { ran: string; error: string; timedOut: string; images: string; nothing: string }): string {
    const parts: string[] = []
    if (result.timedOut) parts.push(labels.timedOut)
    if (result.stdout.trim()) parts.push(result.stdout.trim())
    if (result.value.trim()) parts.push(result.value.trim())
    if (result.error) parts.push(`${labels.error}\n${result.error}`)
    if (result.images.length) parts.push(labels.images.replace('{{n}}', String(result.images.length)))
    const body = (parts.join('\n\n') || labels.nothing).slice(0, RESULT_FOR_AI_CHARS)
    return `${labels.ran}\n\`\`\`\n${body}\n\`\`\`\n`
}

export default function CodeRunPanel({ code }: { code: string }) {
    const { t } = useTranslation()
    const [phase, setPhase] = useState<Phase>('idle')
    const [result, setResult] = useState<PyRunResult | null>(null)
    const [failure, setFailure] = useState('')
    const [files, setFiles] = useState<PyRunFile[]>([])
    const fileInput = useRef<HTMLInputElement | null>(null)

    const run = async () => {
        setPhase('running')
        setFailure('')
        try {
            setResult(await runPython(code, files))
        } catch (err) {
            // 執行環境本身沒起來（檔案缺少、載入逾時），不是程式的錯
            setResult(null)
            setFailure(err instanceof Error && err.message === 'timeout' ? t('ui.chat.run.loadTimeout') : t('ui.chat.run.loadFailed'))
        }
        setPhase('done')
    }

    const addFiles = async (picked: File[]) => {
        const next = [...files]
        for (const file of picked) {
            if (next.length >= MAX_DATA_FILES || file.size > MAX_DATA_FILE_MB * 1024 * 1024) {
                setFailure(t('ui.chat.run.fileLimit', { n: MAX_DATA_FILES, mb: MAX_DATA_FILE_MB }))
                continue
            }
            const name = safeFileName(file.name)
            const data = await file.arrayBuffer()
            const at = next.findIndex((f) => f.name === name)
            if (at >= 0) next[at] = { name, data }
            else next.push({ name, data })
        }
        setFiles(next)
    }

    const running = phase === 'running'
    // 結果也能放到旁邊的顯示面板看（圖表比較大）
    const panelContent = useMemo(() => (result ? { kind: 'run' as const, result } : null), [result])
    const { ref, openInPanel, shownInPanel } = useSidePanelItem(panelContent)
    return (
        <div ref={ref} className="mt-2" data-testid="code-run-panel">
            <div className="flex flex-wrap items-center gap-1.5">
                <button type="button" onClick={() => void run()} disabled={running} className={`${BUTTON} !text-accent font-semibold`}>
                    <MaterialIcon name="play_arrow" size={14} aria-hidden />
                    {t(running ? 'ui.chat.run.running' : result || failure ? 'ui.chat.run.again' : 'ui.chat.run.run')}
                </button>
                <button type="button" onClick={() => fileInput.current?.click()} disabled={running} className={BUTTON}>
                    <MaterialIcon name="attach_file" size={14} aria-hidden />
                    {t('ui.chat.run.addFile')}
                </button>
                <input ref={fileInput} type="file" multiple className="hidden" data-testid="run-file-input" tabIndex={-1}
                    onChange={(e) => { const picked = Array.from(e.target.files ?? []); e.target.value = ''; void addFiles(picked) }} />
                {files.map((file) => (
                    <span key={file.name} className={`${BUTTON} !gap-0.5`}>
                        <span className="max-w-[var(--sz-160)] truncate">{file.name}</span>
                        <button type="button" aria-label={t('ui.chat.run.removeFile', { name: file.name })} disabled={running}
                            onClick={() => setFiles((list) => list.filter((f) => f.name !== file.name))} className="icon-tap !w-4 !h-4">
                            <X className="w-3 h-3" />
                        </button>
                    </span>
                ))}
                {result && !running && (
                    <button type="button" className={BUTTON}
                        onClick={() => appendToChatInput(resultForAI(result, {
                            ran: t('ui.chat.run.forAI.ran'), error: t('ui.chat.run.forAI.error'), timedOut: t('ui.chat.run.timedOut', { s: PY_RUN_TIMEOUT_MS / 1000 }),
                            images: t('ui.chat.run.forAI.images'), nothing: t('ui.chat.run.noOutput'),
                        }))}>
                        <MaterialIcon name="send" size={14} aria-hidden />
                        {t('ui.chat.run.sendToAI')}
                    </button>
                )}
                {result && !running && <OpenInPanelButton onOpen={openInPanel} shown={shownInPanel} />}
            </div>

            <p className="mt-1.5 text-[length:var(--fs-12)] text-text-muted">{t('ui.chat.run.note')}</p>
            {running && <p role="status" className="mt-2 text-[length:var(--fs-13)] text-text-muted animate-pulse">{t('ui.chat.run.preparing')}</p>}
            {failure && !running && <p role="alert" className="mt-2 text-[length:var(--fs-13)] text-[var(--danger-ink)]">{failure}</p>}

            {result && !running && <RunResultView result={result} />}
        </div>
    )
}
