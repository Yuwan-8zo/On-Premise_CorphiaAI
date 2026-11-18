/**
 * 後台「資安閘道」分頁（參考 Trust & Safety 儀表板的 Rules／Thresholds 兩頁）
 *
 * 規則：使用者訊息依序經過的每一道閘道一列（規範「清單列」：圖示方塊＋名稱與說明，右邊數字與開關）
 *   右邊：近 7 天每天的小長條圖、命中次數與比上週、命中時怎麼處理（遮罩／攔阻／送複查）、開關
 *   文件片段、模型回答這兩道不寫稽核，不顯示次數
 *   模型複查只在語意比對覺得可疑時才跑：語意比對關掉時，它的開關停用並說明原因
 * 門檻：語意比對的兩條門檻（送模型複查、直接攔阻）
 *   最近各則訊息的分數畫成長條圖，拖動門檻就預覽「放行／送複查／攔阻」各佔多少，和目前的設定比較
 * 只有工程師能改（全系統共用）；租戶管理員看得到，開關與門檻是停用狀態
 */
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Bot, EyeOff, FileText, Lock, MessageSquare, Shield, Sparkles } from '@/components/snow/icons'
import GlassSegmented from '@/components/ui/GlassSegmented'
import GlassSwitch from '@/components/ui/GlassSwitch'
import { SkelText } from '@/components/ui/Skeleton'
import type { SecurityGateHits, SecurityGateKey } from '@/api/admin'
import { ActionButton, Panel, SectionHeader } from '@/features/admin/components/AdminPrimitives'
import DualRange from '@/features/admin/components/DualRange'
import type { AdminSecurity } from '../hooks/useAdminSecurity'
import { histogram, pct, shareOf, type SemanticThresholds } from '../utils/semanticDecide'

type Tab = 'rules' | 'thresholds'

const GATE_ICON: Record<SecurityGateKey, React.ComponentType<{ className?: string }>> = {
    pii: EyeOff,
    dlp: Lock,
    injection: Shield,
    semantic: Sparkles,
    llm_judge: Bot,
    context: FileText,
    output: MessageSquare,
}

/** 命中時怎麼處理（標籤膠囊的顏色照語意：攔阻＝警示、遮罩與過濾＝注意、複查＝強調） */
const GATE_ACTION: Record<SecurityGateKey, { key: string; tag: string }> = {
    pii: { key: 'mask', tag: 'tag-orange' },
    dlp: { key: 'block', tag: 'tag-red' },
    injection: { key: 'block', tag: 'tag-red' },
    semantic: { key: 'blockOrReview', tag: 'tag-red' },
    llm_judge: { key: 'judge', tag: 'tag-accent' },
    context: { key: 'filter', tag: 'tag-orange' },
    output: { key: 'filter', tag: 'tag-orange' },
}

/** 三種判定的顏色（長條圖、拉桿、三格數字同一組；用 Apple 系統色） */
const ZONE = {
    pass: 'color-mix(in srgb, var(--sys-green) 55%, transparent)',
    review: 'color-mix(in srgb, var(--sys-orange) 70%, transparent)',
    block: 'var(--sys-red)',
}
const BINS = 50

const rowText = 'text-[length:var(--fs-13)] leading-[var(--lh-18)] text-text-secondary'

/** 近 7 天每天的小長條圖（今天在最右邊） */
function Spark({ daily }: { daily: number[] }) {
    const max = Math.max(1, ...daily)
    return (
        <div aria-hidden className="hidden md:flex items-end gap-[var(--sp-2)]" style={{ width: 'var(--spark-w)', height: 'var(--spark-h)' }}>
            {daily.map((n, i) => (
                <span
                    key={i}
                    className={`flex-1 rounded-[var(--r-4)] ${n ? 'bg-accent' : 'bg-[var(--chip)]'}`}
                    style={{ height: n ? `${Math.max(18, (n / max) * 100)}%` : '18%' }}
                />
            ))}
        </div>
    )
}

/** 比上一段：+3／−2／持平 */
function Delta({ now, before }: { now: number; before: number }) {
    const { t } = useTranslation()
    const d = now - before
    if (d === 0) return <span>{t('admin.security.flat')}</span>
    return <span className="tabular-nums">{t('admin.security.vsLastWeek', { d: `${d > 0 ? '+' : '−'}${Math.abs(d)}` })}</span>
}

