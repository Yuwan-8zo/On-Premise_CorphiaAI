/** Mock Users API */
import { DEMO_USERS } from '../demo/mockData'

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

export type CreateUserPayload = { email: string; name: string; password: string; role: string }
export type UpdateUserPayload = Partial<CreateUserPayload & { isActive: boolean }>

let users = [...DEMO_USERS]

export const usersApi = {
    list: async () => { await sleep(300); return { data: users, total: users.length } },
    listUsers: async (_params?: { page?: number; page_size?: number }) => {
        await sleep(300); return { data: users, total: users.length }
    },
    create: async (p: CreateUserPayload) => {
        await sleep(400)
        const u = { id: `user-${Date.now()}`, ...p, is_active: true, created_at: new Date().toISOString(), last_login_at: null }
        users = [...users, u]
        return u
    },
    createUser: async (p: CreateUserPayload) => {
        await sleep(400)
        const u = { id: `user-${Date.now()}`, ...p, is_active: true, created_at: new Date().toISOString(), last_login_at: null }
        users = [...users, u]
        return u
    },
    update: async (id: string, p: UpdateUserPayload) => {
        await sleep(300)
        users = users.map((u) => u.id === id ? { ...u, ...p } : u)
        return users.find((u) => u.id === id)
    },
    updateUser: async (id: string, p: UpdateUserPayload) => {
        await sleep(300)
        users = users.map((u) => u.id === id ? { ...u, ...p } : u)
        return users.find((u) => u.id === id)
    },
    delete: async (id: string) => {
        await sleep(300)
        users = users.filter((u) => u.id !== id)
        return { success: true }
    },
    deleteUser: async (id: string) => {
        await sleep(300)
        users = users.filter((u) => u.id !== id)
        return { success: true }
    },
    resetPassword: async (_id: string) => { await sleep(300); return { success: true } },
}
