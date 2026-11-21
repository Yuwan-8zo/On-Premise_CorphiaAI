/**
 * 稽核細節：把一筆稽核紀錄的附加資料（details）翻成白話欄位
 * -------------------------------------------------------------
 * 後端各種事件存的欄位不一樣（DLP 命中存 kind／rule／category、登入失敗存 reason／remaining_attempts、
 * 產出檔案存 kind／size……），這裡依「欄位名稱＋事件種類」轉成「標籤：值」。
 *   - 空值（null、空字串、空陣列、空物件）直接不顯示
 *   - 認不得的欄位收進 raw，畫面上放在可展開的「原始資料」裡，不直接攤開
 *   - 長編號（UUID）只顯示前 8 碼，完整值放在 copy 讓使用者複製
 */
import type { TFunction } from 'i18next'

import type { AuditLogItem } from '@/api/auditLogs'
import { parseServerDate } from '@/lib/utils'
import i18n from '@/i18n'

export interface AuditField {
    key: string
    label: string
    value: string
    /** 有值時，畫面在這一列放「複製」鈕，複製的是完整內容（例如完整編號） */
    copy?: string
}

export interface AuditDetailView {
    fields: AuditField[]
    /** 認不得的欄位；沒有就是 null */
    raw: Record<string, unknown> | null
}

/** 顯示用的短編號長度（UUID 前 8 碼，和 git 短雜湊的習慣一樣） */
export const SHORT_ID_LENGTH = 8
const UUID_RE = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i
/** 不是 UUID、但長到不適合整串顯示的編號（例如圖片的 32 碼雜湊） */
const LONG_HEX_RE = /^[0-9a-f]{20,}$/i

const isEmpty = (v: unknown): boolean =>
    v === null ||
    v === undefined ||
    (typeof v === 'string' && v.trim() === '') ||
    (Array.isArray(v) && v.length === 0) ||
    (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0)

export const isLongId = (v: string): boolean => UUID_RE.test(v) || LONG_HEX_RE.test(v)

export const shortId = (v: string): string => (isLongId(v) ? v.replace(/-/g, '').slice(0, SHORT_ID_LENGTH) : v)

/** 位元組 → 「5.2 KB」 */
export function formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB']
    let n = bytes
    let i = 0
    while (n >= 1024 && i < units.length - 1) {
        n /= 1024
        i += 1
    }
    return `${i === 0 ? n : n.toFixed(1)} ${units[i]}`
}

/** 稽核細節的完整時間：年月日＋時分秒，跟著介面語言 */
export function formatFullDate(value?: string | null): string {
    if (!value) return ''
    return parseServerDate(value).toLocaleString(i18n.language || undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    })
}

/** 瀏覽器識別字串 → 「Chrome · Windows」；認不得就回傳空字串（畫面不顯示這一列） */
export function describeUserAgent(ua?: string | null): string {
    if (!ua || !ua.trim()) return ''
    const browser =
        /CorphiaDesktop|Electron/i.test(ua) ? 'Corphia Desktop'
        : /Edg\//.test(ua) ? 'Edge'
        : /OPR\//.test(ua) ? 'Opera'
        : /Firefox\//.test(ua) ? 'Firefox'
        : /Chrome\//.test(ua) ? 'Chrome'
        : /Safari\//.test(ua) ? 'Safari'
        : ''
    const os =
        /iPhone|iPad|iPod/.test(ua) ? 'iOS'
        : /Android/.test(ua) ? 'Android'
        : /Windows/.test(ua) ? 'Windows'
        : /Mac OS X|Macintosh/.test(ua) ? 'macOS'
        : /Linux/.test(ua) ? 'Linux'
        : ''
    if (browser || os) return [browser, os].filter(Boolean).join(' · ')
    // 程式呼叫（例如 python-httpx/0.27）：只留名稱
    return ua.split(/[\s/]/)[0] ?? ''
}

