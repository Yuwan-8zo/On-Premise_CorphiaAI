/**
 * 設定 › 記憶：AI 跨對話記住的事（只有自己看得到），以及回答風格
 *
 *   回答風格（頁面最下面，和記憶的三組分開）：預設／精簡／詳細／正式，勾選清單，選了馬上生效
 *   開關：關掉後 AI 不再參考記憶，對話裡說「記住……」也不會存
 *   新增：輸入框＋「新增」
 *   清單：每一則可以修改、刪除；最下面「全部清除」
 * 內容送出前後端都會先過安全檢查（個資遮罩、違禁詞、可疑指令），不通過會顯示後端回的原因。
 */
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { memoriesApi, REPLY_STYLES, type MemoryItem, type ReplyStyle } from '@/api/memories'
import { ChevronLeft, ChevronRight, Edit2, Trash2 } from '@/components/snow/icons'
import GlassSegmented from '@/components/ui/GlassSegmented'
import GlassSwitch from '@/components/ui/GlassSwitch'
import Tooltip from '@/components/ui/Tooltip'
import { SkelText } from '@/components/ui/Skeleton'
import { getErrorMessage } from '@/lib/errors'
import { useToastStore } from '@/store/toastStore'
import { useUIStore } from '@/store/uiStore'

const inputClass = 'flex-1 min-w-0 bg-transparent outline-none text-[length:var(--fs-15)] leading-[var(--lh-20)] text-text-primary placeholder:text-text-muted'