export default function SecuritySection({ security }: { security: AdminSecurity }) {
    const { t } = useTranslation()
    const { gates, loadError, busyKey, savingThresholds, load, toggle, saveThresholds } = security
    const [tab, setTab] = useState<Tab>('rules')

    useEffect(() => { load() }, [load])

    const totals = useMemo(() => {
        const list = gates?.gates.filter((g) => g.counted) ?? []
        return {
            now: list.reduce((a, g) => a + (g.hits ?? 0), 0),
            before: list.reduce((a, g) => a + (g.previous ?? 0), 0),
            on: gates ? Object.values(gates.enabled).filter(Boolean).length : 0,
            all: gates ? Object.keys(gates.enabled).length : 0,
        }
    }, [gates])
    const maxHits = Math.max(1, ...(gates?.gates.map((g) => g.hits ?? 0) ?? [0]))

    const eyebrow = gates
        ? t('admin.security.summary', { on: totals.on, all: totals.all, n: totals.now.toLocaleString(), days: gates.window_days })
        : <SkelText>{t('admin.security.summary', { on: 0, all: 0, n: 0, days: 7 })}</SkelText>

    return (
        <div className="h-full">
            <Panel className="admin-fill">
                <SectionHeader
                    inlineAction
                    title={t('admin.security.title')}
                    eyebrow={eyebrow}
                    action={(
                        <GlassSegmented
                            className="h-[var(--sz-40)] w-[var(--sz-200)] shrink-0"
                            value={tab}
                            onChange={(v) => setTab(v)}
                            options={[
                                { value: 'rules', label: t('admin.security.tabRules') },
                                { value: 'thresholds', label: t('admin.security.tabThresholds') },
                            ]}
                        />
                    )}
                />
                {loadError ? (
                    <div role="alert" className="admin-fill-body flex flex-col items-center justify-center text-center gap-3 px-[var(--sp-24)]">
                        <span className="snow-row-icon !w-[var(--sz-52)] !h-[var(--sz-52)] !rounded-[var(--r-18)] text-[var(--danger-ink)]"><AlertCircle className="w-6 h-6" /></span>
                        <p className="text-[length:var(--fs-17)] font-semibold text-text-primary">{t('admin.security.loadFailed')}</p>
                        <p className="max-w-[var(--sz-420)] text-[length:var(--fs-15)] leading-[var(--lh-22)] text-text-secondary">{loadError}</p>
                        <ActionButton variant="secondary" onClick={load}>{t('common.retry')}</ActionButton>
                    </div>
                ) : tab === 'rules' ? (
                    <div className="admin-fill-body px-[var(--space)] pb-[var(--space)]">
                        {!gates?.can_edit && gates && (
                            <p className={`${rowText} px-[var(--sp-8)] pb-[var(--sp-8)]`}>{t('admin.security.viewOnly')}</p>
                        )}
                        <ul className="snow-well rounded-[var(--admin-in)] overflow-hidden">
                            {(gates?.gates ?? (Object.keys(GATE_ICON) as SecurityGateKey[]).map((key) => ({ key, counted: true }) as SecurityGateHits)).map((g, i) => {
                                const Icon = GATE_ICON[g.key]
                                const on = gates ? gates.enabled[g.key] : true
                                const parent = gates?.depends_on[g.key]
                                const blockedByParent = !!parent && !!gates && !gates.enabled[parent]
                                const action = GATE_ACTION[g.key]
                                return (
                                    <li key={g.key} className={`flex items-center gap-[var(--sp-16)] pl-[var(--sp-16)] pr-[var(--sp-12)] py-[var(--sp-12)] min-h-[var(--sz-60)] ${on && !blockedByParent ? '' : 'opacity-60'}`}>
                                        <span className="snow-row-icon text-accent"><Icon className="h-[var(--sz-18)] w-[var(--sz-18)]" /></span>
                                        {/* 分隔線從文字起點畫到卡片內緣（規範清單列），不畫在圖示底下 */}
                                        <div className={`flex min-w-0 flex-1 items-center gap-[var(--sp-16)] self-stretch ${i ? 'border-t-[0.5px] border-[var(--paper-line)] -mt-[var(--sp-12)] pt-[var(--sp-12)]' : ''}`}>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-[length:var(--fs-15)] leading-[var(--lh-20)] font-semibold text-text-primary">
                                                    {gates ? t(`admin.security.gate.${g.key}.name`) : <SkelText>{t(`admin.security.gate.${g.key}.name`)}</SkelText>}
                                                </p>
                                                <p className={`${rowText} truncate`}>
                                                    {blockedByParent ? t('admin.security.needsParent', { name: t(`admin.security.gate.${parent}.name`) }) : t(`admin.security.gate.${g.key}.desc`)}
                                                </p>
                                                {/* 手機放不下右邊的次數欄：改成描述下面一行 */}
                                                {gates && (
                                                    <p className={`${rowText} sm:hidden truncate tabular-nums`}>
                                                        {g.counted
                                                            ? <>{t('admin.security.hits', { n: (g.hits ?? 0).toLocaleString() })}{' · '}<Delta now={g.hits ?? 0} before={g.previous ?? 0} /></>
                                                            : t('admin.security.notCounted')}
                                                    </p>
                                                )}
                                            </div>
                                            {g.counted && g.daily ? <Spark daily={g.daily} /> : <span className="hidden md:block" style={{ width: 'var(--spark-w)' }} />}
                                            <div className="hidden sm:block w-[var(--sz-100)] shrink-0 text-right">
                                                {!gates ? (
                                                    <p className="text-[length:var(--fs-15)] font-semibold"><SkelText>000</SkelText></p>
                                                ) : g.counted ? (
                                                    <>
                                                        <p className="text-[length:var(--fs-15)] leading-[var(--lh-20)] font-semibold tabular-nums text-text-primary">
                                                            {t('admin.security.hits', { n: (g.hits ?? 0).toLocaleString() })}
                                                        </p>
                                                        <p className={rowText}><Delta now={g.hits ?? 0} before={g.previous ?? 0} /></p>
                                                    </>
                                                ) : (
                                                    <p className={rowText}>{t('admin.security.notCounted')}</p>
                                                )}
                                                {g.counted && gates && (
                                                    <div className="mt-[var(--sp-4)] h-[var(--sz-3)] w-full overflow-hidden rounded-full bg-[var(--chip)]" aria-hidden>
                                                        <div className="h-full rounded-full bg-accent" style={{ width: `${((g.hits ?? 0) / maxHits) * 100}%` }} />
                                                    </div>
                                                )}
                                            </div>
                                            {/* 標籤欄固定寬、靠右：標籤長短不同，左邊的次數與小圖還是對齊 */}
                                            <span className="hidden lg:flex shrink-0 justify-end" style={{ width: 'var(--gate-tag-w)' }}>
                                                <span className={`tag ${action.tag}`}>{t(`admin.security.action.${action.key}`)}</span>
                                            </span>
                                            <GlassSwitch
                                                checked={on}
                                                onChange={() => toggle(g.key)}
                                                loading={busyKey === g.key}
                                                disabled={!gates?.can_edit || blockedByParent}
                                                aria-label={t('admin.security.enabledFor', { name: t(`admin.security.gate.${g.key}.name`) })}
                                            />
                                        </div>
                                    </li>
                                )
                            })}
                        </ul>
                        {gates && (
                            <p className={`${rowText} px-[var(--sp-8)] pt-[var(--sp-12)]`}>
                                {t('admin.security.messagesChecked', { n: gates.messages.toLocaleString(), days: gates.window_days })}{' · '}
                                {t('admin.security.totalHits', { n: totals.now.toLocaleString() })}{' · '}
                                <Delta now={totals.now} before={totals.before} />
                            </p>
                        )}
                    </div>
                ) : (
                    <ThresholdPlanner security={security} saving={savingThresholds} onSave={saveThresholds} />
                )}
            </Panel>
        </div>
    )
}

