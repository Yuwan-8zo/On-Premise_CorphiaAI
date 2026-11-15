/**
 * 聊天的即時連線（WebSocket）連線池：每個對話一條，可以同時存在
 *   - 切到別的對話時，舊對話的連線不斷，正在生成的回答在背景繼續（多工）
 *   - 每條連線綁定自己的對話，收到的字寫進那個對話（messageStreamHandlers）
 *   - 開新連線時順手關掉「不在畫面上、也沒在生成」的閒置連線，避免越開越多
 *   - 連線池不跟著聊天頁：離開聊天頁（去管理後台、設定）再回來，正在生成的回答照樣繼續寫進對話；
 *     以前連線綁在聊天頁上，一離開就全部斷掉，回來只剩一則空的回答。登出時才全部關掉
 */
import { useCallback, useState } from 'react'
import { createChatWebSocket, type ChatWebSocket } from '@/api/websocket'
import { useAuthStore } from '@/store/authStore'
import { useChatStore } from '@/store/chatStore'
import { buildStreamDispatcher } from './messageStreamHandlers'

/** 所有對話的連線（整個應用程式共用一份，不跟著哪一頁） */
const pool = { current: new Map<string, ChatWebSocket>() }

/** 關掉所有連線（登出時） */
export function closeAllChatSockets(): void {
    pool.current.forEach((ws) => ws.disconnect())
    pool.current.clear()
}

// 登出（登入狀態從有變沒有）：連線全部關掉，下一位登入的人不會接到上一位的回答
useAuthStore.subscribe((state, previous) => {
    if (previous.isAuthenticated && !state.isAuthenticated) closeAllChatSockets()
})

export function useChatSocket() {
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

    return { isConnecting, connect, get, close }
}