/** 本機位址加註「這台主機」 */
export function describeIp(t: TFunction, ip?: string | null): string {
    if (!ip) return ''
    return ['127.0.0.1', '::1', 'localhost'].includes(ip) ? t('admin.audit.detail.localhost', { ip }) : ip
}

type Formatted = Omit<AuditField, 'key'> | null
/** 回傳 null ＝ 不顯示；undefined ＝ 認不得，收進原始資料 */
type Formatter = (v: unknown, t: TFunction, action: string) => Formatted | undefined

const L = (t: TFunction, key: string) => t(`admin.audit.detail.fields.${key}`)
const V = (t: TFunction, key: string, opts?: Record<string, unknown>) => t(`admin.audit.detail.values.${key}`, opts ?? {})
/** 代碼翻譯：有翻譯用翻譯，沒有就顯示原文 */
const code = (t: TFunction, group: string, v: unknown) =>
    t(`admin.audit.detail.codes.${group}.${String(v)}`, { defaultValue: String(v) })
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
const list = (v: unknown): string[] | undefined =>
    Array.isArray(v) && v.every((x) => typeof x === 'string' || typeof x === 'number') ? v.map(String) : undefined
const yesNo = (t: TFunction, v: unknown) => (typeof v === 'boolean' ? V(t, v ? 'yes' : 'no') : undefined)

/** 純文字欄位 */
const text = (labelKey: string): Formatter => (v, t) =>
    typeof v === 'string' || typeof v === 'number' ? { label: L(t, labelKey), value: String(v) } : undefined
/** 數量欄位：「3 個」「15 分鐘」 */
const counted = (labelKey: string, unitKey: string, hideZero = false): Formatter => (v, t) => {
    const n = num(v) ?? list(v)?.length
    if (n === undefined) return undefined
    // 過濾報告的「0 段、0 個」是雜訊（描述已經寫了），不顯示；剩餘次數 0 之類有意義的照常顯示
    if (hideZero && n === 0) return null
    return { label: L(t, labelKey), value: V(t, unitKey, { count: n }) }
}
/** 清單欄位：用頓號串起來 */
const joined = (labelKey: string, group?: string): Formatter => (v, t) => {
    const items = list(v)
    if (!items) return undefined
    return { label: L(t, labelKey), value: items.map((x) => (group ? code(t, group, x) : x)).join(V(t, 'separator')) }
}
/** 編號欄位：只顯示短碼，可複製完整值 */
const idField = (labelKey: string): Formatter => (v, t) =>
    typeof v === 'string' ? { label: L(t, labelKey), value: shortId(v), copy: isLongId(v) ? v : undefined } : undefined

const FILE_ACTIONS = new Set(['file_create', 'file_download', 'file_open', 'file_save'])

