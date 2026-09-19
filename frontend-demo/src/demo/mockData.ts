/**
 * Demo Mode — 所有模擬資料
 * 根據專題計畫書（中小企業導入地端AI系統之資安維護實作）整理。
 */

import type { Conversation, Message, MessageSource } from '@/types/chat'

export const DEMO_USER = {
    id: 'demo-user-001',
    name: '王小明',
    email: 'demo@corp.ai',
    role: 'user' as const,
    isActive: true,
    createdAt: '2026-09-19T08:00:00.000Z',
}

export const DEMO_MODELS = [
    { name: 'qwen2.5-7b-instruct-q4_k_m', display_name: 'Qwen2.5-7B (CPU)', size_gb: 4.4, is_loaded: true, context_length: 32768, description: '純 CPU 推論，9.62 tok/s' },
    { name: 'qwen2.5-3b-instruct-q4_k_m', display_name: 'Qwen2.5-3B (CPU)', size_gb: 2.0, is_loaded: false, context_length: 32768, description: '輕量模型，23.57 tok/s' },
    { name: 'qwen2.5-14b-instruct-q4_k_m', display_name: 'Qwen2.5-14B (CPU)', size_gb: 8.9, is_loaded: false, context_length: 32768, description: '高品質模型，4.14 tok/s' },
    { name: 'qwen2.5-7b-instruct-gpu', display_name: 'Qwen2.5-7B (GPU)', size_gb: 4.4, is_loaded: false, context_length: 32768, description: 'GPU 加速，37.30 tok/s' },
]

export const DEMO_CONVERSATIONS: Conversation[] = [
    {
        id: 'demo-conv-001',
        title: '本系統如何保護企業敏感資料？',
        model: 'qwen2.5-7b-instruct-q4_k_m',
        messageCount: 2,
        totalTokens: 312,
        isPinned: false,
        isArchived: false,
        settings: { isProject: true, folderName: '資安專題' },
        createdAt: '2026-09-19T21:30:00.000Z',
        updatedAt: '2026-09-19T21:35:00.000Z',
    },
    {
        id: 'demo-conv-002',
        title: '測試資安功能',
        model: 'qwen2.5-7b-instruct-q4_k_m',
        messageCount: 6,
        totalTokens: 480,
        isPinned: false,
        isArchived: false,
        settings: { isProject: true, folderName: '資安專題' },
        createdAt: '2026-09-19T21:31:00.000Z',
        updatedAt: '2026-09-19T21:34:00.000Z',
    },
]

export const DEMO_FOLDERS = [{ name: '資安專題', conversationCount: 2 }]

export const DEMO_DOCUMENTS = [
    {
        id: 'demo-doc-001',
        filename: '專題計畫書.docx',
        original_filename: '專題提案計畫書-中小企業導入地端AI系統之資安維護實作.docx',
        file_type: 'docx',
        file_size: 245760,
        size_bytes: 245760,
        status: 'completed',
        chunk_count: 48,
        created_at: '2026-09-19T21:28:00.000Z',
        processed_at: '2026-09-19T21:29:10.000Z',
        doc_metadata: { folderName: '資安專題', isActive: true },
    },
]

export const DEMO_SOURCES: MessageSource[] = [
    {
        document_id: 'demo-doc-001',
        document_name: '專題提案計畫書-中小企業導入地端AI系統之資安維護實作.docx',
        chunk_id: 'chunk-032',
        content: '3.2 個人資料自動遮罩（PII Masking）\n系統在用戶提問進入 AI 模型之前，會自動偵測並遮罩身分證號、手機號碼、信用卡號等敏感資訊。被遮罩的原始資料不會進入 LLM，確保敏感資訊不外洩至模型端。',
        score: 0.92,
    },
    {
        document_id: 'demo-doc-001',
        document_name: '專題提案計畫書-中小企業導入地端AI系統之資安維護實作.docx',
        chunk_id: 'chunk-033',
        content: '3.3 DLP 資料外洩防護規則引擎\n針對企業機密關鍵字（如薪資、合約、客戶名單），系統設有觸發規則，一旦偵測到高風險操作，立即阻擋請求並將事件記錄至稽核日誌。',
        score: 0.88,
    },
    {
        document_id: 'demo-doc-001',
        document_name: '專題提案計畫書-中小企業導入地端AI系統之資安維護實作.docx',
        chunk_id: 'chunk-051',
        content: '4.3 資安功能實測結果（表 4-3）\nPII 遮罩準確率：96.7%；DLP 阻擋率：100%；Prompt Injection 偵測率：90%。測試環境採本地部署，無任何資料送至外部伺服器。',
        score: 0.81,
    },
]

export const DEMO_QA_ANSWER = `Corphia 採用多層次資料保護機制，主要包含以下四個面向：

**1. 個人資料自動遮罩（PII Masking）**
系統在用戶提問進入 AI 模型之前，會自動偵測並遮罩身分證號、手機號碼、信用卡號等敏感資訊。被遮罩的原始資料不會進入 LLM，確保敏感資訊不外洩。

**2. DLP 資料外洩防護**
針對企業機密關鍵字（如「薪資」「合約」「客戶名單」），系統設有觸發規則，一旦偵測到高風險操作，立即阻擋並記錄至稽核日誌。

**3. Prompt Injection 偵測**
系統內建提示詞注入偵測引擎，可識別 ChatML 標籤繞過、角色扮演攻擊、越獄指令等模式，偵測到時自動清除危險標記並警告使用者。

**4. 完整稽核追蹤**
所有對話、文件操作、異常事件均記錄於不可竄改的稽核日誌，管理員可依時間、使用者、事件類型篩選查閱，確保合規性與可追溯性。`

