import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

interface PromptTemplate {
    title: string
    prompt: string
}

interface PromptMenuProps {
    onSelect: (prompt: string) => void
    disabled?: boolean
}

export function PromptMenu({ onSelect, disabled }: PromptMenuProps) {
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
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
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

    // 如果沒有設定模板或格式不對，不顯示按鈕
    if (!Array.isArray(templates) || templates.length === 0) {
        return null
    }

    return (
        <div className="relative flex items-center" ref={menuRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                disabled={disabled}
                className={`flex items-center justify-center w-[42px] h-[42px] shrink-0 rounded-full border shadow-sm disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-accent/30
                    transition-[transform,background-color,border-color,color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]
                    active:scale-90
                    ${isOpen
                        ? 'bg-accent/15 border-accent/40 text-accent scale-105'
                        : 'bg-bg-base border-border-subtle text-text-secondary hover:text-text-primary hover:bg-white/[0.06]'}`}
                title={t('chat.promptTemplatesTitle') || '提示詞模版'}
                aria-expanded={isOpen}
            >
                {/* 閃亮圖示 (Sparkles)，open 時跟著旋轉 + 加倍體積感 */}
                <svg
                    className={`w-5 h-5 shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${isOpen ? 'rotate-[12deg] scale-110' : 'rotate-0 scale-100'}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                </svg>
            </button>

            {/* 下拉選單：進場 + 退場 transition（不靠 tailwindcss-animate plugin） */}
            {isVisible && (
                <div
                    className="absolute bottom-full left-0 mb-2 w-48 sm:w-56 bg-bg-base rounded-2xl shadow-xl border border-border-subtle/50 overflow-hidden transform-gpu z-50 origin-bottom-left"
                    style={{
                        opacity: isAnimating ? 1 : 0,
                        transform: isAnimating ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.95)',
                        transition: 'opacity 200ms cubic-bezier(0.22, 1, 0.36, 1), transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
                        pointerEvents: isAnimating ? 'auto' : 'none',
                    }}
                >
                    <div className="py-2 flex flex-col">
                        <div className="px-3 md:px-4 py-2 text-xs font-semibold text-text-muted uppercase tracking-wider">
                            提示詞模版
                        </div>
                        {templates.map((item, index) => (
                            <button
                                key={index}
                                onClick={() => {
                                    onSelect(item.prompt)
                                    setIsOpen(false)
                                }}
                                className="w-full text-left px-3 md:px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-accent/10 hover:text-accent active:scale-[0.98]"
                            >
                                {item.title}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
