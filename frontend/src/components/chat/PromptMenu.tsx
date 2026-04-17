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
    const menuRef = useRef<HTMLDivElement>(null)
    const { t } = useTranslation()

    // 從 i18n 取出 templates 陣列
    const templates = t('chat.promptTemplates', { returnObjects: true }) as PromptTemplate[]

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
                className="flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-2 min-w-[36px] min-h-[36px] rounded-full transition-colors bg-white dark:bg-ios-dark-gray4 border border-ios-light-gray5 dark:border-white/5 shadow-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-[rgb(var(--color-ios-accent-dark)/0.15)] disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-ios-accent-light)/0.3)] dark:focus:ring-[rgb(var(--color-ios-accent-dark)/0.3)]"
                title={t('chat.promptTemplatesTitle') || '提示詞模版'}
            >
                {/* 閃亮圖示 (Sparkles) */}
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                </svg>
                {/* 桌面版文字 */}
                <span className="hidden sm:inline text-sm font-medium">模版</span>
                {/* 箭頭 (Chevron Down) */}
                <svg className="w-3.5 h-3.5 shrink-0 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
            </button>

            {/* 下拉選單 */}
            {isOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-48 sm:w-56 bg-white dark:bg-ios-dark-gray5 rounded-2xl shadow-xl border border-gray-200/50 dark:border-white/10 overflow-hidden transform-gpu z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="py-2 flex flex-col">
                        <div className="px-3 md:px-4 py-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                            提示詞模版
                        </div>
                        {templates.map((item, index) => (
                            <button
                                key={index}
                                onClick={() => {
                                    onSelect(item.prompt)
                                    setIsOpen(false)
                                }}
                                className="w-full text-left px-3 md:px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors hover:bg-[rgb(var(--color-ios-accent-light)/0.1)] dark:hover:bg-[rgb(var(--color-ios-accent-dark)/0.15)] hover:text-[rgb(var(--color-ios-accent-light))] dark:hover:text-[rgb(var(--color-ios-accent-dark))]"
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
