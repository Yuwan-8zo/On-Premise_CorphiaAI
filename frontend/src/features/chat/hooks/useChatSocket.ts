/**
 * 聊天的即時連線（WebSocket）連線池：每個對話一條，可以同時存在
 *   - 切到別的對話時，舊對話的連線不斷，正在生成的回答在背景繼續（多工）
 *   - 每條連線綁定自己的對話，收到的字寫進那個對話（messageStreamHandlers）
 *   - 開新連線時順手關掉「不在畫面上、也沒在生成」的閒置連線，避免越開越多
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { createChatWebSocket, type ChatWebSocket } from '@/api/websocket'
import { useChatStore } from '@/store/chatStore'
import { buildStreamDispatcher } from './messageStreamHandlers'

export function useChatSocket() {
    const pool = useRef(new Map<string, ChatWebSocket>())
    const [isConnecting, setIsConnecting] = useState(false)

    /** 關掉閒置的連線（不是 keep、不在畫面上、也沒在生成） */
    const prune = (keep: string) => {
        const { currentConversation, streamingIds } = useChatStore.getState()
        for (const [id, ws] of pool.current) {
            if (id === keep || id === currentConversation?.id || streamingIds[id]) continue
            ws.disconnect()
            pool.current.delete(id)
        }
    }

    /** 取得（必要時建立）某個對話的連線 */
    const connect = useCallback(async (conversationId: string) => {
        const existing = pool.current.get(conversationId)
        if (existing?.isConnected) return existing
        existing?.disconnect()

        const ws = createChatWebSocket(conversationId)
        ws.onMessage(buildStreamDispatcher(conversationId))
        pool.current.set(conversationId, ws)
        prune(conversationId)

        try {
            setIsConnecting(true)
            await ws.connect()
        } catch (error) {
            console.error('WebSocket 連接失敗:', error)
        } finally {
            setIsConnecting(false)
        }
        return ws
    }, [])

    /** 某個對話目前的連線（可能沒有） */
    const get = useCallback((conversationId: string | undefined) => {
        if (!conversationId) return undefined
        const ws = pool.current.get(conversationId)
        return ws?.isConnected ? ws : undefined
    }, [])

    /** 關掉某個對話的連線（刪除對話時） */
    const close = useCallback((conversationId: string) => {
        pool.current.get(conversationId)?.disconnect()
        pool.current.delete(conversationId)
    }, [])

    useEffect(() => {
        const conns = pool.current
        return () => conns.forEach((ws) => ws.disconnect())
    }, [])

    return { isConnecting, connect, get, close }
}
