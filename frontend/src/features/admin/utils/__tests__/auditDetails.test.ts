import { beforeAll, describe, expect, it } from 'vitest'

import i18n from '@/i18n'
import {
    describeAuditDetails,
    describeIp,
    describeUserAgent,
    formatBytes,
    shortId,
} from '../auditDetails'

const t = i18n.t.bind(i18n)
const view = (action: string, details: Record<string, unknown>) => describeAuditDetails(t, { action, details })
const asMap = (action: string, details: Record<string, unknown>) =>
    Object.fromEntries(view(action, details).fields.map((f) => [f.label, f.value]))

beforeAll(async () => {
    await i18n.changeLanguage('zh-TW')
})

describe('describeAuditDetails：附加資料翻成白話欄位', () => {
    it('DLP 命中（索取他人個資）', () => {
        const v = view('dlp_hit', { kind: '身分證字號', rule: 'sensitive_request', category: 'personal' })
        expect(Object.fromEntries(v.fields.map((f) => [f.label, f.value]))).toEqual({
            項目: '身分證字號',
            觸發規則: '指名索取敏感資料',
            類別: '個人資料',
        })
        expect(v.raw).toBeNull()
    })

    it('DLP 違禁詞、語意檢查', () => {
        expect(asMap('dlp_hit', { matched_terms_count: 2 })).toEqual({ 命中違禁詞: '2 個' })
        expect(asMap('dlp_hit', { method: '模型複查', score: 0.525 })).toEqual({ 判斷方式: '模型複查', 可疑程度: '53%' })
    })

    it('注入攔截與個資遮罩', () => {
        expect(asMap('prompt_injection_blocked', { risk_level: 'high', matched_patterns: ['系統提示洩漏(中文)', 'Markdown圖片注入'] })).toEqual({
            風險等級: '高',
            符合的攻擊手法: '系統提示洩漏(中文)、Markdown圖片注入',
        })
        expect(asMap('pii_detected', { pii_types: ['tw_national_id', 'tw_national_id', 'email'] })).toEqual({
            個資種類: '身分證字號 ×2、電子郵件',
        })
    })

    it('登入失敗', () => {
        expect(asMap('login_failed', { reason: '帳號或密碼錯誤', is_locked: false, remaining_attempts: 4 })).toEqual({
            原因: '帳號或密碼錯誤',
            帳號狀態: '未鎖定',
            剩餘嘗試次數: '4 次',
        })
    })

    it('產出檔案：類型大寫、大小換單位、對話只露短編號可複製', () => {
        const v = view('file_create', { kind: 'xlsx', size: 5372, conversation_id: '5a48a58b-4bdb-486c-9d39-181e9cf7e2c5' })
        expect(v.fields.map((f) => [f.label, f.value])).toEqual([
            ['檔案類型', 'XLSX'],
            ['檔案大小', '5.2 KB'],
            ['所屬對話', '5a48a58b'],
        ])
        expect(v.fields[2].copy).toBe('5a48a58b-4bdb-486c-9d39-181e9cf7e2c5')
    })

    it('空值不顯示，也不進原始資料', () => {
        const v = view('browser_folder_attach', { pii: 0, skipped: [], accepted: ['a.txt', 'b.txt'] })
        expect(v.fields.map((f) => [f.label, f.value])).toEqual([['附上的檔案', 'a.txt、b.txt']])
        expect(v.raw).toBeNull()
        expect(view('login_success', {}).fields).toEqual([])
    })

    it('工具呼叫：拆出查詢內容，空參數不顯示', () => {
        expect(asMap('tool_call', { ok: true, tool: 'web_search', arguments: '{"query":"地端 AI"}' })).toEqual({
            結果: '成功',
            工具: '對外搜尋',
            查詢內容: '地端 AI',
        })
        expect(asMap('tool_call', { ok: true, tool: 'current_time', arguments: '{}' })).toEqual({ 結果: '成功', 工具: '查詢目前時間' })
    })

    it('資安閘道設定：閘道名稱＋開關', () => {
        expect(asMap('security_setting_update', { changes: { dlp: false, semantic_block: 0.8 } })).toEqual({
            變更項目: '機密字詞攔截：關閉、直接攔阻門檻：0.8',
        })
    })

    it('認不得的欄位收進原始資料', () => {
        const v = view('dlp_hit', { kind: '生日', something_new: { a: 1 } })
        expect(v.fields).toHaveLength(1)
        expect(v.raw).toEqual({ something_new: { a: 1 } })
    })
})

describe('小工具', () => {
    it('短編號', () => {
        expect(shortId('ff8f09df-54a6-4944-bc16-7bd2871c560b')).toBe('ff8f09df')
        expect(shortId('919efcef9cd94dab9ddd91dc06ce7134')).toBe('919efcef')
        expect(shortId('security_gates')).toBe('security_gates')
    })

    it('檔案大小', () => {
        expect(formatBytes(512)).toBe('512 B')
        expect(formatBytes(37458)).toBe('36.6 KB')
    })

    it('裝置／瀏覽器', () => {
        expect(
            describeUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'),
        ).toBe('Chrome · Windows')
        expect(
            describeUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'),
        ).toBe('Safari · iOS')
        expect(describeUserAgent('python-httpx/0.27.0')).toBe('python-httpx')
        expect(describeUserAgent(null)).toBe('')
    })

    it('本機 IP 加註', () => {
        expect(describeIp(t, '127.0.0.1')).toBe('127.0.0.1（這台主機）')
        expect(describeIp(t, '192.168.1.5')).toBe('192.168.1.5')
        expect(describeIp(t, null)).toBe('')
    })
})
