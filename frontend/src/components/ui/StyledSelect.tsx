/**
 * StyledSelect — 全站統一的下拉選單（取代原生 <select>）
 *
 * 規範（design-system/README.md）：
 *   - 觸發鈕：膠囊、實色輸入框底（.snow-field）、右側 ChevronDown
 *   - 選單：.paper .paper-solid（不透明，避免透出後方內容），掛到 body，依觸發鈕位置定位；
 *     下方空間不足時往上開，不會被對話框的捲動範圍裁切
 *   - 選項：.menu-item 膠囊，目前選取＝.is-current（強調色字＋勾號），包在 <LensMenu>（長按放大鏡）
 */
import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from '@/components/snow/icons'
import LensMenu from '@/components/ui/LensMenu'
import { useDismiss } from '@/lib/useDismiss'

export interface StyledSelectOption {
    value: string
    label: string
}

interface StyledSelectProps {
    value: string
    options: StyledSelectOption[]
    onChange: (value: string) => void
    placeholder?: string
    disabled?: boolean
    className?: string
}

const MENU_MAX = 280 // 選單最高 280px，超過可捲動

export default function StyledSelect({ value, options, onChange, placeholder, disabled, className = '' }: StyledSelectProps) {
    const [open, setOpen] = useState(false)
    const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number } | null>(null)
    const btnRef = useRef<HTMLButtonElement>(null)
    const menuRef = useRef<HTMLDivElement>(null)
    const selected = options.find((o) => o.value === value)

    // 依觸發鈕位置定位；下方放不下就往上開
    useLayoutEffect(() => {
        if (!open) return
        const place = () => {
            const r = btnRef.current?.getBoundingClientRect()
            if (!r) return
            const below = window.innerHeight - r.bottom
            setPos(below < MENU_MAX + 16 && r.top > below
                ? { left: r.left, width: r.width, bottom: window.innerHeight - r.top + 6 }
                : { left: r.left, width: r.width, top: r.bottom + 6 })
        }
        place()
        window.addEventListener('resize', place)
        window.addEventListener('scroll', place, true)
        return () => {
            window.removeEventListener('resize', place)
            window.removeEventListener('scroll', place, true)
        }
    }, [open])

    // 點外面、按 Esc 關閉
    useDismiss(open, () => setOpen(false), [btnRef, menuRef])

    return (
        <div className={`relative ${className}`}>
            <button
                ref={btnRef}
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setOpen((v) => !v)}
                className="w-full h-11 flex items-center justify-between gap-2 rounded-full snow-field pl-4 pr-3 text-[length:var(--fs-15)] text-text-primary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                <span className={`truncate ${selected ? '' : 'text-text-muted'}`}>{selected?.label ?? placeholder ?? ''}</span>
                <ChevronDown className={`w-[var(--sz-18)] h-[var(--sz-18)] shrink-0 text-text-secondary transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && pos && createPortal(
                <div
                    ref={menuRef}
                    role="listbox"
                    className="fixed z-[1100] paper paper-solid !rounded-[var(--r-22)] p-[var(--sp-6)] overflow-y-auto"
                    style={{ left: pos.left, minWidth: pos.width, maxWidth: 360, top: pos.top, bottom: pos.bottom, maxHeight: MENU_MAX }}
                >
                    <LensMenu className="flex flex-col gap-0.5">
                        {options.map((opt) => {
                            const isSel = opt.value === value
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    role="option"
                                    aria-selected={isSel}
                                    onClick={() => { onChange(opt.value); setOpen(false) }}
                                    className={`menu-item justify-between ${isSel ? 'is-current' : ''}`}
                                >
                                    <span className="whitespace-nowrap">{opt.label}</span>
                                    {isSel && <Check />}
                                </button>
                            )
                        })}
                    </LensMenu>
                </div>,
                document.body,
            )}
        </div>
    )
}