export default function MemorySection() {
    const { t } = useTranslation()
    const toast = useToastStore((s) => s.add)
    const showConfirm = useUIStore((s) => s.showConfirm)
    const [loaded, setLoaded] = useState(false)
    const [enabled, setEnabled] = useState(true)
    const [style, setStyle] = useState<ReplyStyle>('default')
    const [items, setItems] = useState<MemoryItem[]>([])
    const [limits, setLimits] = useState({ items: 50, chars: 300, instructionsChars: 3000 })
    const [draft, setDraft] = useState('')
    const [busy, setBusy] = useState(false)
    const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
    // 個人化指示（照 Claude.ai：一整段貼上去的說明，套用在所有對話）；savedInstructions 是後端目前存的那份，
    // 用來判斷草稿有沒有改過（沒改過「儲存」鈕就不給按）。
    // 設定頁上只顯示單行膠囊摘要（跟記憶清單同一套視覺），要輸入/編輯時另外切到全頁編輯（editingInstructions）
    const [instructionsDraft, setInstructionsDraft] = useState('')
    const [savedInstructions, setSavedInstructions] = useState('')
    const [editingInstructions, setEditingInstructions] = useState(false)

    const load = useCallback(async () => {
        try {
            const data = await memoriesApi.list()
            setEnabled(data.enabled)
            setStyle(data.style)
            setItems(data.items)
            setLimits({ items: data.max_items, chars: data.max_chars, instructionsChars: data.max_instructions_chars })
            setInstructionsDraft(data.instructions)
            setSavedInstructions(data.instructions)
        } catch (err) {
            toast(getErrorMessage(err), 'error')
        } finally {
            setLoaded(true)
        }
    }, [toast])
    useEffect(() => { void load() }, [load])

    /** 共用：做一件事，失敗顯示原因，成功後重新讀清單 */
    const run = async (work: () => Promise<unknown>, done?: string) => {
        if (busy) return false
        setBusy(true)
        try {
            await work()
            await load()
            if (done) toast(done, 'success')
            return true
        } catch (err) {
            toast(getErrorMessage(err), 'error')
            return false
        } finally {
            setBusy(false)
        }
    }

    const add = async () => {
        const text = draft.trim()
        if (!text) return
        if (await run(() => memoriesApi.create(text), t('settings.memory.added'))) setDraft('')
    }
    const saveEdit = async () => {
        if (!editing) return
        const text = editing.text.trim()
        if (!text) return
        if (await run(() => memoriesApi.update(editing.id, text))) setEditing(null)
    }
    const toggle = () => {
        const next = !enabled
        setEnabled(next) // 開關先動，失敗再由 load 還原
        void run(() => memoriesApi.setEnabled(next))
    }
    const pickStyle = (next: ReplyStyle) => {
        if (next === style) return
        setStyle(next) // 勾選先動，失敗再由 load 還原
        void run(() => memoriesApi.setStyle(next))
    }
    const instructionsChanged = instructionsDraft !== savedInstructions
    const saveInstructions = async () => {
        const text = instructionsDraft.trim()
        if (await run(() => memoriesApi.setInstructions(text), t('settings.memory.instructionsSaved'))) {
            setInstructionsDraft(text)
            setSavedInstructions(text)
            setEditingInstructions(false)
        }
    }
    const full = items.length >= limits.items

    // 指示的全頁編輯（照 Claude.ai：從設定頁的單行摘要點進來，另外一頁編輯一整段文字）
    // 圓角矩形、不裁切：不要套用 .set-group 的單行膠囊規則，也不加任何上下漸層遮罩
    if (editingInstructions) {
        return (
            <div className="flex h-full min-h-0 flex-col">
                <button
                    type="button"
                    className="mb-[var(--sp-8)] -ml-1 flex items-center h-[var(--sz-36)] pr-[var(--sp-12)] text-accent text-[length:var(--fs-15)] font-medium shrink-0"
                    onClick={() => { setInstructionsDraft(savedInstructions); setEditingInstructions(false) }}
                >
                    <ChevronLeft className="w-5 h-5" />
                    {t('settings.memory.title')}
                </button>
                <h2 className="set-title shrink-0">{t('settings.memory.instructionsHeader')}</h2>
                <textarea
                    value={instructionsDraft}
                    maxLength={limits.instructionsChars}
                    onChange={(e) => setInstructionsDraft(e.target.value)}
                    placeholder={t('settings.memory.instructionsPlaceholder')}
                    autoFocus
                    aria-label={t('settings.memory.instructionsHeader')}
                    className="flex-1 min-h-[var(--sz-200)] w-full resize-none snow-field rounded-[var(--r-20)] p-[var(--sp-16)] bg-transparent outline-none text-[length:var(--fs-15)] leading-[var(--lh-20)] text-text-primary placeholder:text-text-muted"
                />
                <div className="mt-[var(--sp-12)] flex items-center justify-between gap-[var(--sp-12)] shrink-0">
                    <span className="set-footer !mt-0">{t('settings.memory.instructionsHint', { n: instructionsDraft.length, max: limits.instructionsChars })}</span>
                    <button type="button" onClick={saveInstructions} disabled={busy || !instructionsChanged} className="btn btn-sm btn-primary flex-shrink-0">
                        {t('common.save')}
                    </button>
                </div>
            </div>
        )
    }

    return (
        <>
            <h2 className="set-title">{t('settings.memory.title')}</h2>

            {/* 個人化指示（照 Claude.ai「指示」）：設定頁上只顯示單行膠囊摘要，點了才切到全頁編輯。
                跟下面「記住……」的短記憶不同——這裡放最上面，因為是「這個助理整體該怎麼表現」的設定 */}
            <section className="set-section">
                <div className="set-header">{t('settings.memory.instructionsHeader')}</div>
                <div className="set-group">
                    <button type="button" onClick={() => setEditingInstructions(true)} className="set-row set-row-btn w-full text-left">
                        <span className="set-label truncate">
                            {savedInstructions || <span className="text-text-muted">{t('settings.memory.instructionsPlaceholder')}</span>}
                        </span>
                        <ChevronRight className="set-chevron" />
                    </button>
                </div>
                <div className="set-footer">{t('settings.memory.instructionsHint', { n: savedInstructions.length, max: limits.instructionsChars })}</div>
            </section>

            {/* 回答風格放最上面、用分段切換器（一列四格）：記憶清單會越來越長（最多 50 筆），放在它下面會被擠到很後面；
                做成四列清單又會把記憶整個擠出第一個畫面。目前選的那一種在下面用一行字說明 */}
            <section className="set-section">
                <div className="set-header">{t('settings.memory.styleHeader')}</div>
                <GlassSegmented
                    className="w-full h-[var(--sz-40)]"
                    value={style}
                    onChange={pickStyle}
                    options={REPLY_STYLES.map((s) => ({ value: s, label: t(`settings.memory.style.${s}`) }))}
                />
                <div className="set-footer">{t(`settings.memory.styleHint.${style}`)}</div>
            </section>

            <section className="set-section">
                <div className="set-group">
                    <div className="set-row">
                        <span className="set-label">{t('settings.memory.enable')}</span>
                        <GlassSwitch checked={enabled} onChange={toggle} aria-label={t('settings.memory.enable')} />
                    </div>
                </div>
                <div className="set-footer">{t('settings.memory.enableHint')}</div>
            </section>

            <section className="set-section">
                <div className="set-header">{t('settings.memory.addHeader')}</div>
                <div className="set-group">
                    <div className="set-row">
                        <input
                            type="text"
                            value={draft}
                            maxLength={limits.chars}
                            disabled={full}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') void add() }}
                            placeholder={full ? t('settings.memory.full', { n: limits.items }) : t('settings.memory.placeholder')}
                            aria-label={t('settings.memory.addHeader')}
                            className={inputClass}
                        />
                        <button type="button" onClick={add} disabled={busy || full || !draft.trim()} className="btn btn-sm btn-primary flex-shrink-0">
                            {t('settings.memory.add')}
                        </button>
                    </div>
                </div>
                <div className="set-footer">{t('settings.memory.addHint')}</div>
            </section>

            <section className="set-section">
                <div className="set-header">
                    {loaded ? t('settings.memory.listHeader', { n: items.length, max: limits.items }) : <SkelText>{t('settings.memory.listHeader', { n: 0, max: limits.items })}</SkelText>}
                </div>
                <div className="set-group mem-list">
                    {!loaded ? (
                        <div className="set-row" aria-hidden><span className="set-label"><SkelText>000000000000000000</SkelText></span></div>
                    ) : items.length === 0 ? (
                        <div className="set-row"><span className="set-value !text-left">{t('settings.memory.empty')}</span></div>
                    ) : items.map((m) => editing?.id === m.id ? (
                        <div key={m.id} className="set-row">
                            <input
                                type="text"
                                autoFocus
                                value={editing.text}
                                maxLength={limits.chars}
                                onChange={(e) => setEditing({ id: m.id, text: e.target.value })}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') void saveEdit()
                                    if (e.key === 'Escape') setEditing(null)
                                }}
                                aria-label={t('common.edit')}
                                className={inputClass}
                            />
                            <button type="button" onClick={() => setEditing(null)} disabled={busy} className="btn btn-sm btn-secondary flex-shrink-0">{t('common.cancel')}</button>
                            <button type="button" onClick={saveEdit} disabled={busy || !editing.text.trim()} className="btn btn-sm btn-primary flex-shrink-0">{t('common.save')}</button>
                        </div>
                    ) : (
                        <div key={m.id} className="set-row">
                            {/* 記憶可能是一整句：讓它折行，不截斷（要看得到自己被記了什麼） */}
                            <span className="set-label whitespace-normal break-words">{m.content}</span>
                            {m.source === 'chat' && <span className="tag hidden flex-shrink-0 sm:inline-flex">{t('settings.memory.fromChat')}</span>}
                            {/* 修改、刪除靠在一起（列的間距 16 是給文字和控制項之間用的，兩顆小按鈕之間太鬆） */}
                            <span className="flex flex-shrink-0 items-center gap-1">
                                <Tooltip label={t('common.edit')}>
                                    <button type="button" onClick={() => setEditing({ id: m.id, text: m.content })} aria-label={t('common.edit')} className="icon-tap text-text-secondary">
                                        <Edit2 className="h-4 w-4" />
                                    </button>
                                </Tooltip>
                                <Tooltip label={t('common.delete')}>
                                    <button type="button" onClick={() => run(() => memoriesApi.remove(m.id))} disabled={busy} aria-label={t('common.delete')} className="icon-tap text-[var(--danger-ink)]">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </Tooltip>
                            </span>
                        </div>
                    ))}
                </div>
                {items.length > 0 && (
                    <div className="mt-[var(--sp-12)] flex justify-end">
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => showConfirm(t('settings.memory.clearConfirm', { n: items.length }), async () => { await run(() => memoriesApi.clear(), t('settings.memory.cleared')) }, t('settings.memory.clearHint'))}
                            className="btn btn-sm btn-danger"
                        >
                            {t('settings.memory.clearAll')}
                        </button>
                    </div>
                )}
            </section>
        </>
    )
}