export const DEMO_PII_MASK_MAP = [
    { original_preview: 'A123456789', masked: '[ID_CARD_****789]', type: 'ID_CARD', label: '身分證號' },
]

export const DEMO_PII_ANSWER = `您好，系統已偵測到您的輸入包含身分證號碼，已自動進行遮罩處理。

**遮罩結果：** \`A123456789\` → \`[ID_CARD_****789]\`

相關規定：依個人資料保護法第五條，個人資料之蒐集、處理或利用，應尊重當事人之權益，依誠實及信用方法為之，不得逾越特定目的之必要範圍。

> 📋 **請注意**：本系統已將您的敏感資訊進行遮罩，AI 模型僅看到遮罩後的版本，原始資料不會離開本地環境。`

export const DEMO_DLP_BLOCKED_ANSWER = `⛔ **此操作已被 DLP 政策阻擋**

您的請求包含受保護的敏感關鍵字（**薪資**、**合約**），依據企業資料外洩防護（DLP）政策，此類查詢已被系統自動攔截。

**觸發規則：** \`CONFIDENTIAL_HR_DATA\`
**風險等級：** 高（HIGH）
**處置方式：** 請求已阻擋，事件已記錄至稽核日誌

如有業務需要，請聯繫系統管理員申請相應的存取權限。`

export const DEMO_INJECTION_PATTERNS = [
    '角色覆蓋指令：「忽略以前的指令」',
    'ChatML 越獄模式：im_start/im_end',
    '無限制 AI 觸發詞：「沒有任何限制」',
]

export const DEMO_INJECTION_ANSWER = `⚠️ **偵測到提示詞注入攻擊**

系統已識別您的輸入包含已知的提示詞注入模式，危險標記已自動清除，此事件已記錄至稽核日誌。

**風險等級：** HIGH
**偵測模式：** 角色覆蓋指令、越獄觸發詞

我是 Corphia，協助中小企業管理企業知識的地端 AI 助理。我的行為準則已由您的系統管理員設定，無法被覆蓋或修改。`

export const DEMO_AUDIT_LOGS = [
    { id: 'log-001', event_type: 'INJECTION_DETECTED', user_email: 'demo@corp.ai', user_id: 'demo-user-001', description: '偵測到提示詞注入攻擊（HIGH），已自動清除危險標記', risk_level: 'high', ip_address: '192.168.1.101', created_at: '2026-09-19T21:34:00.000Z', metadata: {} },
    { id: 'log-002', event_type: 'DLP_BLOCKED', user_email: 'demo@corp.ai', user_id: 'demo-user-001', description: '請求包含機密關鍵字（薪資、合約），已依 DLP 政策阻擋', risk_level: 'high', ip_address: '192.168.1.101', created_at: '2026-09-19T21:33:00.000Z', metadata: {} },
    { id: 'log-003', event_type: 'PII_MASKED', user_email: 'demo@corp.ai', user_id: 'demo-user-001', description: '遮罩 1 筆個資（身分證號：ID_CARD），原始資料未進入模型', risk_level: 'medium', ip_address: '192.168.1.101', created_at: '2026-09-19T21:32:00.000Z', metadata: {} },
    { id: 'log-004', event_type: 'CHAT_QUERY', user_email: 'demo@corp.ai', user_id: 'demo-user-001', description: '正常問答完成，引用 3 篇文件段落', risk_level: 'low', ip_address: '192.168.1.101', created_at: '2026-09-19T21:31:00.000Z', metadata: {} },
    { id: 'log-005', event_type: 'DOCUMENT_UPLOAD', user_email: 'demo@corp.ai', user_id: 'demo-user-001', description: '上傳文件「專題提案計畫書.docx」並完成向量化處理（48 chunks）', risk_level: 'low', ip_address: '192.168.1.101', created_at: '2026-09-19T21:28:00.000Z', metadata: {} },
    { id: 'log-006', event_type: 'USER_LOGIN', user_email: 'admin@corp.ai', user_id: 'admin-user-001', description: '管理員帳號登入成功', risk_level: 'low', ip_address: '192.168.1.100', created_at: '2026-09-19T21:25:00.000Z', metadata: {} },
]

export const DEMO_USERS = [
    { id: 'admin-user-001', name: '系統管理員', email: 'admin@corp.ai', role: 'admin', isActive: true, createdAt: '2026-09-01T08:00:00.000Z', lastLoginAt: '2026-09-19T21:25:00.000Z' },
    { id: 'demo-user-001', name: '王小明', email: 'demo@corp.ai', role: 'user', isActive: true, createdAt: '2026-09-10T08:00:00.000Z', lastLoginAt: '2026-09-19T21:30:00.000Z' },
    { id: 'demo-user-002', name: '李小華', email: 'lihua@corp.ai', role: 'user', isActive: true, createdAt: '2026-09-12T08:00:00.000Z', lastLoginAt: '2026-09-18T14:22:00.000Z' },
]

export const DEMO_STATS = { totalUsers: 3, totalConversations: 2, totalDocuments: 1, totalMessages: 8 }

export const DEMO_TRIGGERS = {
    qa:        ['保護', '資料', '敏感', '安全', '機制', '功能', '如何', '什麼'],
    pii:       ['身份證', '身分證', '手機號', '信用卡', 'A123456789'],
    dlp:       ['薪資', '合約', '客戶名單', '薪水', '員工薪'],
    injection: ['忽略', '以前的指令', '沒有任何限制', '越獄', 'ignore previous'],
}
