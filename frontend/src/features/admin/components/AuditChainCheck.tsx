/**
 * 稽核紀錄「驗證完整性」按鈕：重算整條雜湊鏈，結果直接顯示在按鈕上
 * 完整＝綠色勾勾＋筆數；被竄改＝紅色，寫出第幾筆、出了什麼問題。再按一次重新驗證。
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { verifyAuditChain, type AuditChainResult } from '@/api/auditLogs'
import { AlertTriangle, ShieldCheck } from '@/components/snow/icons'

type State = { kind: 'idle' } | { kind: 'checking' } | { kind: 'done'; result: AuditChainResult } | { kind: 'error' }

export default function AuditChainCheck() {
    const { t } = useTranslation()
    const [state, setState] = useState<State>({ kind: 'idle' })

    const run = async () => {
        setState({ kind: 'checking' })
        try {
            setState({ kind: 'done', result: await verifyAuditChain() })
        } catch {
            setState({ kind: 'error' })
        }
    }

    const broken = (state.kind === 'done' && !state.result.valid) || state.kind === 'error'
    const label =
        state.kind === 'checking' ? t('admin.audit.chain.checking')
        : state.kind === 'error' ? t('admin.audit.chain.failed')
        : state.kind === 'done' && state.result.valid ? t('admin.audit.chain.ok', { count: state.result.checked })
        : state.kind === 'done' ? t('admin.audit.chain.broken', { seq: state.result.broken_at, problem: state.result.problem })
        : t('admin.audit.chain.verify')

    return (
        <button
            type="button"
            onClick={run}
            disabled={state.kind === 'checking'}
            title={t('admin.audit.chain.hint')}
            aria-live="polite"
            className={`btn !h-[var(--sz-40)] !px-[var(--sp-18)] !text-[length:var(--fs-14)] shrink-0 min-w-max whitespace-nowrap ${
                broken ? 'btn-danger-solid' : 'btn-secondary'
            }`}
        >
            {broken ? <AlertTriangle className="h-4 w-4" /> : (
                <ShieldCheck className={`h-4 w-4 ${state.kind === 'done' ? 'text-[var(--sys-green)]' : ''}`} />
            )}
            {label}
        </button>
    )
}
