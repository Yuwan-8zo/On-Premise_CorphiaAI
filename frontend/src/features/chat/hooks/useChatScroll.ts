/**
 * 訊息區的捲動
 *   - 自動跟隨：貼在底部（離底 ≤ 60px）時，新訊息／串流文字會自動往下捲；使用者往上捲就停止跟隨
 *     （用 ref 不用 state：只是 effect 內部判斷用，不需要重新繪製）
 *   - 切換對話或一次載入整段：直接定位到底部（不從最上面滑下來）；之後內容晚一點才長高也留在底部
 *   - 捲到最上面：自動載入更早的訊息，並維持原本的閱讀位置
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { conversationsApi } from '@/api/conversations'
import { useChatStore } from '@/store/chatStore'
import type { Message } from '@/types/chat'
import { MESSAGE_PAGE_SIZE } from './chatHelpers'

export function useChatScroll(messages: Message[], conversationId: string | undefined) {
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const topObserverRef = useRef<HTMLDivElement>(null)
    const autoFollowRef = useRef(true)
    const [hasMoreMessages, setHasMoreMessages] = useState(false)
    const [isLoadingMore, setIsLoadingMore] = useState(false)

    useEffect(() => {
        const container = scrollContainerRef.current
        if (!container) return
        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = container
            // 60px 容忍：彈性捲動、版面抖動不會誤判
            autoFollowRef.current = scrollHeight - scrollTop - clientHeight <= 60
        }
        container.addEventListener('scroll', handleScroll, { passive: true })
        handleScroll()
        return () => container.removeEventListener('scroll', handleScroll)
    }, [])

    const hasMessages = messages.length > 0
    // 內容在畫完之後才長高（程式碼上色、圖片、表格晚一點才載入）：使用者還貼在底部的話，跟著留在最底下，
    // 不然打開對話會停在中間、最後一則的回答和按鈕被擋在下面
    useEffect(() => {
        const container = scrollContainerRef.current
        const list = messagesEndRef.current?.parentElement
        if (!container || !list) return
        let last = list.offsetHeight
        const ro = new ResizeObserver(() => {
            const h = list.offsetHeight
            const grew = h > last
            last = h
            if (grew && autoFollowRef.current) container.scrollTop = container.scrollHeight
        })
        ro.observe(list)
        return () => ro.disconnect()
    // 訊息清單在第一則訊息出現時才掛上，所以「有沒有訊息」也要重新掛
    }, [conversationId, hasMessages])

    // 切換聊天室或一次載入整段對話：直接到底；聊天中新增 1～2 則或串流變長：平滑往下捲
    const lastConvIdRef = useRef<string | undefined>(undefined)
    const lastCountRef = useRef(0)
    useEffect(() => {
        const switched = conversationId !== lastConvIdRef.current
        const bulk = messages.length - lastCountRef.current > 2 || (lastCountRef.current === 0 && messages.length > 0)
        lastConvIdRef.current = conversationId
        lastCountRef.current = messages.length
        if (switched || bulk) {
            autoFollowRef.current = true
            const jump = () => {
                const c = scrollContainerRef.current
                if (c) c.scrollTop = c.scrollHeight
            }
            jump()
            requestAnimationFrame(jump)
            return
        }
        // 只有使用者還貼在底部才自動往下；否則尊重閱讀位置
        if (autoFollowRef.current) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, conversationId])

    const loadMoreMessages = useCallback(async () => {
        const { currentConversation, messages: current } = useChatStore.getState()
        const convId = currentConversation?.id
        if (!convId || current.length === 0 || isLoadingMore || !hasMoreMessages) return
        try {
            setIsLoadingMore(true)
            const older = await conversationsApi.getMessages(convId, { beforeId: current[0].id })
            if (older.length === 0) {
                setHasMoreMessages(false)
                return
            }
            // 插入舊訊息後，把捲動位置往下補回新增的高度，畫面才不會跳
            const container = scrollContainerRef.current
            const oldHeight = container?.scrollHeight || 0
            useChatStore.getState().setMessages([...older, ...current])
            setHasMoreMessages(older.length === MESSAGE_PAGE_SIZE)
            requestAnimationFrame(() => {
                if (container) container.scrollTop = container.scrollHeight - oldHeight
            })
        } catch (error) {
            console.error('載入舊訊息失敗:', error)
        } finally {
            setIsLoadingMore(false)
        }
    }, [isLoadingMore, hasMoreMessages])

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) loadMoreMessages()
            },
            { root: scrollContainerRef.current, threshold: 0.1 },
        )
        const target = topObserverRef.current
        if (target) observer.observe(target)
        return () => observer.disconnect()
    }, [loadMoreMessages])

    /** 使用者剛送出訊息或切換對話：重新開始自動跟隨 */
    const followBottom = () => {
        autoFollowRef.current = true
    }

    return { messagesEndRef, scrollContainerRef, topObserverRef, isLoadingMore, setHasMoreMessages, followBottom }
}
