import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface ScrollToBottomButtonProps {
    containerRef: React.RefObject<HTMLDivElement | null>
    dependsOn?: unknown // 用來強制更新的依賴，如 messages
}

export default function ScrollToBottomButton({ containerRef, dependsOn }: ScrollToBottomButtonProps) {
    const [showToBottom, setShowToBottom] = useState(false)

    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        const handleScroll = () => {
            // 計算距離底部的距離
            const { scrollTop, scrollHeight, clientHeight } = container
            const distanceFromBottom = scrollHeight - scrollTop - clientHeight

            // 如果距離底部大於 200px 且內容夠長，則顯示「往下箭頭」
            if (distanceFromBottom > 200 && scrollHeight > clientHeight * 1.5) {
                setShowToBottom(true)
            } else {
                setShowToBottom(false)
            }
        }

        container.addEventListener('scroll', handleScroll)
        // 初次呼叫，也要依據 dependsOn 決定是否檢查
        handleScroll()
        
        // Timeout 以防止剛渲染時 scrollHeight 還沒更新
        const timeoutId = setTimeout(handleScroll, 100)

        // ResizeObserver 可以偵測內容高度改變（比如新訊息長度）
        const resizeObserver = new ResizeObserver(() => handleScroll())
        resizeObserver.observe(container)

        return () => {
            container.removeEventListener('scroll', handleScroll)
            clearTimeout(timeoutId)
            resizeObserver.disconnect()
        }
    }, [containerRef, dependsOn])

    const scrollToBottom = () => {
        if (!containerRef.current) return
        containerRef.current.scrollTo({
            top: containerRef.current.scrollHeight,
            behavior: 'smooth'
        })
    }

    return (
        <AnimatePresence>
            {showToBottom && (
                <motion.button
                    initial={{ opacity: 0, y: 15, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 15, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                    onClick={scrollToBottom}
                    className="absolute bottom-6 right-1/2 translate-x-1/2 md:translate-x-0 md:right-8 z-30 p-2.5 bg-bg-base/90 backdrop-blur-md rounded-full text-text-secondary shadow-md border border-border-subtle/50 hover:bg-bg-surface hover:text-text-primary transition-colors"
                    aria-label="Scroll to bottom"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <polyline points="19 12 12 19 5 12"></polyline>
                    </svg>
                </motion.button>
            )}
        </AnimatePresence>
    )
}
