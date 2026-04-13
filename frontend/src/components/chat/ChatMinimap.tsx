import { useEffect, useState } from 'react'
import type { Message } from '../../types/chat'

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

export default function ChatMinimap({ messages, containerRef }: ChatMinimapProps) {
    const [markers, setMarkers] = useState<Marker[]>([])

    const updateMarkers = () => {
        if (!containerRef.current || messages.length === 0) {
            setMarkers([])
            return
        }
        
        const container = containerRef.current
        const scrollHeight = container.scrollHeight
        // 如果內容還沒長出來就先不畫
        if (scrollHeight === 0) return

        const newMarkers = messages.map(msg => {
            const el = document.getElementById(`msg-${msg.id}`)
            if (!el) return null
            
            // 計算這個元素在整個捲動高度中的「百分比位置」跟「高度比例」
            const topPercent = (el.offsetTop / scrollHeight) * 100
            const heightPercent = (el.offsetHeight / scrollHeight) * 100
            
            return {
                id: msg.id,
                top: topPercent,
                height: heightPercent,
                role: msg.role as 'user' | 'assistant'
            }
        }).filter(Boolean) as Marker[]
        
        setMarkers(newMarkers)
    }

    useEffect(() => {
        // Debounce update to save performance
        let timeoutId: ReturnType<typeof setTimeout>
        const debouncedUpdate = () => {
            clearTimeout(timeoutId)
            timeoutId = setTimeout(updateMarkers, 50)
        }

        debouncedUpdate()

        if (!containerRef.current) return

        // 監聽容器的大小改變（例如視窗變化、內部元件長高）
        const resizeObserver = new ResizeObserver(() => debouncedUpdate())
        resizeObserver.observe(containerRef.current)
        
        // 監聽內部 DOM 變更（AI Streaming 打字時，文字會一直增加）
        const mutationObserver = new MutationObserver(() => debouncedUpdate())
        mutationObserver.observe(containerRef.current, { 
            childList: true, 
            subtree: true, 
            characterData: true 
        })

        return () => {
            clearTimeout(timeoutId)
            resizeObserver.disconnect()
            mutationObserver.disconnect()
        }
    }, [messages, containerRef])

    const scrollToMsg = (id: string) => {
        const el = document.getElementById(`msg-${id}`)
        if (el && containerRef.current) {
            // 平滑滾動到該訊息的頂部（留一點 padding）
            containerRef.current.scrollTo({ 
                top: el.offsetTop - 20, 
                behavior: 'smooth' 
            })
        }
    }

    if (markers.length === 0) return null

    return (
        <div className="absolute right-1 top-4 bottom-4 w-4 z-10 pointer-events-none group hidden md:block">
            <div 
                className="relative w-full h-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-auto cursor-pointer"
                onClick={(e) => {
                    if (!containerRef.current) return
                    // 點擊時間軸任意位置，依照百分比推算捲動位置
                    const rect = e.currentTarget.getBoundingClientRect()
                    const clickY = e.clientY - rect.top
                    const percentage = clickY / rect.height
                    containerRef.current.scrollTo({ 
                        top: containerRef.current.scrollHeight * percentage, 
                        behavior: 'smooth' 
                    })
                }}
            >
                {/* Visual track background */}
                <div className="absolute inset-y-0 right-[5px] w-[6px] bg-gray-200/50 dark:bg-gray-700/50 rounded-full" />
                
                {markers.map(marker => (
                    <div 
                        key={marker.id}
                        className={`absolute right-[4px] w-[8px] rounded-full transition-all duration-300 hover:w-[12px] hover:right-[2px] ${
                            marker.role === 'user' 
                                ? 'bg-gray-400 dark:bg-gray-500' 
                                : 'bg-ios-blue-light dark:bg-ios-blue-dark'
                        }`}
                        style={{ 
                            top: `${marker.top}%`, 
                            height: `${Math.max(marker.height, 1)}%`, // 至少給 1% 高度確保可見
                            minHeight: '4px'
                        }}
                        onClick={(e) => {
                            e.stopPropagation()
                            scrollToMsg(marker.id)
                        }}
                        title={marker.role === 'user' ? '用戶' : 'Corphia AI'}
                    />
                ))}
            </div>
        </div>
    )
}
