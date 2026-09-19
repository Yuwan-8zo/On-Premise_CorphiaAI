/** Mock Folders API */
import { DEMO_FOLDERS } from '../demo/mockData'

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

let folders = [...DEMO_FOLDERS]

export const foldersApi = {
    list: async () => {
        await sleep(200)
        return folders
    },
    create: async (name: string) => {
        await sleep(300)
        const f = { name, conversationCount: 0 }
        folders = [f, ...folders]
        return f
    },
    delete: async (name: string) => {
        await sleep(200)
        folders = folders.filter((f) => f.name !== name)
        return { success: true }
    },
}
