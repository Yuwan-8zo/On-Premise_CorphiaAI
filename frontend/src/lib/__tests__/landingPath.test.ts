/**
 * 整頁骨架要畫「載入完真的會看到的那一頁」，不能 A 頁顯示 B 頁的骨架
 */
import { afterEach, describe, expect, it } from 'vitest'
import { landingPath } from '@/lib/landingPath'
import { pageKind } from '@/lib/layoutSnapshot'
import { useAuthStore } from '@/store/authStore'
import type { User } from '@/types/auth'

const signIn = (role: User['role'] | null) =>
    useAuthStore.setState(
        role
            ? { isAuthenticated: true, user: { id: 'u1', role } as User }
            : { isAuthenticated: false, user: null },
    )

afterEach(() => signIn(null))

describe('landingPath：和路由的導向規則一致', () => {
    it('沒登入：受保護的頁面都會被帶到登入頁', () => {
        signIn(null)
        for (const p of ['/', '/chat', '/chat/abc', '/admin']) expect(landingPath(p)).toBe('/login')
    })

    it('已登入：登入頁、舊的註冊網址會被帶回首頁', () => {
        signIn('user')
        expect(landingPath('/login')).toBe('/')
        expect(landingPath('/register')).toBe('/')
    })

    it('沒登入：舊的註冊網址畫登入頁', () => {
        signIn(null)
        expect(landingPath('/register')).toBe('/login')
    })

    it('一般使用者打開後台會被帶回首頁；管理員、工程師留在後台', () => {
        signIn('user')
        expect(landingPath('/admin')).toBe('/')
        signIn('admin')
        expect(landingPath('/admin')).toBe('/admin')
        signIn('engineer')
        expect(landingPath('/admin')).toBe('/admin')
    })

    it('分享頁不用登入，留在原頁', () => {
        signIn(null)
        expect(landingPath('/share/xyz')).toBe('/share/xyz')
    })
})

describe('pageKind：每個對話各記一份版面', () => {
    it('不同對話、不同分享連結不共用', () => {
        expect(pageKind('/chat/a')).not.toBe(pageKind('/chat/b'))
        expect(pageKind('/share/a')).not.toBe(pageKind('/share/b'))
    })

    it('首頁與 /chat 是同一頁；不認得的網址不記', () => {
        expect(pageKind('/')).toBe(pageKind('/chat'))
        expect(pageKind('/nope')).toBe('')
    })
})