const FORMATTERS: Record<string, Formatter> = {
    // ── 資安閘道：DLP 命中／注入攔截／個資遮罩 ──
    kind: (v, t, action) => {
        if (typeof v !== 'string') return undefined
        return FILE_ACTIONS.has(action)
            ? { label: L(t, 'fileType'), value: v.toUpperCase() }
            : { label: L(t, 'item'), value: v }
    },
    category: (v, t) => (typeof v === 'string' ? { label: L(t, 'category'), value: code(t, 'category', v) } : undefined),
    rule: (v, t) => (typeof v === 'string' ? { label: L(t, 'rule'), value: code(t, 'rule', v) } : undefined),
    matched_terms_count: counted('matchedTerms', 'terms'),
    method: text('method'),
    score: (v, t) => {
        const n = num(v)
        return n === undefined ? undefined : { label: L(t, 'score'), value: `${Math.round(n * 100)}%` }
    },
    risk_level: (v, t) => (typeof v === 'string' ? { label: L(t, 'riskLevel'), value: code(t, 'risk', v) } : undefined),
    matched_patterns: joined('matchedPatterns'),
    pii_types: (v, t) => {
        const items = list(v)
        if (!items) return undefined
        // 同一種出現多次合成「身分證字號 ×2」
        const counts = new Map<string, number>()
        items.forEach((x) => counts.set(x, (counts.get(x) ?? 0) + 1))
        const value = [...counts]
            .map(([k, n]) => (n > 1 ? `${code(t, 'pii', k)} ×${n}` : code(t, 'pii', k)))
            .join(V(t, 'separator'))
        return { label: L(t, 'piiTypes'), value }
    },

    // ── 登入 ──
    reason: text('reason'),
    remaining_attempts: counted('remainingAttempts', 'times'),
    is_locked: (v, t) => (typeof v === 'boolean' ? { label: L(t, 'locked'), value: V(t, v ? 'locked' : 'notLocked') } : undefined),
    minutes_remaining: counted('unlockIn', 'minutes'),
    target_user_email: text('targetUser'),
    updated_fields: joined('updatedFields', 'field'),

    // ── 文件、資料夾、檔案 ──
    folder: text('folder'),
    filename: text('fileName'),
    name: text('fileName'),
    keys: joined('changedItems', 'field'),
    size: (v, t) => {
        const n = num(v)
        return n === undefined ? undefined : { label: L(t, 'fileSize'), value: formatBytes(n) }
    },
    conversation_id: idField('conversation'),
    message_id: idField('message'),
    accepted: joined('acceptedFiles'),
    skipped: joined('skippedFiles'),
    // Office 程式名（word／excel）有翻譯；存檔時存的是副檔名（py、md），沒有翻譯就轉大寫
    app: (v, t) =>
        typeof v === 'string'
            ? { label: L(t, 'app'), value: t(`admin.audit.detail.codes.app.${v.toLowerCase()}`, { defaultValue: v.toUpperCase() }) }
            : undefined,
    chars: counted('length', 'chars'),
    length: counted('length', 'chars'),
    backup: (v, t) => (typeof v === 'boolean' ? { label: L(t, 'backup'), value: V(t, v ? 'backedUp' : 'notBackedUp') } : undefined),
    truncated: (v, t) => {
        const yn = yesNo(t, v)
        return yn === undefined ? undefined : { label: L(t, 'truncated'), value: yn }
    },
    scope: text('scope'),
    detail: text('result'),

    // ── 內容過濾 ──
    pii: counted('piiMasked', 'items', true),
    images: (v, t, action) => {
        const n = num(v) ?? list(v)?.length
        if (n === undefined) return undefined
        if (n === 0) return null
        return { label: L(t, action === 'output_filtered' ? 'externalImages' : 'images'), value: V(t, 'images', { count: n }) }
    },
    injection: counted('injection', 'segments', true),
    dlp: counted('dlpTerms', 'segments', true),
    injection_documents: joined('injectionDocuments'),
    dlp_documents: joined('dlpDocuments'),

    // ── 記憶、模型 ──
    source: (v, t) => (typeof v === 'string' ? { label: L(t, 'memorySource'), value: code(t, 'memorySource', v) } : undefined),
    enabled: (v, t) => (typeof v === 'boolean' ? { label: L(t, 'memory'), value: V(t, v ? 'on' : 'off') } : undefined),
    style: (v, t) =>
        typeof v === 'string'
            ? { label: L(t, 'style'), value: t(`settings.memory.style.${v}`, { defaultValue: v }) }
            : undefined,
    count: (v, t, action) => {
        const n = num(v)
        if (n === undefined) return undefined
        if (action === 'memory_clear') return { label: L(t, 'cleared'), value: V(t, 'memories', { count: n }) }
        if (action === 'model_refresh') return { label: L(t, 'modelsFound'), value: V(t, 'items', { count: n }) }
        return { label: L(t, 'count'), value: String(n) }
    },
    model: text('model'),

    // ── AI 工具、對外搜尋、公開網址 ──
    tool: (v, t) => (typeof v === 'string' ? { label: L(t, 'tool'), value: code(t, 'tool', v) } : undefined),
    ok: (v, t) => (typeof v === 'boolean' ? { label: L(t, 'result'), value: V(t, v ? 'success' : 'failure') } : undefined),
    query: text('query'),
    blocked: (v, t) => (typeof v === 'boolean' ? { label: L(t, 'result'), value: V(t, v ? 'blocked' : 'allowed') } : undefined),
    result_count: counted('resultCount', 'results'),
    result: (v, t) => (typeof v === 'string' ? { label: L(t, 'result'), value: code(t, 'result', v) } : undefined),
    public_url: text('publicUrl'),
    api_url: text('apiUrl'),

    // ── 資安閘道設定：{ 閘道代碼: 開/關 或 門檻 } ──
    changes: (v, t) => {
        if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined
        const parts = Object.entries(v as Record<string, unknown>).map(([k, val]) => {
            const name = t(`admin.security.gate.${k}.name`, { defaultValue: code(t, 'field', k) })
            const shown = typeof val === 'boolean' ? V(t, val ? 'on' : 'off') : String(val)
            return `${name}：${shown}`
        })
        return { label: L(t, 'changedItems'), value: parts.join(V(t, 'separator')) }
    },
}

