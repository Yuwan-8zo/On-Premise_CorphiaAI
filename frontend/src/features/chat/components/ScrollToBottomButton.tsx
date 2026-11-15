import { ArrowDown } from '@/components/snow/icons'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from '@/lib/gsapMotion'
import Tooltip from '@/components/ui/Tooltip'
import { useTranslation } from 'react-i18next'
import { popIn } from '@/lib/motionPresets'

interface ScrollToBottomButtonProps {
    containerRef: React.RefObject<HTMLDivElement | null>
    dependsOn?: unknown // 用來強制更新的依賴，如 messages
    isStreaming?: boolean // AI 是否仍在串流回覆中
}

export default function ScrollToBottomButton({ containerRef, dependsOn, isStreaming }: ScrollToBottomButtonProps) {
    const { t } = useTranslation()
    const [showToBottom, setShowToBottom] = useState(false)

    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        const handleScroll = () => {
            // 計算距離底部的距離
            const { scrollTop, scrollHeight, clientHeight } = container
            const distanceFromBottom = scrollHeight - scrollTop - clientHeight

            // 60px 門檻 — 跟 useChatLogic.ts 的 autoFollowRef 同步：
            // 使用者一旦滑出 60px 就視為「主動離開底部」，
            // 此時 auto-scroll 已停止，所以馬上把「正在輸入」膠囊 / 回底部箭頭浮上來，
            // 讓使用者明確看到「AI 還在生成，但畫面不再追隨」。
            // 只要捲得動、離底部超過門檻就顯示（原本還限制「內容超過 1.5 個畫面高」，稍短的對話往上滑就沒有按鈕）
            if (distanceFromBottom > 60) {
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

    // 串流中 + 使用者已捲離底部 → 顯示膠囊狀「正在輸入…」指示器
    const showTypingPill = Boolean(isStreaming) && showToBottom

    // 位置：貼在訊息區底部；手機置中、桌機靠右。
    // 置中用 inset-x-0＋mx-auto（不用 translate）：進場動畫會設定 transform，用位移置中會被蓋掉。
    // 位置一定要放在最外層：按鈕外面包了 Tooltip，定位寫在按鈕上會變成相對於 Tooltip，整顆跑到畫面最上面被工具列蓋住
    const place = 'absolute bottom-6 inset-x-0 mx-auto w-fit md:inset-x-auto md:right-8 md:mx-0 z-30'
    // 材質：浮在訊息文字上面，用卡片材質（.paper，九成二不透明＋光邊）；半透明的玻璃按鈕疊在字上會幾乎看不見
    const surface = 'paper !rounded-full text-text-primary transition-transform duration-[var(--duration-press-out)] active:scale-95 active:duration-[var(--duration-press-in)]'

    return (
        <AnimatePresence mode="wait">
            {showTypingPill ? (
                <motion.button
                    key="typing-pill"
                    {...popIn}
                    onClick={scrollToBottom}
                    className={`${place} ${surface} flex items-center gap-2 pl-3 pr-3.5 py-2`}
                    aria-label={t('ui.scroll.typingAria')}
                >
                    <span className="flex items-center gap-1" aria-hidden="true">
                        <span className="animate-typing-bounce block w-1.5 h-1.5 rounded-full bg-accent" style={{ animationDelay: '0ms' }} />
                        <span className="animate-typing-bounce block w-1.5 h-1.5 rounded-full bg-accent" style={{ animationDelay: '150ms' }} />
                        <span className="animate-typing-bounce block w-1.5 h-1.5 rounded-full bg-accent" style={{ animationDelay: '300ms' }} />
                    </span>
                    <span className="text-[length:var(--fs-12d5)] font-medium leading-none">{t('ui.scroll.typing')}</span>
                </motion.button>
            ) : showToBottom ? (
                <motion.div key="to-bottom-arrow" {...popIn} className={place}>
                    <Tooltip label={t('ui.scroll.toBottom')} placement="top">
                        <button type="button" onClick={scrollToBottom} className={`${surface} flex h-[var(--sz-44)] w-[var(--sz-44)] items-center justify-center`} aria-label={t('ui.scroll.toBottom')}>
                            <ArrowDown className="w-[var(--sz-20)] h-[var(--sz-20)]" />
                        </button>
                    </Tooltip>
                </motion.div>
            ) : null}
        </AnimatePresence>
    )
}
