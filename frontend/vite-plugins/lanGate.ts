/**
 * lanGate — 區域網路開關即時生效（不用重啟）
 *
 * 前端伺服器一律聽所有網路介面（0.0.0.0），由這裡在門口檢查：
 *   - 本機連線（127.0.0.1、::1）一律放行
 *   - 其他裝置的連線：讀 .runtime/lan.json，區網開啟才放行；關閉時網頁回 403、WebSocket 直接斷線
 * 後端固定只聽 127.0.0.1，區網裝置都經由這個前端伺服器轉送（/api、/ws），所以只要這裡擋住就完全擋住。
 * 管理後台切換開關時，後端改寫 lan.json，這裡下一個請求就會讀到新值。
 */
import fs from 'node:fs'
import type { IncomingMessage } from 'node:http'
import path from 'node:path'
import type { Plugin } from 'vite'

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

export default function lanGate(runtimeDir: string): Plugin {
    const file = path.join(runtimeDir, 'lan.json')
    // 最多每 REREAD_MS 重讀一次設定（不看修改時間：Windows 的修改時間只精確到秒，一秒內連續切換會讀不到）
    const REREAD_MS = 300
    let cache = { at: 0, enabled: false }

    const lanEnabled = () => {
        const now = Date.now()
        if (now - cache.at < REREAD_MS) return cache.enabled
        let enabled = false // 沒有設定檔或讀不到＝只允許本機
        try {
            enabled = Boolean(JSON.parse(fs.readFileSync(file, 'utf-8')).lan_enabled)
        } catch {
            enabled = false
        }
        cache = { at: now, enabled }
        return enabled
    }
    const allowed = (req: IncomingMessage) => LOOPBACK.has(req.socket.remoteAddress ?? '') || lanEnabled()

    const blockedPage = `<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>區域網路未開啟</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#000;color:#fff;font-family:system-ui,'Noto Sans TC',sans-serif;text-align:center;padding:24px">
<div><h1 style="font-size:22px;margin:0 0 8px">區域網路未開啟</h1><p style="margin:0;color:#b6b6c0;font-size:15px">請在主機的管理後台開啟「區域網路」後，再重新整理這一頁。</p></div></body></html>`

    return {
        name: 'corphia-lan-gate',
        configureServer(server) {
            // 直接掛在最前面：比內建的代理（/api、/ws）和頁面更早檢查
            server.middlewares.use((req, res, next) => {
                if (allowed(req)) return next()
                res.statusCode = 403
                res.setHeader('Content-Type', 'text/html; charset=utf-8')
                res.end(blockedPage)
            })
            // WebSocket（/ws 聊天、熱更新）：在事件發出前就攔下，後面的轉送程式不會碰到被斷開的連線
            const http = server.httpServer
            if (http) {
                const emit = http.emit.bind(http)
                http.emit = ((event: string, ...args: unknown[]) => {
                    if (event === 'upgrade' && !allowed(args[0] as IncomingMessage)) {
                        ;(args[1] as { destroy: () => void }).destroy()
                        return true
                    }
                    return emit(event, ...args)
                }) as typeof http.emit
            }
        },
    }
}
