/**
 * 區塊錯誤邊界：畫面的某一塊（側欄、對話內容、右側面板、後台的某一頁）程式出錯時，
 * 只有那一塊換成「這一塊暫時打不開」的卡片，其他地方照常能用；按「重新載入這一塊」就重畫那一塊，不用整頁重新整理。
 *
 *   <RegionBoundary name="sidebar">…</RegionBoundary>
 *
 * name 只用在主控台訊息，方便看是哪一塊壞了；resetKeys 改變時（例如換了對話）自動重試一次。
 */
import { Component, type ErrorInfo, type ReactNode } from 'react'
import i18n from '@/i18n'

interface Props {
    name: string
    children: ReactNode
    /** 這些值改變時自動清掉錯誤重畫（例如目前的對話編號） */
    resetKeys?: readonly unknown[]
    /** 擺在比較小的地方（側欄）用精簡版 */
    compact?: boolean
}

interface State {
    error: Error | null
}

export default class RegionBoundary extends Component<Props, State> {
    state: State = { error: null }

    static getDerivedStateFromError(error: Error): State {
        return { error }
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error(`[RegionBoundary:${this.props.name}]`, error, info.componentStack)
    }

    componentDidUpdate(prev: Props) {
        if (!this.state.error) return
        const a = prev.resetKeys ?? []
        const b = this.props.resetKeys ?? []
        if (a.length !== b.length || a.some((v, i) => !Object.is(v, b[i]))) this.setState({ error: null })
    }

    render() {
        if (!this.state.error) return this.props.children
        return (
            <div className={`region-error paper${this.props.compact ? ' is-compact' : ''}`} role="alert">
                <p className="region-error-title">{i18n.t('ui.boundary.title')}</p>
                {!this.props.compact && <p className="region-error-body">{i18n.t('ui.boundary.body')}</p>}
                <button type="button" className="region-error-retry" onClick={() => this.setState({ error: null })}>
                    {i18n.t('ui.boundary.retry')}
                </button>
            </div>
        )
    }
}
