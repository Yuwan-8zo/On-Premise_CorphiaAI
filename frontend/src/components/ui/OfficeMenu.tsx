/**
 * OfficeMenu — 「選一個 Office 程式」的小選單（桌面版才用得到）：一顆圖示鈕，按下列出 Word、Excel、PowerPoint
 *
 * 兩個地方共用：訊息下方「寫入 Office」、輸入框「讀取 Office 內容」。
 *   <OfficeMenu label="寫入 Office" icon={<FileText />} buttonClassName="btn-icon …" onPick={(app) => …} />
 *
 * 選單用入口（portal）＋固定定位：訊息在捲動區裡，選單放在裡面會被切掉；下方放不下就往上開。
 * 開關、按住拖進選單、放大鏡、點外面／Esc 關閉都用全站共用的那一套（menuDrag、LensMenu、useDismiss、menuPop）。
 * onPick 回傳 Promise 時，等它做完前按鈕顯示忙碌、不能再按。
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Loader2 } from '@/components/snow/icons'
import LensMenu from '@/components/ui/LensMenu'
import Tooltip from '@/components/ui/Tooltip'
import { OFFICE_APPS, type OfficeApp } from '@/lib/desktop'
import { AnimatePresence, motion } from '@/lib/gsapMotion'
import { useMenuTrigger } from '@/lib/menuDrag'
import { menuPop } from '@/lib/motionPresets'
import { readPx } from '@/lib/cssVars'
import { useDismiss } from '@/lib/useDismiss'

interface OfficeMenuProps {
    label: string
    icon: ReactNode
    buttonClassName: string
    onPick: (app: OfficeApp) => void | Promise<void>
    disabled?: boolean
}

export default function OfficeMenu({ label, icon, buttonClassName, onPick, disabled }: OfficeMenuProps) {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)
    const [busy, setBusy] = useState(false)
    const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null)
    const btnRef = useRef<HTMLButtonElement>(null)
    const menuRef = useRef<HTMLDivElement>(null)
    const trigger = useMenuTrigger()
    const tp = trigger(open, () => !disabled && !busy && setOpen(true), () => setOpen(false))

    // 依按鈕位置定位：下方放不下就往上開；左邊對齊按鈕，但不超出畫面右緣
    useLayoutEffect(() => {
        if (!open) return
        const place = () => {
            const r = btnRef.current?.getBoundingClientRect()
            if (!r) return
            const gap = readPx('--sp-6'), width = readPx('--sz-200'), height = readPx('--sz-160')
            const left = Math.max(gap, Math.min(r.left, window.innerWidth - width - gap))
            const below = window.innerHeight - r.bottom
            setPos(below < height + gap && r.top > below ? { left, bottom: window.innerHeight - r.top + gap } : { left, top: r.bottom + gap })
        }
        place()
        window.addEventListener('resize', place)
        window.addEventListener('scroll', place, true)
        return () => {
            window.removeEventListener('resize', place)
            window.removeEventListener('scroll', place, true)
        }
    }, [open])

    useDismiss(open, () => setOpen(false), [btnRef, menuRef])

    const pick = async (app: OfficeApp) => {
        setOpen(false)
        setBusy(true)
        try {
            await onPick(app)
        } finally {
            setBusy(false)
        }
    }

    return (
        <>
            <Tooltip placement="bottom" label={label}>
                <button
                    ref={btnRef}
                    type="button"
                    disabled={disabled || busy}
                    onPointerDown={tp.onPointerDown}
                    onClick={tp.onClick}
                    aria-label={label}
                    aria-haspopup="menu"
                    aria-expanded={open}
                    className={`${tp.className} ${buttonClassName}`}
                >
                    {busy ? <Loader2 className="animate-spin" /> : icon}
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
                            style={{ left: pos.left, top: pos.top, bottom: pos.bottom, transformOrigin: pos.bottom !== undefined ? 'bottom left' : 'top left' }}
                        >
                            <LensMenu className="flex flex-col gap-0.5">
                                {OFFICE_APPS.map((app) => (
                                    <button key={app} type="button" role="menuitem" onClick={() => pick(app)} className="menu-item">
                                        <span className="whitespace-nowrap">{t(`ui.office.app.${app}`)}</span>
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
