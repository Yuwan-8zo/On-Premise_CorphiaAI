/**
 * 聊天連線池：離開聊天頁不斷線（回答在背景繼續），登出才全部關掉
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

interface FakeSocket { id: string; readonly isConnected: boolean; connect: () => Promise<void>; disconnect: ReturnType<typeof vi.fn>; onMessage: () => void }
const sockets: FakeSocket[] = []
vi.mock('@/api/websocket', () => ({
  createChatWebSocket: (id: string) => {
    let connected = false
    const disconnect = vi.fn()
    const ws: FakeSocket = {
      id,
      get isConnected() { return connected && disconnect.mock.calls.length === 0 },
      connect: async () => { connected = true },
      disconnect,
      onMessage: () => {},
    }
    sockets.push(ws)
    return ws
  },
}))
vi.mock('../messageStreamHandlers', () => ({ buildStreamDispatcher: () => () => {} }))

import { closeAllChatSockets, useChatSocket } from '@/features/chat/hooks/useChatSocket'
import { useAuthStore } from '@/store/authStore'
import { useChatStore } from '@/store/chatStore'

const USER = { id: 'u1', email: 'a@b.c', name: 'A', role: 'user' } as never

beforeEach(() => {
  closeAllChatSockets()
  sockets.length = 0
  useChatStore.setState({ streamingIds: {}, currentConversation: null })
  useAuthStore.getState().setAuth(USER, 'token', 'refresh')
})

describe('useChatSocket', () => {
  it('離開聊天頁（元件卸載）不斷線；回來拿到的是同一條連線', async () => {
    const first = renderHook(() => useChatSocket())
    await act(async () => { await first.result.current.connect('c1') })
    useChatStore.setState({ streamingIds: { c1: true } })
    first.unmount()
    expect(sockets[0].disconnect).not.toHaveBeenCalled()

    const second = renderHook(() => useChatSocket())
    expect(second.result.current.get('c1')).toBe(sockets[0])
    await act(async () => { await second.result.current.connect('c1') })
    expect(sockets).toHaveLength(1)
  })

  it('登出：所有連線都關掉', async () => {
    const { result } = renderHook(() => useChatSocket())
    await act(async () => { await result.current.connect('c1') })
    act(() => useAuthStore.getState().clearAuth())
    expect(sockets[0].disconnect).toHaveBeenCalled()
    expect(result.current.get('c1')).toBeUndefined()
  })

  it('開新連線時關掉閒置的（不在畫面上、也沒在生成），生成中的留著', async () => {
    const { result } = renderHook(() => useChatSocket())
    await act(async () => { await result.current.connect('busy') })
    useChatStore.setState({ streamingIds: { busy: true } })
    await act(async () => { await result.current.connect('idle') })
    await act(async () => { await result.current.connect('c3') })
    expect(sockets.find((s) => s.id === 'idle')?.disconnect).toHaveBeenCalled()
    expect(sockets.find((s) => s.id === 'busy')?.disconnect).not.toHaveBeenCalled()
  })
})
