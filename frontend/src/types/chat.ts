/**
 * 對話相關類型定義
 */

export interface Conversation {
    id: string
    title: string
    model: string
    messageCount: number
    totalTokens: number
    isPinned: boolean
    isArchived: boolean
    folderId?: string
    settings: Record<string, unknown>
    createdAt: string
    updatedAt: string
}

export interface MessageSource {
    document_id: string
    document_name: string
    chunk_id: string
    content: string
    score: number
}

/**
 * 語音訊息附件。
 * - url 通常為 ObjectURL（blob:）或上傳後的後端 URL
 * - mimeType 通常為 audio/webm 或 audio/mp4
 * - transcript 若瀏覽器支援 Web Speech API，可選擇性附上轉錄文字
 */
export interface MessageAudio {
    url: string
    mimeType: string
    durationMs: number
    transcript?: string
    /** 後端正在轉錄；前端可顯示 loading 狀態，等轉錄完再清掉 */
    pending?: boolean
    /** 轉錄階段失敗的訊息（讓 UI 可顯示「轉錄失敗」狀態） */
    error?: string
}

/** AI 產出的檔案（Word、Excel、簡報）；下載見 api/files.ts */
export interface MessageAttachment {
    id: string
    filename: string
    kind: 'docx' | 'xlsx' | 'pptx' | string
    size: number
}

/** AI 回答前自己做的一步（用了哪個工具、做了什麼、有沒有成功） */
export interface MessageStep {
    tool: string
    summary: string
    ok: boolean
}

/** 一則回答的連網紀錄 */
export interface MessageWebSearch {
    /** 有沒有真的連外網查 */
    used: boolean
    /** 送出去的關鍵字（只有這幾個詞離開這台主機） */
    query?: string
    /** 查到、給模型參考的網頁 */
    sources?: Array<{ title: string; url: string }>
    /** 要查但被擋下來的原因（列管字詞、搜尋服務連不上） */
    blocked?: string
    /** 這一題看起來需要即時資訊，但依政策沒有自動查 */
    suggested?: boolean
}

export interface Message {
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    tokens: number
    sources?: MessageSource[]
    /** AI 產出的檔案 */
    attachments?: MessageAttachment[]
    /** 正在製作哪一種檔案（只在串流期間存在前端，顯示「正在製作 Word 文件…」） */
    making?: string
    /** 模型的思考過程（只有支援推理的模型才有）；串流時即時累加，回答完成後存進資料庫，之後還能回顧 */
    reasoning?: string
    /** 這一則回答有沒有連外網（後端每一則都記；系統沒開對外搜尋、或舊訊息是 undefined，畫面上就不標） */
    webSearch?: MessageWebSearch
    /** AI 這一題自己做了哪些步驟（查文件、連外網、計算…）；沒用工具是 undefined */
    steps?: MessageStep[]
    /** 正在用哪個工具（只在串流期間存在前端） */
    working?: string
    /** 對話分支：這個位置的所有版本（照建立順序，包含自己）；只有一版時是空的 */
    versionIds?: string[]
    rating?: number
    content_hash?: string
    prev_hash?: string
    /** 語音訊息附件（若此訊息為語音訊息） */
    audio?: MessageAudio
    createdAt: string
    /** 被 DLP／提示詞注入攔下的訊息：只存在前端，不會寫進資料庫，也不會成為下一題的對話歷史 */
    blocked?: boolean
    /** 被攔截訊息之前有幾則一般訊息（重新載入時用來插回原位，不依賴時間，避免各元件時鐘不一致） */
    blockedAfter?: number
}
