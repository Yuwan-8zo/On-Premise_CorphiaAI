/**
 * SearchField — 玻璃搜尋欄（《Liquid Glass 元件規範》「玻璃搜尋欄」）。全站的搜尋框都用這個，不要各自刻。
 *
 *   - 膠囊：圓角＝高 ÷ 2；放大鏡、清除鈕的中心落在圓頭的圓心（離邊＝高 ÷ 2），尺寸見 tokens.css 的 --search-*
 *   - 有字時右邊出現清除圓鈕；按 Esc：有字先清空（不往外傳），空的才讓外層（面板）關閉
 *   - cancelable：聚焦或有字時，右邊長出和搜尋欄同高的 × 圓（兩個圓頭同心），間隔＝高 × 0.26；按下清空並離開欄位
 *   - Enter（不在選字中）送出 onSubmit；手機鍵盤的確認鍵顯示「搜尋」
 *
 *   <SearchField value={q} onChange={setQ} onSubmit={run} onClear={reset} placeholder="…" />
 */
import { forwardRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, X, XCircleFill } from '@/components/snow/icons'

interface SearchFieldProps {
    value: string
    onChange: (value: string) => void
    /** Enter 送出 */
    onSubmit?: () => void
    /** 清除鈕、Esc、取消 × 清空之後（例如重新查詢全部） */
    onClear?: () => void
    /** 額外的按鍵處理，先執行；呼叫了 preventDefault 就不再做預設動作 */
    onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void
    placeholder?: string
    /** 讀螢幕用的名稱（不給就用「搜尋」） */
    label?: string
    /** 右邊顯示取消 × 圓（手機頁面上的搜尋用；面板裡不需要） */
    cancelable?: boolean
    className?: string
}

const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
    { value, onChange, onSubmit, onClear, onKeyDown, placeholder, label, cancelable = false, className = '' },
    ref,
) {
    const { t } = useTranslation()
    const [focused, setFocused] = useState(false)
    const showCancel = cancelable && (focused || value !== '')

    const clear = () => {
        onChange('')
        onClear?.()
    }

    const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
        onKeyDown?.(e)
        if (e.defaultPrevented) return
        if (e.key === 'Escape') {
            if (value) {
                // 先清空；這次 Esc 不讓外層面板關閉（useDismiss 看到 defaultPrevented 就不關）
                e.preventDefault()
                e.stopPropagation()
                clear()
            } else if (cancelable) {
                e.currentTarget.blur()
            }
        }
    }

    return (
        <div className={`search-row ${showCancel ? 'is-cancel' : ''} ${className}`}>
            <form
                role="search"
                className="search-field"
                onSubmit={(e) => {
                    e.preventDefault()
                    onSubmit?.()
                }}
            >
                <Search className="search-ic" />
                <input
                    ref={ref}
                    type="search"
                    enterKeyHint="search"
                    autoComplete="off"
                    spellCheck={false}
                    aria-label={label ?? t('common.search')}
                    value={value}
                    placeholder={placeholder}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={handleKey}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    className="search-input"
                />
                {value && (
                    <button
                        type="button"
                        className="search-clear"
                        aria-label={t('common.clear')}
                        // 按下時不搶走欄位的焦點，清空後可以直接繼續打字
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={clear}
                    >
                        <XCircleFill />
                    </button>
                )}
            </form>
            {cancelable && (
                <button
                    type="button"
                    className="search-cancel"
                    aria-label={t('common.cancel')}
                    aria-hidden={!showCancel}
                    tabIndex={showCancel ? 0 : -1}
                    // 按下時欄位還不能失焦，不然 × 先縮回去、點不到
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                        if (value) clear()
                        ;(document.activeElement as HTMLElement | null)?.blur()
                        e.currentTarget.blur()
                    }}
                >
                    <X />
                </button>
            )}
        </div>
    )
})

export default SearchField
