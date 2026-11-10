import LensMenu from '@/components/ui/LensMenu'
import { Reader } from '@/components/snow/icons'
import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import Tooltip from '@/components/ui/Tooltip'

interface PromptTemplate {
    title: string
    prompt: string
}

interface PromptMenuProps {
    onSelect: (prompt: string) => void
    disabled?: boolean
    /** 放在輸入欄裡：38 圓鈕、內距 6，與欄位外框同心（25 − 6 = 19） */
    inline?: boolean
}

export function PromptMenu({ onSelect, disabled, inline = false }: PromptMenuProps) {
    const [isOpen, setIsOpen] = useState(false)
    // 「進場 / 退場動畫」雙 state pattern：
    //   - isVisible：是否真的 mount 在 DOM（控制 unmount 延遲）
    //   - isAnimating：當前是否在「展開」狀態（控制 transform / opacity）
    // 開啟流程：setIsOpen(true) → setIsVisible(true) → 下一幀 setIsAnimating(true)
    //          → CSS transition 觸發進場（fade-in + slide-up + scale-up）
    // 關閉流程：setIsOpen(false) → setIsAnimating(false)
    //          → CSS transition 觸發退場 → 220ms 後 setIsVisible(false) unmount
    // 為什麼需要 requestAnimationFrame 雙層：第一層幀讓元素 mount 在 closed 狀態，
    // 第二層幀才翻 isAnimating=true，瀏覽器才會有「兩個狀態之間的 transition」可動畫。
    const [isVisible, setIsVisible] = useState(false)
    const [isAnimating, setIsAnimating] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)
    const popRef = useRef<HTMLDivElement>(null)
    const btnRef = useRef<HTMLButtonElement>(null)
    // 選單掛到 body：放在輸入欄（本身是毛玻璃）裡面時，瀏覽器只會模糊到輸入欄為止，
    // 後面的頁面完全沒被模糊 → 文字透出來。所以改用 portal ＋ 依按鈕位置固定定位。
    const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null)
    const { t } = useTranslation()

    // 從 i18n 取出 templates 陣列
    const templates = t('chat.promptTemplates', { returnObjects: true }) as PromptTemplate[]

    // 進/退場動畫排程
    useEffect(() => {
        if (isOpen) {
            setIsVisible(true)
            const id = requestAnimationFrame(() => {
                requestAnimationFrame(() => setIsAnimating(true))
            })
            return () => cancelAnimationFrame(id)
        } else if (isVisible) {
            setIsAnimating(false)
            const t = setTimeout(() => setIsVisible(false), 220)
            return () => clearTimeout(t)
        }
    }, [isOpen, isVisible])

    // 點擊其他地方關閉選單
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node
            if (menuRef.current && !menuRef.current.contains(target) && !popRef.current?.contains(target)) {
                setIsOpen(false)
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isOpen])

    // 開啟時算出按鈕位置（視窗縮放時重算）
    useLayoutEffect(() => {
        if (!isVisible) return
        const place = () => {
            const r = btnRef.current?.getBoundingClientRect()
            if (!r) return
            const gap = inline ? 6 : 0
            setPos({ left: r.left - gap, bottom: window.innerHeight - r.top + (inline ? 14 : 8) })
        }
        place()
        window.addEventListener('resize', place)
        return () => window.removeEventListener('resize', place)
    }, [isVisible, inline])

    // 如果沒有設定模板或格式不對，不顯示按鈕
    if (!Array.isArray(templates) || templates.length === 0) {
        return null
    }

    return (
        <div className="relative flex items-center" ref={menuRef}>
            <Tooltip label={isOpen ? '' : (t('chat.promptTemplatesTitle') || '提示詞模版')}>
                <button
                    ref={btnRef}
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    disabled={disabled}
                    className={`btn-icon ${inline ? '!w-[38px] !h-[38px] [--R:19px]' : ''} shrink-0 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30
                        transition-[transform,background-color,border-color,color] duration-200 ease-apple
                        active:scale-90
                        ${isOpen
                            ? 'is-current text-accent'
                            : 'text-text-secondary'}`}
                    aria-expanded={isOpen}
                >
                    {/* 提示詞模板圖示（文件＋文字行） */}
                    <Reader className="w-5 h-5 shrink-0" />
                </button>
            </Tooltip>

            {/* 下拉選單：portal 到 body，毛玻璃才會模糊到後面的頁面。
                外框圓角 22、內距 6 → 項目圓角 16（同心）；懸停不變色 */}
            {isVisible && pos && createPortal(
                <div
                    ref={popRef}
                    className="fixed w-52 sm:w-60 paper !rounded-[22px] p-[6px] transform-gpu z-[60] origin-bottom-left"
                    style={{
                        left: pos.left,
                        bottom: pos.bottom,
                        opacity: isAnimating ? 1 : 0,
                        transform: isAnimating ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.95)',
                        transition: 'opacity 200ms var(--ease-out), transform 300ms var(--ease-out)',
                        pointerEvents: isAnimating ? 'auto' : 'none',
                    }}
                >
                    <LensMenu className="">
                    <div className="flex flex-col">
                        <div className="px-3 pt-2 pb-1.5 text-[12px] font-semibold text-text-muted tracking-wider">
                            {t('chat.promptTemplatesTitle') || '提示詞模版'}
                        </div>
                        {templates.map((item, index) => (
                            <button
                                key={index}
                                onClick={() => {
                                    onSelect(item.prompt)
                                    setIsOpen(false)
                                }}
                                className="menu-item"
                            >
                                {item.title}
                            </button>
                        ))}
                    </div>
                    </LensMenu>
                </div>,
                document.body,
            )}
        </div>
    )
}