function ThresholdPlanner({ security, saving, onSave }: { security: AdminSecurity; saving: boolean; onSave: (review: number, block: number) => Promise<boolean> }) {
    const { t } = useTranslation()
    const { gates, scores } = security
    const saved = useMemo<SemanticThresholds | null>(
        () => (gates ? { review: gates.semantic_review, block: gates.semantic_block, margin: gates.semantic_margin } : null),
        [gates],
    )
    const [draft, setDraft] = useState<SemanticThresholds | null>(saved)
    useEffect(() => { setDraft(saved) }, [saved])

    const rows = useMemo(() => scores?.scores ?? [], [scores])
    const bars = useMemo(() => (draft ? histogram(rows, draft, BINS) : []), [rows, draft])
    const now = useMemo(() => (draft ? shareOf(rows, draft) : null), [rows, draft])
    const before = useMemo(() => (saved ? shareOf(rows, saved) : null), [rows, saved])
    const maxBar = Math.max(1, ...bars.map((b) => b.pass + b.review + b.block))
    const changed = !!draft && !!saved && (draft.review !== saved.review || draft.block !== saved.block)
    const canEdit = !!gates?.can_edit
    const semanticOff = !!gates && !gates.enabled.semantic

    if (!gates || !draft || !now || !before) {
        return <div className="admin-fill-body px-[var(--space)] pb-[var(--space)]"><div className="snow-well rounded-[var(--admin-in)] h-[var(--sz-320)]" /></div>
    }

    // 攔阻那格只有真的有訊息會被擋時才上紅底，0 則時和其他兩格一樣
    const tiles: Array<{ key: 'pass' | 'review' | 'block'; dark?: boolean }> = [{ key: 'pass' }, { key: 'review' }, { key: 'block', dark: now.block > 0 }]

    return (
        <div className="admin-fill-body flex flex-col gap-[var(--space)] px-[var(--space)] pb-[var(--space)]">
            <div className="snow-well rounded-[var(--admin-in)] p-[var(--sp-16)] flex flex-col gap-[var(--sp-12)]">
                <div className="flex flex-wrap items-start justify-between gap-[var(--sp-12)]">
                    <div className="min-w-0">
                        <p className="text-[length:var(--fs-15)] leading-[var(--lh-20)] font-semibold text-text-primary">{t('admin.security.plannerTitle')}</p>
                        <p className={rowText}>
                            {rows.length
                                ? t('admin.security.plannerDesc', { n: rows.length })
                                : t('admin.security.plannerIntro')}
                        </p>
                        {semanticOff && <p className={`${rowText} !text-[var(--ink-orange)]`}>{t('admin.security.semanticOff')}</p>}
                    </div>
                    <div className="flex items-center gap-[var(--sp-8)] shrink-0">
                        <ActionButton variant="secondary" onClick={() => setDraft(saved)} disabled={!changed || saving}>{t('admin.security.reset')}</ActionButton>
                        <ActionButton onClick={() => onSave(draft.review, draft.block)} disabled={!canEdit || !changed || saving}>{t('common.save')}</ActionButton>
                    </div>
                </div>

                {/* 分數分布：橫軸 0（不像攻擊）～1（很像攻擊）；每格依目前拉桿的判定上色 */}
                {/* 還沒有分數：圖的位置直接說明，不留一大片空白 */}
                {!rows.length && (
                    <div className="flex items-center justify-center text-center" style={{ height: 'var(--hist-h)' }}>
                        <p className={rowText}>{t('admin.security.plannerEmpty')}</p>
                    </div>
                )}
                <div aria-hidden className={`${rows.length ? 'flex' : 'hidden'} items-end gap-[var(--sp-2)]`} style={{ height: 'var(--hist-h)' }}>
                    {bars.map((b, i) => {
                        const total = b.pass + b.review + b.block
                        return (
                            <div key={i} className="flex flex-1 flex-col-reverse overflow-hidden rounded-t-[var(--r-4)]" style={{ height: total ? `${Math.max(4, (total / maxBar) * 100)}%` : 'var(--sz-2)', background: total ? undefined : 'var(--chip)' }}>
                                {(['pass', 'review', 'block'] as const).map((k) => b[k] ? <span key={k} style={{ flexGrow: b[k], background: ZONE[k] }} /> : null)}
                            </div>
                        )
                    })}
                </div>
                <DualRange
                    low={draft.review}
                    high={draft.block}
                    onChange={(review, block) => setDraft({ ...draft, review, block })}
                    disabled={!canEdit}
                    lowLabel={t('admin.security.reviewThreshold')}
                    highLabel={t('admin.security.blockThreshold')}
                    colors={ZONE}
                />
                <div className={`flex justify-between ${rowText}`}>
                    <span>{t('admin.security.axisLow')}</span>
                    <span>{t('admin.security.axisHigh')}</span>
                </div>
                <p className={rowText}>{t('admin.security.marginNote', { m: draft.margin.toFixed(2) })}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-[var(--space)]">
                {tiles.map(({ key, dark }) => (
                    <div key={key} className={`rounded-[var(--admin-in)] p-[var(--sp-16)] ${dark ? 'bg-[color-mix(in_srgb,var(--sys-red)_22%,transparent)]' : 'snow-well'}`}>
                        <div className="flex items-center gap-[var(--sp-8)]">
                            <span aria-hidden className="h-[var(--sz-10)] w-[var(--sz-10)] rounded-full" style={{ background: ZONE[key] }} />
                            <p className={rowText}>{t(`admin.security.zone.${key}`)}</p>
                        </div>
                        <p className="mt-[var(--sp-6)] text-[length:var(--fs-28)] leading-none font-semibold tabular-nums text-text-primary">
                            {pct(now[key], now.total)}<span className="text-[length:var(--fs-15)]">%</span>
                        </p>
                        <p className={`${rowText} mt-[var(--sp-6)] tabular-nums`}>
                            {t('admin.security.zoneCount', { n: now[key] })}{' · '}{t('admin.security.wasPct', { p: pct(before[key], before.total) })}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    )
}
