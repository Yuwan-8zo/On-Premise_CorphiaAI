/**
 * 附加檔案的本機副本：讓右側面板「你附加的檔案」點得開
 *
 *   伺服器刻意不保留附件內容（只給那一則訊息使用、用完就丟），所以原檔只留在「這台電腦的這個瀏覽器」裡（IndexedDB），
 *   不會上傳、不會同步到別台電腦；換瀏覽器、清除網站資料就沒有了（面板會說明）。
 *   依對話分開存；總量超過上限時從最舊的開始刪。
 */

const DB_NAME = 'corphia-attachments'
const STORE = 'files'
const DB_VERSION = 1
/** 這個瀏覽器最多留多少附件原檔（位元組） */
const MAX_TOTAL_BYTES = 200 * 1024 * 1024

interface CachedFile {
    key: string
    conversationId: string
    name: string
    type: string
    size: number
    savedAt: number
    blob: Blob
}

function openDb(): Promise<IDBDatabase | null> {
    return new Promise((resolve) => {
        try {
            if (typeof indexedDB === 'undefined') return resolve(null)
            const req = indexedDB.open(DB_NAME, DB_VERSION)
            req.onupgradeneeded = () => {
                const db = req.result
                if (!db.objectStoreNames.contains(STORE)) {
                    const store = db.createObjectStore(STORE, { keyPath: 'key' })
                    store.createIndex('conversationId', 'conversationId')
                    store.createIndex('savedAt', 'savedAt')
                }
            }
            req.onsuccess = () => resolve(req.result)
            req.onerror = () => resolve(null)
        } catch {
            resolve(null) // 無痕模式、被封鎖：就是沒有本機副本
        }
    })
}

const keyOf = (conversationId: string, name: string) => `${conversationId}/${name}`

function done(tx: IDBTransaction): Promise<void> {
    return new Promise((resolve) => {
        tx.oncomplete = () => resolve()
        tx.onerror = () => resolve()
        tx.onabort = () => resolve()
    })
}

/** 存這一批附加的檔案（同名覆蓋）；失敗就算了，不影響附加本身 */
export async function saveAttachments(conversationId: string, files: File[]): Promise<void> {
    const db = await openDb()
    if (!db || files.length === 0) return
    try {
        const tx = db.transaction(STORE, 'readwrite')
        const store = tx.objectStore(STORE)
        const now = Date.now()
        files.forEach((f, i) => store.put({
            key: keyOf(conversationId, f.name), conversationId, name: f.name, type: f.type, size: f.size, savedAt: now + i, blob: f,
        } satisfies CachedFile))
        await done(tx)
        await trim(db)
    } catch {
        // 空間不足等：沒有本機副本而已
    } finally {
        db.close()
    }
}

/** 總量超過上限：從最舊的刪起 */
async function trim(db: IDBDatabase): Promise<void> {
    const all = await new Promise<CachedFile[]>((resolve) => {
        const req = db.transaction(STORE).objectStore(STORE).index('savedAt').getAll()
        req.onsuccess = () => resolve(req.result as CachedFile[])
        req.onerror = () => resolve([])
    })
    let total = all.reduce((sum, f) => sum + f.size, 0)
    if (total <= MAX_TOTAL_BYTES) return
    const tx = db.transaction(STORE, 'readwrite')
    for (const f of all) {
        if (total <= MAX_TOTAL_BYTES) break
        tx.objectStore(STORE).delete(f.key)
        total -= f.size
    }
    await done(tx)
}

/** 這個對話在這個瀏覽器裡留著的所有附件原檔 */
export async function loadAttachments(conversationId: string): Promise<File[]> {
    const db = await openDb()
    if (!db) return []
    try {
        const rows = await new Promise<CachedFile[]>((resolve) => {
            const req = db.transaction(STORE).objectStore(STORE).index('conversationId').getAll(conversationId)
            req.onsuccess = () => resolve(req.result as CachedFile[])
            req.onerror = () => resolve([])
        })
        return rows.map((r) => new File([r.blob], r.name, { type: r.type }))
    } finally {
        db.close()
    }
}
