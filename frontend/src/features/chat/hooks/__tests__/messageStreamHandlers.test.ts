import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildStreamDispatcher } from '../messageStreamHandlers'
import { useChatStore } from '@/store/chatStore'

const msg = (id: string, role: 'user' | 'assistant', content = '') => ({ id, role, content, tokens: 0, createdAt: '' }) as never
const lastContent = () => {
    const msgs = useChatStore.getState().messages
    return msgs[msgs.length - 1]?.content
}

/** 畫面上是 c1，c1 正在生成 */
function setup() {
    useChatStore.setState({
        currentConversation: { id: 'c1', title: '第一個' } as never,
        conversations: [{ id: 'c1', title: '第一個' }, { id: 'c2', title: '第二個' }] as never,
        messages: [msg('u1', 'user', '問題'), msg('a1', 'assistant')],
        threads: {},
        streamingIds: { c1: true },
        isStreaming: true,
    })
    return buildStreamDispatcher('c1')
}

describe('buildStreamDispatcher（每個對話一個）', () => {
    beforeEach(() => { vi.useFakeTimers() })
    afterEach(() => { vi.useRealTimers() })

    it('把連續的字合併成一次畫面更新', () => {
        const handle = setup()
        handle({ type: 'stream', content: '台' } as never)
        handle({ type: 'stream', content: '北' } as never)
        expect(lastContent()).toBe('')
        vi.advanceTimersByTime(60)
        expect(lastContent()).toBe('台北')
    })

    it('收到錯誤時先補上還沒顯示的字，並結束生成', () => {
        const handle = setup()
        handle({ type: 'stream', content: '你好' } as never)
        handle({ type: 'error', message: 'x' } as never)
        expect(lastContent()).toBe('你好')
        expect(useChatStore.getState().isStreaming).toBe(false)
    })

    it('切到別的對話後，原本的對話在背景繼續收字，切回來時接著顯示', () => {
        const handle = setup()
        handle({ type: 'stream', content: '背景' } as never)
        // 切到 c2：c1 還在生成，它的訊息收到背景
        useChatStore.getState().setCurrentConversation({ id: 'c2', title: '第二個' } as never)
        useChatStore.getState().setMessages([msg('u2', 'user', '新對話')])
        vi.advanceTimersByTime(60)
        handle({ type: 'stream', content: '繼續' } as never)
        vi.advanceTimersByTime(60)
        // 畫面上的 c2 不受影響
        expect(lastContent()).toBe('新對話')
        expect(useChatStore.getState().isStreaming).toBe(false)
        // 切回 c1：看到背景期間收到的字，也還在生成中
        useChatStore.getState().setCurrentConversation({ id: 'c1', title: '第一個' } as never)
        expect(lastContent()).toBe('背景繼續')
        expect(useChatStore.getState().isStreaming).toBe(true)
    })

    it('背景對話完成時結束它的生成，不影響畫面上的對話', () => {
        const handle = setup()
        useChatStore.getState().setCurrentConversation({ id: 'c2', title: '第二個' } as never)
        useChatStore.getState().setStreaming(true) // c2 也在生成
        handle({ type: 'done' } as never)
        const st = useChatStore.getState()
        expect(st.streamingIds.c1).toBeUndefined()
        expect(st.isStreaming).toBe(true)
        expect(st.threads.c1).toBeUndefined() // 背景完成：丟掉暫存，下次點開從後端載入
    })
})
