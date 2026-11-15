/**
 * 桌面版的橋：介面跑在「Corphia AI 桌面版」視窗裡時，可以請這台電腦上的小幫手操控 Word、Excel、PowerPoint
 * （小幫手在 desktop/corphia_desktop.py、desktop/office_bridge.py）
 *
 *   const isDesktop = useDesktop()          // 是不是在桌面版裡；瀏覽器、手機一律 false → 相關按鈕不顯示
 *   await desktop.read('word')              // 讀目前的內容（選取範圍或整份）
 *   await desktop.write('excel', markdown)  // 把回答寫進去
 *   await desktop.openFile(name, blob)      // 把 AI 產出的檔案存到「文件\Corphia AI 產出」並打開
 *   await desktop.saveFile(name, text)      // 把 AI 寫的程式碼／文字存成這台電腦的檔案（跳出另存新檔；取消回 null）
 *   await desktop.info() ／ desktop.update() // 版本、有沒有新版 ／ 更新（components/desktop/DesktopUpdateNotice 用）
 *
 * 失敗一律丟 Error（訊息是給使用者看的原因）。每個成功的動作都回報伺服器寫稽核（POST /desktop/events）。
 * 每個動作都要帶「這一頁的通行碼」：桌面版在伺服器的頁面載入完成時放在 window.__corphiaDesktop（換頁就作廢），
 * 別的網頁拿不到，所以叫不動小幫手。
 */
import { useEffect, useState } from 'react'
import apiClient from '@/api/client'

export type OfficeApp = 'word' | 'excel' | 'powerpoint'
export const OFFICE_APPS: readonly OfficeApp[] = ['word', 'excel', 'powerpoint']

interface BridgeResult {
    ok: boolean
    error?: string
}
export interface OfficeRead extends BridgeResult {
    app: OfficeApp
    name: string
    scope: 'selection' | 'document' | 'sheet' | 'presentation'
    text: string
    chars: number
    truncated: boolean
}
export interface OfficeWrite extends BridgeResult {
    app: OfficeApp
    name: string
    detail: string
    /** 改已存檔的文件前自動備份的位置；新文件或雲端文件沒有 */
    backup: string | null
}
interface OpenedFile extends BridgeResult {
    path: string
    name: string
}
export interface DesktopInfo extends BridgeResult {
    version: string
    trusted: boolean
    /** 伺服器上比較新的桌面版；沒有新版是 null */
    update: { version: string; size: number } | null
}
export interface SavedFile extends BridgeResult {
    path: string
    name: string
    chars: number
    /** 蓋掉已經存在的檔案時，舊檔的備份位置；新檔案是 null */
    backup: string | null
    /** 使用者在另存新檔視窗按了取消 */
    cancelled?: boolean
}
interface DesktopApi {
    info: (token: string) => Promise<DesktopInfo>
    update: (token: string) => Promise<BridgeResult & { version: string }>
    office_read: (token: string, app: OfficeApp) => Promise<OfficeRead>
    office_write: (token: string, app: OfficeApp, markdown: string) => Promise<OfficeWrite>
    open_file: (token: string, filename: string, dataB64: string) => Promise<OpenedFile>
    save_file: (token: string, filename: string, content: string) => Promise<SavedFile>
    /** 舊版桌面程式沒有這個方法 */
    note?: (text: string) => Promise<BridgeResult>
}
type DesktopWindow = { pywebview?: { api?: DesktopApi }; __corphiaDesktop?: string }

const bridge = (): DesktopApi | undefined => (window as unknown as DesktopWindow).pywebview?.api
/** 這一頁的通行碼（桌面版發的；還沒發是空字串，動作會被小幫手拒絕） */
const token = (): string => (window as unknown as DesktopWindow).__corphiaDesktop ?? ''

