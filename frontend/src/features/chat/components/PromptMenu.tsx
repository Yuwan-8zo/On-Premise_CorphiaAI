import { Book, Code, FileText, Languages, Layers3, Mail, Reader, Search, ShieldCheck, Sparkles } from '@/components/snow/icons'
import { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import Tooltip from '@/components/ui/Tooltip'
import GlassSegmented from '@/components/ui/GlassSegmented'

interface PromptTemplate {
    title: string
    prompt: string
}

interface PromptCategory {
    id: string
    name: string
    items: PromptTemplate[]
}

/** 各類別的圖示（沒對到的用文件圖示） */
const CATEGORY_ICONS: Record<string, typeof Reader> = {
    write: Sparkles,
    summary: FileText,
    language: Languages,
    office: Mail,
    code: Code,
    security: ShieldCheck,
    learn: Book,
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

    // 從 i18n 取出分類好的模板庫
    const library = t('chat.promptLibrary', { returnObjects: true }) as PromptCategory[]
    const [query, setQuery] = useState('')
    const [cat, setCat] = useState<string>('all')
    const searchRef = useRef<HTMLInputElement>(null)

    // 依類別與搜尋字過濾（搜尋同時比對標題、內容與類別名；搜尋時不分類別）
    const groups = useMemo(() => {
        if (!Array.isArray(library)) return []
        const q = query.trim().toLowerCase()
        return library
            .filter((c) => q || cat === 'all' || c.id === cat)
            .map((c) => ({
                ...c,
                items: q ? c.items.filter((it) => (it.title + it.prompt + c.name).toLowerCase().includes(q)) : c.items,
            }))
            .filter((c) => c.items.length > 0)
    }, [library, query, cat])

    // 打開時清空搜尋、聚焦搜尋框
    useEffect(() => {
        if (isOpen) {
            setQuery('')
            const id = window.setTimeout(() => searchRef.current?.focus(), 60)
            return () => window.clearTimeout(id)
        }
    }, [isOpen])

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

    const pick = (prompt: string) => {
        onSelect(prompt)
        setIsOpen(false)
    }

    // 鍵盤：搜尋框按 ↓ 進清單、Enter 直接套用第一個；清單裡 ↑↓ 移動，最上面再按 ↑ 回搜尋框
    const items = () => Array.from(popRef.current?.querySelectorAll<HTMLButtonElement>('.prompt-item') ?? [])
    const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            items()[0]?.focus()
        } else if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            const first = groups[0]?.items[0]
            if (first) {
                e.preventDefault()
                pick(first.prompt)
            }
        }
    }
    const onListKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
        const list = items()
        const i = list.indexOf(document.activeElement as HTMLButtonElement)
        if (i < 0) return
        e.preventDefault()
        if (e.key === 'ArrowDown') list[Math.min(i + 1, list.length - 1)].focus()
        else if (i === 0) searchRef.current?.focus()
        else list[i - 1].focus()
    }

    // 如果沒有設定模板或格式不對，不顯示按鈕
    if (!Array.isArray(library) || library.length === 0) {
        return null
    }

    return (
        <div className="relative flex items-center" ref={menuRef}>
            <Tooltip label={isOpen ? '' : t('chat.promptTemplatesTitle')}>
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

            {/* 模板面板：portal 到 body（毛玻璃才模糊得到後面）
                外框圓角 26、內距 10 → 搜尋框、類別膠囊、列都是同心的 16（26 − 10）；懸停不變色
                結構：標題 → 搜尋框 → 類別工具列（一排圖示）→ 依類別分組的模板清單（圖示＋標題＋一行預覽） */}
            {isVisible && pos && createPortal(
                <div
                    ref={popRef}
                    role="dialog"
                    aria-label={t('chat.promptTemplatesTitle')}
                    className="prompt-panel fixed w-[min(400px,calc(100vw-24px))] paper paper-solid !rounded-[26px] p-[10px] transform-gpu z-[60] origin-bottom-left flex flex-col"
                    style={{
                        left: pos.left,
                        bottom: pos.bottom,
                        // 固定高度：切換分類時清單長短不同，面板也不會縮放，工具列不會在滑鼠底下跳動
                        height: `min(460px, ${Math.max(240, window.innerHeight - pos.bottom - 24)}px)`,
                        opacity: isAnimating ? 1 : 0,
                        transform: isAnimating ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.95)',
                        transition: 'opacity 200ms var(--ease-out), transform 300ms var(--ease-out)',
                        pointerEvents: isAnimating ? 'auto' : 'none',
                    }}
                    onKeyDown={(e) => { if (e.key === 'Escape') setIsOpen(false) }}
                >
                    <div className="shrink-0 px-[10px] pt-[6px] pb-[10px] text-[17px] leading-[22px] font-semibold text-text-primary">
                        {t('chat.promptTemplatesTitle')}
                    </div>

                    {/* 搜尋框 */}
                    <label className="prompt-search shrink-0">
                        <Search className="h-[16px] w-[16px] shrink-0 text-text-muted" />
                        <input
                            ref={searchRef}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={onSearchKey}
                            placeholder={t('chat.promptSearch')}
                            className="min-w-0 flex-1 bg-transparent text-[15px] leading-[20px] text-text-primary outline-none placeholder:text-text-muted"
                        />
                    </label>

                    {/* 類別工具列：一排圖示（分段切換＋放大鏡），名稱顯示在下面清單的分組標題；搜尋時隱藏 */}
                    {!query.trim() && (
                        <GlassSegmented
                            className="prompt-cats w-full shrink-0"
                            pad={4}
                            growLong={11.5}
                            growCross={4.5}
                            tooltips
                            toolbar
                            value={cat}
                            onChange={setCat}
                            options={[{ id: 'all', name: t('chat.promptAll') }, ...library.map((c) => ({ id: c.id, name: c.name }))].map((c) => {
                                const Icon = c.id === 'all' ? Layers3 : (CATEGORY_ICONS[c.id] ?? Reader)
                                return { value: c.id, name: c.name, label: <Icon className="w-[21px] h-[21px]" aria-hidden /> }
                            })}
                        />
                    )}

                    {/* 模板清單 */}
                    <div className="prompt-list chat-scroll min-h-0 flex-1 overflow-y-auto scrollbar-none" onKeyDown={onListKey}>
                        {groups.length === 0 && (
                            <p className="px-[10px] py-[24px] text-center text-[15px] leading-[20px] text-text-muted">{t('chat.promptEmpty')}</p>
                        )}
                        {groups.map((g) => (
                            <div key={g.id}>
                                <div className="prompt-group">{g.name}</div>
                                {g.items.map((item) => {
                                    const Icon = CATEGORY_ICONS[g.id] ?? Reader
                                    return (
                                        <button
                                            key={g.id + item.title}
                                            type="button"
                                            onClick={() => pick(item.prompt)}
                                            className="prompt-item"
                                        >
                                            <span className="prompt-icon"><Icon className="w-[17px] h-[17px]" /></span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-[15px] leading-[20px] font-semibold text-text-primary">{item.title}</span>
                                                <span className="block truncate text-[13px] leading-[18px] text-text-secondary">{item.prompt.trim()}</span>
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>
                        ))}
                    </div>
                </div>,
                document.body,
            )}
        </div>
    )
}
