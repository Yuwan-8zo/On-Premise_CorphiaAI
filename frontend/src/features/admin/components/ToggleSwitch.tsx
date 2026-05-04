/**
 * ToggleSwitch — iOS 風格的滑動開關
 * ----------------------------------
 * 一顆圓圈在膠囊內左右滑動切換 on/off。
 * 配色用品牌 accent，跟著使用者選的色變。
 *
 * 設計細節：
 *   - 軌道（track）：on=accent / off=bg-surface
 *   - 圓鈕（thumb）：純白底，translate-x 切換位置，250ms cubic-bezier
 *   - 載入中：圓鈕顯示 spinner 並 disabled，避免重複點擊
 *   - 鍵盤可達：原生 button + role="switch" + aria-checked
 *
 * 三個尺寸（sm / md / lg）—— 預設 md 適合 strip 工具列，sm 給表格 row 用。
 */

import { Loader2 } from 'lucide-react'

type Size = 'sm' | 'md' | 'lg'

interface ToggleSwitchProps {
    /** 是否 ON */
    checked: boolean
    /** 點擊時觸發 — toggle handler 由父層自己處理 ON/OFF 行為 */
    onChange: () => void
    /** 載入中狀態（disabled + 圓鈕顯示 spinner） */
    loading?: boolean
    /** 完全停用（無 hover、無互動） */
    disabled?: boolean
    /** 尺寸 — 預設 md */
    size?: Size
    /** 螢幕閱讀器標籤 */
    'aria-label'?: string
    /** 額外 className（給外層套 margin 之類用） */
    className?: string
}

const SIZES: Record<Size, {
    track: string
    thumb: string
    translate: string
    spinner: string
}> = {
    sm: {
        track: 'h-4 w-7',
        thumb: 'h-3 w-3',
        translate: 'translate-x-3',
        spinner: 'h-2.5 w-2.5',
    },
    md: {
        track: 'h-5 w-9',
        thumb: 'h-4 w-4',
        translate: 'translate-x-4',
        spinner: 'h-3 w-3',
    },
    lg: {
        track: 'h-6 w-11',
        thumb: 'h-5 w-5',
        translate: 'translate-x-5',
        spinner: 'h-3.5 w-3.5',
    },
}

export default function ToggleSwitch({
    checked,
    onChange,
    loading = false,
    disabled = false,
    size = 'md',
    className = '',
    'aria-label': ariaLabel,
}: ToggleSwitchProps) {
    const s = SIZES[size]
    const isDisabled = disabled || loading

    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={ariaLabel}
            disabled={isDisabled}
            onClick={onChange}
            className={`
                relative inline-flex shrink-0 items-center rounded-full
                ${s.track}
                transition-colors duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]
                ${checked
                    ? 'bg-accent shadow-[inset_0_0_0_1px_rgb(var(--accent))]'
                    : 'bg-bg-surface shadow-[inset_0_0_0_1px_rgb(var(--border-subtle))]'
                }
                ${isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:opacity-90 active:scale-[0.97]'}
                focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg-base
                ${className}
            `}
        >
            <span
                aria-hidden
                className={`
                    inline-flex items-center justify-center rounded-full bg-white shadow-md
                    ${s.thumb}
                    transition-transform duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)]
                    ${checked ? s.translate : 'translate-x-0.5'}
                `}
            >
                {loading && (
                    <Loader2 className={`${s.spinner} animate-spin text-text-secondary`} />
                )}
            </span>
        </button>
    )
}
