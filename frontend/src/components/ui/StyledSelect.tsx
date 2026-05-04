/**
 * StyledSelect - 全站統一風格的下拉選單。
 *
 * 取代原生 <select>，避免不同 OS / 瀏覽器顯示成藍色 highlight 等不一致樣式。
 * 樣式對齊專案的 input/button：圓角、accent border、深色主題感知。
 */

import { useEffect, useRef, useState } from 'react'
import MaterialIcon from '@/components/icons/MaterialIcon'

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

export default function StyledSelect({
    value,
    options,
    onChange,
    placeholder,
    disabled,
    className = '',
}: StyledSelectProps) {
    const [open, setOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    const selected = options.find((o) => o.value === value)

    // 外部點擊關閉
    useEffect(() => {
        if (!open) return
        const handler = (e: MouseEvent) => {
            if (!containerRef.current) return
            if (!containerRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [open])

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            <button
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setOpen((prev) => !prev)}
                className="w-full flex items-center justify-between rounded-[16px] border border-border-subtle bg-bg-base px-4 py-2.5 text-sm text-text-primary transition-colors hover:border-accent/60 focus:outline-none focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed"
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                <span className={selected ? '' : 'text-text-muted'}>
                    {selected?.label ?? placeholder ?? ''}
                </span>
                <MaterialIcon
                    name="expand_more"
                    size={20}
                    className={`text-text-secondary transition-transform ${open ? 'rotate-180' : ''}`}
                    aria-hidden
                />
            </button>

            {open && (
                <ul
                    role="listbox"
                    className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-[16px] border border-border-subtle bg-bg-base shadow-lg backdrop-blur-md py-1"
                >
                    {options.map((opt) => {
                        const isSelected = opt.value === value
                        return (
                            <li
                                key={opt.value}
                                role="option"
                                aria-selected={isSelected}
                                onClick={() => {
                                    onChange(opt.value)
                                    setOpen(false)
                                }}
                                className={`flex items-center justify-between px-4 py-2 text-sm cursor-pointer transition-colors ${
                                    isSelected
                                        ? 'bg-accent/15 text-accent font-medium'
                                        : 'text-text-primary hover:bg-white/[0.06] dark:hover:bg-white/[0.06]'
                                }`}
                            >
                                <span>{opt.label}</span>
                                {isSelected && (
                                    <MaterialIcon name="check" size={16} className="text-accent" aria-hidden />
                                )}
                            </li>
                        )
                    })}
                </ul>
            )}
        </div>
    )
}