/** 是不是在桌面版裡（橋是視窗載入後才注入的，所以要等 pywebviewready） */
export function useDesktop(): boolean {
    const [ready, setReady] = useState(() => !!bridge())
    useEffect(() => {
        if (ready) return
        const on = () => setReady(!!bridge())
        window.addEventListener('pywebviewready', on)
        on()
        return () => window.removeEventListener('pywebviewready', on)
    }, [ready])
    return ready
}

/** 把介面這一側發生的事記到桌面版的記錄檔（查「按了沒反應」用）；記不了也不影響操作 */
function note(text: string): void {
    try {
        void bridge()?.note?.(text)?.catch(() => undefined)
    } catch {
        /* 記錄失敗不影響使用者的操作 */
    }
}

function unwrap<T extends BridgeResult>(result: T | undefined | null): T {
    if (!result) throw new Error('桌面版沒有回應')
    if (!result.ok) throw new Error(result.error || '操作失敗')
    return result
}

/** 回報伺服器寫稽核；失敗不影響使用者的操作 */
function report(action: 'office_read' | 'office_write' | 'file_open' | 'file_save', app: string, detail: Record<string, unknown>) {
    void apiClient.post('/desktop/events', { action, app, detail }).catch(() => undefined)
}

function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
        reader.onerror = () => reject(new Error('讀不到檔案內容'))
        reader.readAsDataURL(blob)
    })
}

/** 伺服器上的桌面版安裝檔（設定 › 關於 的下載入口用；不用登入就能查） */
export interface DesktopRelease {
    available: boolean
    version: string
    size?: number
}
export const desktopRelease = {
    latest: async (): Promise<DesktopRelease> => (await apiClient.get<DesktopRelease>('/desktop/latest')).data,
    /** 下載安裝檔的網址（同一台伺服器） */
    downloadUrl: (): string => `${apiClient.defaults.baseURL ?? ''}/desktop/download`,
}

export const desktop = {
    /** 桌面版的版本與有沒有新版 */
    info: async (): Promise<DesktopInfo> => unwrap(await bridge()?.info(token())),
    /** 下載新版並重新開啟（成功後視窗會自己關掉再開） */
    update: async () => unwrap(await bridge()?.update(token())),
    read: async (app: OfficeApp): Promise<OfficeRead> => {
        const r = unwrap(await bridge()?.office_read(token(), app))
        report('office_read', app, { name: r.name, scope: r.scope, chars: r.chars, truncated: r.truncated })
        return r
    },
    write: async (app: OfficeApp, markdown: string): Promise<OfficeWrite> => {
        const r = unwrap(await bridge()?.office_write(token(), app, markdown))
        report('office_write', app, { name: r.name, detail: r.detail, backup: !!r.backup })
        return r
    },
    openFile: async (filename: string, blob: Blob): Promise<OpenedFile> => {
        const r = unwrap(await bridge()?.open_file(token(), filename, await blobToBase64(blob)))
        report('file_open', filename.split('.').pop() || '', { name: r.name })
        return r
    },
    /** 存成這台電腦的檔案；使用者按取消回 null（不是錯誤） */
    saveFile: async (filename: string, content: string): Promise<SavedFile | null> => {
        note(`按了存檔：${filename}（橋 ${bridge() ? '有' : '沒有'}、save_file ${bridge()?.save_file ? '有' : '沒有'}、通行碼 ${token() ? '有' : '沒有'}）`)
        let raw: SavedFile | undefined
        try {
            raw = await bridge()?.save_file(token(), filename, content)
        } catch (err) {
            note(`呼叫存檔時出錯：${String(err)}`)
            throw err
        }
        note(`存檔的結果：${raw ? (raw.ok ? '成功' : raw.cancelled ? '取消' : `失敗（${raw.error}）`) : '沒有回應'}`)
        if (raw?.cancelled) return null
        const r = unwrap(raw)
        report('file_save', r.name.split('.').pop() || '', { name: r.name, chars: r.chars, backup: !!r.backup })
        return r
    },
}
