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
    { name: 'qwen2.5-7b-instruct-q4_k_m', display_name: 'Qwen2.5-7B (CPU)', size_gb: 4.4, is_loaded: true, is_current: true, context_length: 32768, description: '純 CPU 推論，9.62 tok/s', filename: 'qwen2.5-7b-instruct-q4_k_m.gguf', quantization: 'Q4_K_M', sha256: 'a3f8d2c1b4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1' },
    { name: 'qwen2.5-3b-instruct-q4_k_m', display_name: 'Qwen2.5-3B (CPU)', size_gb: 2.0, is_loaded: false, is_current: false, context_length: 32768, description: '輕量模型，23.57 tok/s', filename: 'qwen2.5-3b-instruct-q4_k_m.gguf', quantization: 'Q4_K_M', sha256: 'b4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5' },
    { name: 'qwen2.5-14b-instruct-q4_k_m', display_name: 'Qwen2.5-14B (CPU)', size_gb: 8.9, is_loaded: false, is_current: false, context_length: 32768, description: '高品質模型，4.14 tok/s', filename: 'qwen2.5-14b-instruct-q4_k_m.gguf', quantization: 'Q4_K_M', sha256: 'c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6' },
]

export const DEMO_CONVERSATIONS: Conversation[] = []

export const DEMO_FOLDERS: { name: string; conversationCount: number }[] = []

export const DEMO_DOCUMENTS: {
    id: string; filename: string; original_filename: string; file_type: string
    file_size: number; size_bytes: number; status: string; chunk_count: number
    created_at: string; processed_at: string; doc_metadata: Record<string, unknown>
}[] = []

export const DEMO_SOURCES: MessageSource[] = [
    {
        document_id: 'demo-doc-001',
        document_name: '專題提案計畫書-中小企業導入地端AI系統之資安維護實作.docx',
        chunk_id: 'chunk-051',
        content: '4.3 資安功能實測結果（表 4-3）\nPII 遮罩準確率：96.7%；DLP 阻擋率：100%；Prompt Injection 偵測率：90%。測試環境採本地部署，無任何資料送至外部伺服器。',
        score: 0.92,
    },
    {
        document_id: 'demo-doc-002',
        document_name: '專題提案計畫書-中小企業導入地端AI系統之資安維護實作.pdf',
        chunk_id: 'chunk-p051',
        content: '4.3 資安功能實測結果（表 4-3）\nPII 遮罩準確率：96.7%；DLP 阻擋率：100%；Prompt Injection 偵測率：90%。測試環境採本地部署，無任何資料送至外部伺服器。',
        score: 0.88,
    },
]

export const DEMO_QA_ANSWER = `Corphia AI Platform 採用多層次資料保護機制，完全部署於企業內部環境，確保所有資料不離開本地端。

**1. 個人資料自動遮罩（PII Masking）**
提問在進入 AI 模型前，系統自動偵測並遮罩身分證號、手機號碼、信用卡號等敏感資訊，原始資料不進入 LLM。

**2. DLP 資料外洩防護**
針對企業機密關鍵字（薪資、合約、客戶名單等）設有觸發規則，偵測到高風險操作即時阻擋並記錄至稽核日誌。

**3. Prompt Injection 偵測**
內建提示詞注入偵測引擎，可識別 ChatML 標籤繞過、角色扮演攻擊、越獄指令等模式，自動清除危險標記並警示使用者。

**4. 完整稽核追蹤**
所有對話、文件操作、異常事件均記錄於不可竄改的稽核日誌，管理員可依時間、使用者、事件類型篩選查閱，符合企業合規要求。

**5. 地端部署，資料零外流**
採用 Ollama 本地推論引擎，搭配 Qwen2.5 系列模型，所有運算在企業內部完成，敏感資料永不送至雲端。`

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

export const DEMO_AUDIT_LOGS: {
    id: string; event_type: string; user_email: string; user_id: string
    description: string; risk_level: string; ip_address: string; created_at: string; metadata: Record<string, unknown>
}[] = []

export const DEMO_USERS = [
    { id: 'user-admin-001', name: '系統管理員', email: 'admin@corp.ai', role: 'admin', is_active: true, created_at: '2026-09-01T08:00:00.000Z', last_login_at: '2026-09-20T09:00:00.000Z' },
    { id: 'user-002', name: '王小明', email: 'ming@corp.ai', role: 'user', is_active: true, created_at: '2026-09-05T08:00:00.000Z', last_login_at: '2026-09-19T17:30:00.000Z' },
    { id: 'user-003', name: '李小華', email: 'hua@corp.ai', role: 'user', is_active: true, created_at: '2026-09-10T08:00:00.000Z', last_login_at: '2026-09-18T14:22:00.000Z' },
]

export const DEMO_STATS = { totalUsers: 3, totalConversations: 0, totalDocuments: 0, totalMessages: 0 }

export const DEMO_RAG_IN_DOC_ANSWER = `根據您上傳的《專題提案計畫書-中小企業導入地端AI系統之資安維護實作》，系統資安功能實測結果如下：

**表 4-3 資安功能實測結果**

| 資安功能 | 測試筆數 | 準確率 / 阻擋率 |
|---------|---------|---------------|
| PII 個資自動遮罩 | 30 筆 | **96.7%** |
| DLP 資料外洩防護 | 20 筆 | **100%** |
| Prompt Injection 偵測 | 20 筆 | **90%** |

所有測試均在本地部署環境下進行，**無任何資料傳送至外部伺服器**。

> 📄 引用來源：第 4.3 節「資安功能實測結果」`

export const DEMO_RAG_NOT_FOUND_ANSWER = `根據目前知識庫中的文件，**找不到與此問題相關的資訊**。

本系統的 RAG（檢索增強生成）功能僅能根據已上傳文件的內容回答問題。目前知識庫收錄：
- 《專題提案計畫書-中小企業導入地端AI系統之資安維護實作》

**知識庫可回答的問題類型：**
- 系統功能與技術規格說明
- 資安功能實測結果與效能數據
- 系統架構、部署方式與研究背景

如需查詢知識庫範圍以外的資訊，請上傳相關文件，或改為使用不啟用 RAG 的一般問答模式。`

export const DEMO_TRIGGERS = {
    qa:          ['保護', '資料', '敏感', '安全', '機制', '功能', '如何', '什麼', '確保', '地端', '平台'],
    pii:         ['身份證', '身分證', '手機號', '信用卡', 'A123456789'],
    dlp:         ['薪資', '合約', '客戶名單', '薪水', '員工薪'],
    injection:   ['忽略', '以前的指令', '沒有任何限制', '越獄', 'ignore previous'],
    rag_in_doc:  ['準確率', '阻擋率', '偵測率', '實測', '根據文件', '根據上傳', '文件中', '知識庫中'],
    rag_not_found: ['天氣', '氣象', '股市', '股價', '電影', '運動', '新聞', '食物', '餐廳'],
}
