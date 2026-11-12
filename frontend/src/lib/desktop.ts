/**
 * 桌面版的橋：介面跑在「Corphia AI 桌面版」視窗裡時，可以請這台電腦上的小幫手操控 Word、Excel、PowerPoint
 * （小幫手在 desktop/corphia_desktop.py、desktop/office_bridge.py）
 *
 *   const isDesktop = useDesktop()          // 是不是在桌面版裡；瀏覽器、手機一律 false → 相關按鈕不顯示
 *   await desktop.read('word')              // 讀目前的內容（選取範圍或整份）
 *   await desktop.write('excel', markdown)  // 把回答寫進去
 *   await desktop.openFile(name, blob)      // 把 AI 產出的檔案存到「文件\Corphia AI 產出」並打開
 *   await desktop.info() ／ desktop.update() // 版本、有沒有新版 ／ 更新（components/desktop/DesktopUpdateNotice 用）
 *
 * 失敗一律丟 Error（訊息是給使用者看的原因）。每個成功的動作都回報伺服器寫稽核（POST /desktop/events）。
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
interface DesktopApi {
    info: () => Promise<DesktopInfo>
    update: () => Promise<BridgeResult & { version: string }>
    office_read: (app: OfficeApp) => Promise<OfficeRead>
    office_write: (app: OfficeApp, markdown: string) => Promise<OfficeWrite>
    open_file: (filename: string, dataB64: string) => Promise<OpenedFile>
}

const bridge = (): DesktopApi | undefined => (window as unknown as { pywebview?: { api?: DesktopApi } }).pywebview?.api

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

function unwrap<T extends BridgeResult>(result: T | undefined | null): T {
    if (!result) throw new Error('桌面版沒有回應')
    if (!result.ok) throw new Error(result.error || '操作失敗')
    return result
}

/** 回報伺服器寫稽核；失敗不影響使用者的操作 */
function report(action: 'office_read' | 'office_write' | 'file_open', app: string, detail: Record<string, unknown>) {
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

export const desktop = {
    /** 桌面版的版本與有沒有新版 */
    info: async (): Promise<DesktopInfo> => unwrap(await bridge()?.info()),
    /** 下載新版並重新開啟（成功後視窗會自己關掉再開） */
    update: async () => unwrap(await bridge()?.update()),
    read: async (app: OfficeApp): Promise<OfficeRead> => {
        const r = unwrap(await bridge()?.office_read(app))
        report('office_read', app, { name: r.name, scope: r.scope, chars: r.chars, truncated: r.truncated })
        return r
    },
    write: async (app: OfficeApp, markdown: string): Promise<OfficeWrite> => {
        const r = unwrap(await bridge()?.office_write(app, markdown))
        report('office_write', app, { name: r.name, detail: r.detail, backup: !!r.backup })
        return r
    },
    openFile: async (filename: string, blob: Blob): Promise<OpenedFile> => {
        const r = unwrap(await bridge()?.open_file(filename, await blobToBase64(blob)))
        report('file_open', filename.split('.').pop() || '', { name: r.name })
        return r
    },
}
