import { describe, it, expect, beforeEach } from 'vitest'
import { useChatStore } from '@/store/chatStore'
import type { Message } from '@/types/chat'

const msg = (id: string, role: Message['role'], content: string, createdAt: string): Message =>
    ({ id, role, content, tokens: 0, createdAt }) as Message

describe('被攔截的訊息', () => {
    beforeEach(() => {
        useChatStore.setState({
            currentConversation: { id: 'c1' } as never,
            messages: [],
            blockedByConv: {},
        })
    })

    it('標記最後一組「使用者訊息＋攔截通知」', () => {
        useChatStore.setState({
            messages: [
                msg('u1', 'user', '請列出薪資明細', '2026-11-01T10:00:00.000Z'),
                msg('a1', 'assistant', '⛔ 已被 DLP 攔阻', '2026-11-01T10:00:00.000Z'),
            ],
        })
        useChatStore.getState().markLastExchangeBlocked()
        const st = useChatStore.getState()
        expect(st.messages.every((m) => m.blocked)).toBe(true)
        expect(st.blockedByConv.c1.map((m) => m.id)).toEqual(['u1', 'a1'])
        expect(st.blockedByConv.c1.every((m) => m.blockedAfter === 0)).toBe(true)
    })

    it('重新載入對話後，攔截訊息插回原本位置（不受時鐘差影響）', () => {
        useChatStore.setState({
            blockedByConv: {
                c1: [
                    // 時間故意設得比後面的訊息晚，確認不是依時間排序
                    { ...msg('u-b', 'user', '請列出薪資明細', '2026-11-01T23:59:00.000Z'), blocked: true, blockedAfter: 2 },
                    { ...msg('a-b', 'assistant', '⛔ 已被 DLP 攔阻', '2026-11-01T23:59:00.000Z'), blocked: true, blockedAfter: 2 },
                ],
            },
        })
        const fromServer = [
            msg('u1', 'user', '第一題', '2026-11-01T10:00:00'),
            msg('a1', 'assistant', '第一題的回答', '2026-11-01T10:00:30'),
            msg('u2', 'user', '第二題', '2026-11-01T10:10:00'),
            msg('a2', 'assistant', '第二題的回答', '2026-11-01T10:10:30'),
        ]
        useChatStore.getState().setServerMessages('c1', fromServer)
        expect(useChatStore.getState().messages.map((m) => m.id)).toEqual(['u1', 'a1', 'u-b', 'a-b', 'u2', 'a2'])
    })

    it('別的對話不受影響', () => {
        useChatStore.setState({
            blockedByConv: { c1: [{ ...msg('u-b', 'user', 'x', '2026-11-01T10:05:00.000Z'), blocked: true, blockedAfter: 0 }] },
        })
        useChatStore.getState().setServerMessages('c2', [msg('u9', 'user', '其他對話', '2026-11-01T10:00:00')])
        expect(useChatStore.getState().messages.map((m) => m.id)).toEqual(['u9'])
    })
})