/** tool_call 的 arguments 是一段 JSON 文字：拆出查詢內容／算式，其餘收進原始資料 */
function parseToolArguments(v: unknown): Record<string, unknown> | undefined {
    if (typeof v !== 'string') return undefined
    try {
        const parsed: unknown = JSON.parse(v)
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : undefined
    } catch {
        return undefined
    }
}

const ARGUMENT_FIELDS: Record<string, string> = { query: 'query', expression: 'expression' }

/** 顯示順序：先講「是什麼」（類別、項目、工具），再講「結果」；沒列在這裡的照後端存的順序排在後面 */
const ORDER = [
    'category', 'kind', 'rule', 'risk_level', 'matched_patterns', 'matched_terms_count', 'pii_types', 'method', 'score',
    'reason', 'is_locked', 'remaining_attempts', 'minutes_remaining',
    'tool', 'query', 'expression', 'ok', 'blocked', 'result_count',
]
const rank = (key: string) => {
    const i = ORDER.indexOf(key)
    return i === -1 ? ORDER.length : i
}

export function describeAuditDetails(t: TFunction, log: Pick<AuditLogItem, 'action' | 'details'>): AuditDetailView {
    const fields: AuditField[] = []
    const raw: Record<string, unknown> = {}
    const seen = new Set<string>()
    const push = (key: string, f: Formatted) => {
        // 兩個欄位翻成同一個標籤和值（例如 chars 和 length）只留一列
        if (!f || isEmpty(f.value) || seen.has(`${f.label}\u0000${f.value}`)) return
        seen.add(`${f.label}\u0000${f.value}`)
        fields.push({ key, ...f })
    }

    for (const [key, value] of Object.entries(log.details ?? {})) {
        if (isEmpty(value)) continue
        if (key === 'arguments') {
            const args = parseToolArguments(value)
            if (!args) {
                raw[key] = value
                continue
            }
            for (const [k, v] of Object.entries(args)) {
                if (isEmpty(v)) continue
                const labelKey = ARGUMENT_FIELDS[k]
                if (labelKey && (typeof v === 'string' || typeof v === 'number')) push(k, { label: L(t, labelKey), value: String(v) })
                else raw[k] = v
            }
            continue
        }
        const formatter = FORMATTERS[key]
        const formatted = formatter ? formatter(value, t, log.action) : undefined
        if (formatted === undefined) raw[key] = value
        else push(key, formatted)
    }
    // sort 是穩定排序：同一級的照原本順序
    fields.sort((a, b) => rank(a.key) - rank(b.key))
    return { fields, raw: Object.keys(raw).length ? raw : null }
}
