import { useEffect, useState, useCallback } from 'react'
import type { Message } from '@/types/chat'

interface ChatMinimapProps {
    messages: Message[]
    containerRef: React.RefObject<HTMLDivElement | null>
}

interface Marker {
    id: string
    top: number
    height: number
    role: 'user' | 'assistant'
}

/**
 * ChatMinimap — 右側訊息縮圖時間軸。
 *
 * 設計重點：
 *   - 只在 group hover 時 fade-in（避免擋到聊天右側）
 *   - 每則訊息一顆膠囊；user = accent / AI = 中性灰，色彩鮮明可區別角色
 *   - 全部用 left: 50% + translate(-50%) 對齊到 track 中線
 *     **不要包 Tooltip 元件**：Tooltip wrapper 是 `relative inline-flex`，
 *     會把 absolute 子元素的座標起點吃掉，造成 marker 跑到左上角
 *   - hover 顯示訊息預覽（前 40 字），點擊跳轉
 */
export default function ChatMinimap({ messages, containerRef }: ChatMinimapProps) {
    const [markers, setMarkers] = useState<Marker[]>([])
    const [hoveredId, setHoveredId] = useState<string | null>(null)

    const updateMarkers = useCallback(() => {
        if (!containerRef.current || messages.length === 0) {
            setMarkers([])
            return
        }

        const container = containerRef.current
        const scrollHeight = container.scrollHeight
        if (scrollHeight === 0) return

        const newMarkers = messages.map(msg => {
            const el = document.getElementById(`msg-${msg.id}`)
            if (!el) return null

            const topPercent = (el.offsetTop / scrollHeight) * 100
            const heightPercent = (el.offsetHeight / scrollHeight) * 100

            return {
                id: msg.id,
                top: topPercent,
                height: heightPercent,
                role: msg.role as 'user' | 'assistant',
            }
        }).filter(Boolean) as Marker[]

        setMarkers(newMarkers)
    }, [messages, containerRef])

    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout>
        const debouncedUpdate = () => {
            clearTimeout(timeoutId)
            timeoutId = setTimeout(updateMarkers, 50)
        }

        debouncedUpdate()

        if (!containerRef.current) return

        const resizeObserver = new ResizeObserver(() => debouncedUpdate())
        resizeObserver.observe(containerRef.current)

        const mutationObserver = new MutationObserver(() => debouncedUpdate())
        mutationObserver.observe(containerRef.current, {
            childList: true,
            subtree: true,
            characterData: true,
        })

        return () => {
            clearTimeout(timeoutId)
            resizeObserver.disconnect()
            mutationObserver.disconnect()
        }
    }, [containerRef, updateMarkers])

    const scrollToMsg = (id: string) => {
        const el = document.getElementById(`msg-${id}`)
        if (el && containerRef.current) {
            containerRef.current.scrollTo({
                top: el.offsetTop - 20,
                behavior: 'smooth',
            })
        }
    }

    if (markers.length === 0) return null

    // hover 中的 marker 找出來算 tooltip 位置 + 內容
    const hoveredMarker = hoveredId ? markers.find(m => m.id === hoveredId) : null
    const hoveredMessage = hoveredId ? messages.find(m => m.id === hoveredId) : null
    // 取訊息前 40 字當預覽（去掉換行避免 tooltip 變超高）
    const previewText = (() => {
        if (!hoveredMessage) return ''
        const raw = (hoveredMessage.content || '').replace(/\s+/g, ' ').trim()
        if (!raw) return '（無內容）'
        return raw.length > 40 ? raw.slice(0, 40) + '…' : raw
    })()

    return (
        <div className="absolute right-1 top-4 bottom-4 w-8 z-10 pointer-events-none group hidden md:block">
            <div
                className="relative w-full h-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-auto cursor-pointer"
                onClick={(e) => {
                    if (!containerRef.current) return
                    const rect = e.currentTarget.getBoundingClientRect()
                    const clickY = e.clientY - rect.top
                    const percentage = clickY / rect.height
                    containerRef.current.scrollTo({
                        top: containerRef.current.scrollHeight * percentage,
                        behavior: 'smooth',
                    })
                }}
            >
                {/*
                  Track 背景 — 容器水平中線。
                */}
                <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[14px] bg-black/5 dark:bg-white/5 rounded-full" />

                {markers.map(marker => {
                    // 顏色對應聊天角色：
                    //  - user → accent（bronze）醒目，跟使用者氣泡呼應
                    //  - assistant → 中性灰，跟 track 對比夠但不搶
                    const colorClass = marker.role === 'user'
                        ? 'bg-accent shadow-sm shadow-accent/30'
                        : 'bg-text-primary/50 hover:bg-text-primary/80 dark:bg-text-secondary/70'
                    return (
                        <div
                            key={marker.id}
                            className={`absolute w-[14px] min-h-[14px] rounded-full transition-all duration-200 hover:w-[20px] hover:min-h-[20px] cursor-pointer ${colorClass}`}
                            style={{
                                top: `${marker.top + marker.height / 2}%`,
                                left: '50%',
                                height: `${Math.max(marker.height, 1)}%`,
                                transform: 'translate(-50%, -50%)',
                            }}
                            onMouseEnter={() => setHoveredId(marker.id)}
                            onMouseLeave={() => setHoveredId(null)}
                            onClick={(e) => {
                                e.stopPropagation()
                                scrollToMsg(marker.id)
                            }}
                        />
                    )
                })}

                {/*
                  Hover preview 提示卡 — 在 marker 左側顯示訊息預覽。
                  自己做不用 <Tooltip>，因為 Tooltip 的 relative wrapper 會破壞
                  marker 的 absolute 定位（已踩過坑）。
                  pointer-events-none 自己不擋滑鼠 → 不會跟 marker hover 互相打架。
                */}
                {hoveredMarker && (
                    /*
                      尺寸策略（v4）：完全內容驅動
                      - width: max-content → 跟著內容長度自然撐開，「晚安」就只有「晚安」那麼寬
                      - maxWidth: 240 → 長訊息上限，超出時 break-words 換行
                      - 不設 minWidth → 真正做到「寬度根據內容變」，短訊息收緊、長訊息撐到 240
                      - 用 right: calc(100% + 8px) 把右邊緣鎖到 marker 左側 8px
                    */
                    <div
                        className="absolute z-50 pointer-events-none flex items-start gap-2 rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2 shadow-lg break-words"
                        style={{
                            top: `${hoveredMarker.top + hoveredMarker.height / 2}%`,
                            right: 'calc(100% + 8px)',
                            width: 'max-content',
                            maxWidth: 240,
                            transform: 'translateY(-50%)',
                        }}
                    >
                        {/* 角色色塊：直接呼應 marker 顏色 */}
                        <span
                            className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                                hoveredMarker.role === 'user'
                                    ? 'bg-accent'
                                    : 'bg-text-primary/60 dark:bg-text-secondary/80'
                            }`}
                        />
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-text-muted leading-none mb-1">
                                {hoveredMarker.role === 'user' ? '您' : 'Corphia AI'}
                            </p>
                            <p className="text-xs text-text-primary leading-snug">
                                {previewText}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
