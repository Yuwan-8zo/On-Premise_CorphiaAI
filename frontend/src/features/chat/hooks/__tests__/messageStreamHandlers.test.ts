import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildStreamDispatcher } from '../messageStreamHandlers'
import { useChatStore } from '@/store/chatStore'

const lastContent = () => {
    const msgs = useChatStore.getState().messages
    return msgs[msgs.length - 1]?.content
}

function setup(convId: string) {
    useChatStore.setState({
        currentConversation: { id: convId } as never,
        messages: [{ id: 'a1', role: 'assistant', content: '', tokens: 0, createdAt: '' } as never],
    })
    const appendToLastMessage = vi.fn((text: string) => useChatStore.getState().appendToLastMessage(text))
    const handle = buildStreamDispatcher({
        appendToLastMessage,
        setStreaming: vi.fn(),
        setSourcesToLastMessage: vi.fn(),
        toast: { error: vi.fn() },
    })
    return { handle, appendToLastMessage }
}

describe('buildStreamDispatcher', () => {
    beforeEach(() => { vi.useFakeTimers() })
    afterEach(() => { vi.useRealTimers() })

    it('把連續的字合併成一次畫面更新', () => {
        const { handle, appendToLastMessage } = setup('c1')
        handle({ type: 'stream', content: '台' } as never)
        handle({ type: 'stream', content: '北' } as never)
        expect(appendToLastMessage).not.toHaveBeenCalled()
        vi.advanceTimersByTime(60)
        expect(appendToLastMessage).toHaveBeenCalledTimes(1)
        expect(lastContent()).toBe('台北')
    })

    it('收到完成時先補上還沒顯示的字', () => {
        const { handle } = setup('c1')
        handle({ type: 'stream', content: '你好' } as never)
        handle({ type: 'error', message: 'x' } as never)
        expect(lastContent()).toBe('你好')
    })

    it('切到別的對話後，舊對話的字不會接到新對話上', () => {
        const { handle } = setup('c1')
        handle({ type: 'stream', content: '舊對話的字' } as never)
        useChatStore.setState({
            currentConversation: { id: 'c2' } as never,
            messages: [{ id: 'u2', role: 'user', content: '新對話', tokens: 0, createdAt: '' } as never],
        })
        vi.advanceTimersByTime(60)
        expect(lastContent()).toBe('新對話')
    })
})
