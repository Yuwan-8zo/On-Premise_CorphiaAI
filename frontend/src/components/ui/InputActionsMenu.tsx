/**
 * InputActionsMenu — 輸入框左邊唯一的一顆「＋」：按下往上展開選單，所有附加功能都收在這裡
 * （提示詞模板、讀取 Office、上傳文件、附加資料夾、對外搜尋…）
 *
 * 為什麼收成一顆：原本每個功能一顆圖示鈕，桌面版最多會排到五顆，沒有文字、要記哪顆是什麼，輸入框也被擠窄。
 * 選單裡每一項是「圖示＋文字」；會持續生效的項目（checked）右邊打勾，狀態另外用輸入框上方的小標籤顯示。
 *
 *   <InputActionsMenu label="更多功能" items={[{ key, icon, label, onSelect, checked?, disabled? }]} />
 *
 * 選單用入口（portal）＋固定定位，貼著整個輸入框的左上角往上開（和提示詞模板面板同一個對齊方式）。
 * 開關、按住拖進選單、放大鏡、點外面／Esc 關閉都用全站共用的那一套（menuDrag、LensMenu、useDismiss、menuPop）。
 * onSelect 回傳 Promise 時（例如讀取 Office），做完前按鈕顯示忙碌、不能再按。
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, Loader2, Plus } from '@/components/snow/icons'
import LensMenu from '@/components/ui/LensMenu'
import Tooltip from '@/components/ui/Tooltip'
import { AnimatePresence, motion } from '@/lib/gsapMotion'
import { useMenuTrigger } from '@/lib/menuDrag'
import { menuPop } from '@/lib/motionPresets'
import { readPx } from '@/lib/cssVars'
import { useDismiss } from '@/lib/useDismiss'

export interface InputAction {
    key: string
    icon: ReactNode
    label: string
    onSelect: () => void | Promise<void>
    /** 開關類的項目：true＝目前開著（右邊打勾） */
    checked?: boolean
    disabled?: boolean
}

interface InputActionsMenuProps {
    label: string
    items: InputAction[]
    disabled?: boolean
}

export default function InputActionsMenu({ label, items, disabled }: InputActionsMenuProps) {
    const [open, setOpen] = useState(false)
    const [busy, setBusy] = useState(false)
    const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null)
    const btnRef = useRef<HTMLButtonElement>(null)
    const menuRef = useRef<HTMLDivElement>(null)
    const trigger = useMenuTrigger()
    const tp = trigger(open, () => !disabled && !busy && setOpen(true), () => setOpen(false))

    // 以整個輸入框為準：左緣對齊、開在上方（輸入框尺寸會隨裝置變，所以用量的）
    useLayoutEffect(() => {
        if (!open) return
        const place = () => {
            const r = (btnRef.current?.closest('.glass-field') ?? btnRef.current)?.getBoundingClientRect()
            if (r) setPos({ left: r.left, bottom: window.innerHeight - r.top + readPx('--sp-8') })
        }
        place()
        window.addEventListener('resize', place)
        return () => window.removeEventListener('resize', place)
    }, [open])

    useDismiss(open, () => setOpen(false), [btnRef, menuRef])

    const pick = async (item: InputAction) => {
        setOpen(false)
        setBusy(true)
        try {
            await item.onSelect()
        } finally {
            setBusy(false)
        }
    }

    if (items.length === 0) return null

    return (
        <>
            <Tooltip label={open ? '' : label}>
                <button
                    ref={btnRef}
                    type="button"
                    disabled={disabled || busy}
                    onPointerDown={tp.onPointerDown}
                    onClick={tp.onClick}
                    aria-label={label}
                    aria-haspopup="menu"
                    aria-expanded={open}
                    className={`${tp.className} btn-icon !w-[var(--field-btn)] !h-[var(--field-btn)] [--R:calc(var(--field-btn)/2)] shrink-0 disabled:opacity-50 ${open ? 'is-current text-accent' : 'text-text-secondary'}`}
                >
                    {busy
                        ? <Loader2 className="animate-spin w-[calc(var(--sz-22)*var(--field-bk,1))] h-[calc(var(--sz-22)*var(--field-bk,1))]" />
                        : <Plus className={`w-[calc(var(--sz-22)*var(--field-bk,1))] h-[calc(var(--sz-22)*var(--field-bk,1))] transition-transform duration-200 ease-apple ${open ? 'rotate-45' : ''}`} />}
                </button>
            </Tooltip>
            {createPortal(
                <AnimatePresence>
                    {open && pos && (
                        <motion.div
                            ref={menuRef}
                            {...menuPop}
                            role="menu"
                            aria-label={label}
                            className="fixed z-[1100] paper paper-solid overflow-hidden p-[var(--sp-6)] min-w-[var(--sz-200)]"
                            style={{ left: pos.left, bottom: pos.bottom, transformOrigin: 'bottom left' }}
                        >
                            <LensMenu className="flex flex-col gap-0.5">
                                {items.map((item) => (
                                    <button
                                        key={item.key}
                                        type="button"
                                        role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
                                        aria-checked={item.checked}
                                        disabled={item.disabled}
                                        onClick={() => pick(item)}
                                        className="menu-item !justify-start gap-[var(--sp-10)] disabled:opacity-40"
                                    >
                                        <span className="shrink-0 flex text-text-secondary [&_svg]:w-[var(--sz-18)] [&_svg]:h-[var(--sz-18)]">{item.icon}</span>
                                        <span className="whitespace-nowrap flex-1 text-left">{item.label}</span>
                                        {item.checked && <Check className="shrink-0 w-[var(--sz-16)] h-[var(--sz-16)] text-accent" aria-hidden />}
                                    </button>
                                ))}
                            </LensMenu>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body,
            )}
        </>
    )
}
