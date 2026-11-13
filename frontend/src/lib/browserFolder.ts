/**
 * 瀏覽器臨時資料夾：讀取使用者用 File System Access API 選的資料夾（這台電腦的，不是伺服器的）
 *
 * 只有 Chromium 系瀏覽器（Chrome、Edge）支援 showDirectoryPicker；不支援的瀏覽器／手機偵測到就不顯示按鈕，
 * 不另外顯示「這個瀏覽器不支援」的錯誤（功能本來就看不到，不用額外提示）。
 *
 * 這裡只做「挑出要上傳的檔案」，篩選只是為了使用者體驗好（選到不支援的格式、太大的資料夾馬上就知道），
 * 真正會不會被接受以伺服器的檢查為準（見 api/browserFolder.ts、backend/app/services/browser_folder.py）。
 */
import { UPLOAD_ACCEPT } from './uploadTypes'

/** 和後端 settings.browser_folder_* 的預設值一致；只是前端先擋一次，伺服器才是真正的上限 */
export const BROWSER_FOLDER_MAX_FILES = 40
export const BROWSER_FOLDER_MAX_TOTAL_MB = 50

const ALLOWED_EXTS = new Set(UPLOAD_ACCEPT.split(','))

interface DirectoryPickerWindow {
    showDirectoryPicker?: (options?: { id?: string }) => Promise<FileSystemDirectoryHandle>
}

export function supportsFolderPicker(): boolean {
    return typeof window !== 'undefined' && typeof (window as unknown as DirectoryPickerWindow).showDirectoryPicker === 'function'
}

export interface PickedFolder {
    name: string
    files: File[]
    /** 資料夾裡有、但沒被選進 files 的原因（太多檔案、不支援的格式只在這裡算數量，不逐一列出） */
    tooManyFiles: boolean
}

function extOf(filename: string): string {
    const i = filename.lastIndexOf('.')
    return i === -1 ? '' : filename.slice(i).toLowerCase()
}

async function* walk(dir: FileSystemDirectoryHandle, prefix: string): AsyncGenerator<File> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for await (const [name, handle] of (dir as any).entries() as AsyncIterable<[string, FileSystemHandle]>) {
        if (name.startsWith('.')) continue // 隱藏檔、.git 之類的設定資料夾
        if (handle.kind === 'file') {
            const file = await (handle as FileSystemFileHandle).getFile()
            // webkitRelativePath 是唯讀的，用這個方式附加一份「資料夾內的相對路徑」給後端顯示用
            Object.defineProperty(file, 'webkitRelativePath', { value: `${prefix}${name}`, configurable: true })
            yield file
        } else {
            yield* walk(handle as FileSystemDirectoryHandle, `${prefix}${name}/`)
        }
    }
}

/**
 * 開啟資料夾選取器 → 走訪資料夾（含子資料夾）→ 篩出支援格式、數量上限內的檔案。
 * 使用者在選取器按「取消」：瀏覽器會丟一個 AbortError，這裡直接讓它往外丟，呼叫端接到就當作沒選。
 */
export async function pickFolder(): Promise<PickedFolder> {
    const picker = (window as unknown as DirectoryPickerWindow).showDirectoryPicker
    if (!picker) throw new Error('這個瀏覽器不支援選取資料夾')
    const handle = await picker({ id: 'corphia-browser-folder' })

    const files: File[] = []
    let totalBytes = 0
    let tooManyFiles = false
    for await (const file of walk(handle, '')) {
        if (!ALLOWED_EXTS.has(extOf(file.name))) continue
        if (files.length >= BROWSER_FOLDER_MAX_FILES || totalBytes + file.size > BROWSER_FOLDER_MAX_TOTAL_MB * 1024 * 1024) {
            tooManyFiles = true
            break
        }
        files.push(file)
        totalBytes += file.size
    }
    return { name: handle.name, files, tooManyFiles }
}
