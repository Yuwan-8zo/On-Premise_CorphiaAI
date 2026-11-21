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
// 依序比對，先符合的先用（Edge、Opera 的字串裡也有 Chrome，所以排在前面）
const BROWSERS: Array<[RegExp, string]> = [
    [/CorphiaDesktop|Electron/i, 'Corphia Desktop'],
    [/Edg\//, 'Edge'],
    [/OPR\//, 'Opera'],
    [/Firefox\//, 'Firefox'],
    [/Chrome\//, 'Chrome'],
    [/Safari\//, 'Safari'],
]
const SYSTEMS: Array<[RegExp, string]> = [
    [/iPhone|iPad|iPod/, 'iOS'],
    [/Android/, 'Android'],
    [/Windows/, 'Windows'],
    [/Mac OS X|Macintosh/, 'macOS'],
    [/Linux/, 'Linux'],
]
const firstMatch = (table: Array<[RegExp, string]>, s: string) => table.find(([re]) => re.test(s))?.[1] ?? ''

export function describeUserAgent(ua?: string | null): string {
    if (!ua?.trim()) return ''
    const browser = firstMatch(BROWSERS, ua)
    const os = firstMatch(SYSTEMS, ua)
    if (browser || os) return [browser, os].filter(Boolean).join(' · ')
    // 程式呼叫（例如 python-httpx/0.27）：只留名稱
    return ua.split(/[\s/]/)[0] ?? ''
}

/** 本機位址加註「這台主機」 */
/** 本機自己連自己的位址（::1 是 IPv6 的寫法，一般人看不懂） */
const LOCAL_IPS = new Set(['127.0.0.1', '::1', 'localhost'])

export function describeIp(t: TFunction, ip?: string | null): string {
    if (!ip) return ''
    return LOCAL_IPS.has(ip) ? t('admin.audit.detail.localhost', { ip }) : ip
}

/** 表格用的短寫法：本機直接寫「本機」，其他照原樣 */
export function shortIp(t: TFunction, ip?: string | null): string {
    if (!ip) return '-'
    return LOCAL_IPS.has(ip) ? t('admin.audit.localhostShort') : ip
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
/** 布林值 → 兩個翻譯之一；不是布林值回傳 undefined */
const pick = (t: TFunction, v: unknown, whenTrue: string, whenFalse: string) => {
    if (typeof v !== 'boolean') return undefined
    return V(t, v ? whenTrue : whenFalse)
}
const yesNo = (t: TFunction, v: unknown) => pick(t, v, 'yes', 'no')

/** 布林欄位：「已鎖定／未鎖定」這類兩個值 */
const boolField = (labelKey: string, whenTrue: string, whenFalse: string): Formatter => (v, t) => {
    const value = pick(t, v, whenTrue, whenFalse)
    return value === undefined ? undefined : { label: L(t, labelKey), value }
}
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
const idField = (labelKey: string): Formatter => (v, t) => {
    if (typeof v !== 'string') return undefined
    const copy = isLongId(v) ? v : undefined
    return { label: L(t, labelKey), value: shortId(v), copy }
}

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
    is_locked: boolField('locked', 'locked', 'notLocked'),
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
    backup: boolField('backup', 'backedUp', 'notBackedUp'),
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
    enabled: boolField('memory', 'on', 'off'),
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
    ok: boolField('result', 'success', 'failure'),
    query: text('query'),
    blocked: boolField('result', 'blocked', 'allowed'),
    result_count: counted('resultCount', 'results'),
    result: (v, t) => (typeof v === 'string' ? { label: L(t, 'result'), value: code(t, 'result', v) } : undefined),
    public_url: text('publicUrl'),
    api_url: text('apiUrl'),

    // ── 資安閘道設定：{ 閘道代碼: 開/關 或 門檻 } ──
    changes: (v, t) => {
        if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined
        const parts = Object.entries(v as Record<string, unknown>).map(([k, val]) => {
            const name = t(`admin.security.gate.${k}.name`, { defaultValue: code(t, 'field', k) })
            const shown = pick(t, val, 'on', 'off') ?? String(val)
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

/** 收集欄位：去掉重複列，認不得的放進 raw */
class FieldCollector {
    readonly fields: AuditField[] = []
    readonly raw: Record<string, unknown> = {}
    private readonly seen = new Set<string>()

    push(key: string, f: Formatted) {
        if (!f || isEmpty(f.value)) return
        // 兩個欄位翻成同一個標籤和值（例如 chars 和 length）只留一列
        const id = `${f.label}\u0000${f.value}`
        if (this.seen.has(id)) return
        this.seen.add(id)
        this.fields.push({ key, ...f })
    }
}

/** tool_call 的參數：查詢內容／算式翻成欄位，其他收進原始資料 */
function collectArguments(t: TFunction, out: FieldCollector, value: unknown) {
    const args = parseToolArguments(value)
    if (!args) {
        out.raw.arguments = value
        return
    }
    for (const [k, v] of Object.entries(args)) {
        if (isEmpty(v)) continue
        const labelKey = ARGUMENT_FIELDS[k]
        const scalar = typeof v === 'string' || typeof v === 'number'
        if (labelKey && scalar) out.push(k, { label: L(t, labelKey), value: String(v) })
        else out.raw[k] = v
    }
}

export function describeAuditDetails(t: TFunction, log: Pick<AuditLogItem, 'action' | 'details'>): AuditDetailView {
    const out = new FieldCollector()
    for (const [key, value] of Object.entries(log.details ?? {})) {
        if (isEmpty(value)) continue
        if (key === 'arguments') {
            collectArguments(t, out, value)
            continue
        }
        const formatted = FORMATTERS[key]?.(value, t, log.action)
        if (formatted === undefined) out.raw[key] = value
        else out.push(key, formatted)
    }
    // sort 是穩定排序：同一級的照原本順序
    const fields = [...out.fields].sort((a, b) => rank(a.key) - rank(b.key))
    return { fields, raw: Object.keys(out.raw).length ? out.raw : null }
}
