/**
 * 繁體中文翻譯
 */

export default {
    // 通用
    common: {
        submit: '送出',
        cancel: '取消',
        save: '儲存',
        delete: '刪除',
        edit: '編輯',
        loading: '載入中...',
        search: '搜尋',
        confirm: '確認',
        confirmDelete: '要刪除嗎？',
        back: '返回',
        close: '關閉',
        error: '錯誤',
        success: '成功',
        warning: '警告',
        info: '提示',
        changeName: '修改名稱',
    },

    // 認證
    auth: {
        login: '登入',
        logout: '登出',
        register: '註冊',
        email: '電子郵件',
        account: '信箱',
        password: '密碼',
        confirmPassword: '確認密碼',
        name: '名稱',
        namePlaceholder: '請輸入您的名稱',
        forgotPassword: '忘記密碼？',
        rememberMe: '記住我',
        loginSuccess: '登入成功',
        loginFailed: '登入失敗，請檢查帳號密碼',
        registerSuccess: '註冊成功',
        registerFailed: '註冊失敗，請稍後再試',
        noAccount: '還沒有帳號？',
        hasAccount: '已有帳號？',
        welcomeBack: '歡迎回來',
        createAccount: '建立帳號',
        welcomeTitle: '歡迎使用',
        subtitle: '您的智能企業助手',
        engineDesc: '企業級 RAG 與 GGUF 分析引擎',
        feature1: '智能問答系統',
        feature1Desc: \'基於企業知識庫的智慧問答',
        feature2: '文檔深度剖析',
        feature2Desc: \'多維度分析文檔內容與關聯',
        feature3: '本地部署隱私',
        feature3Desc: \'數據安全可控，隱私有保障',
        passwordMismatch: '密碼不一致',
        privacy: '隱私權',
        terms: '服務條款',
        help: '幫助與支援',
        changePassword: '修改密碼',
    },

    // 對話
    chat: {
        emptyGreeting: '有什麼我可以幫忙的，{{name}}？',
        inputPlaceholder: '傳送訊息給 Corphia AI...',
        projectInputPlaceholder: '傳送訊息或上傳資料...',
        suggestions: [
            { title: "摘要文件", desc: "幫我整理出一份簡單的重點摘要" },
            { title: "翻譯內容", desc: "將這段文字翻譯成通順的在地語言" },
            { title: "撰寫 Email", desc: "以專業用語撰寫一封商務合作信件" },
            { title: "說明程式碼", desc: "幫我詳細解釋這段程式碼的邏輯" }
        ],
        newChat: '新對話',
        newFolder: '新資料夾',
        general: '一般',
        project: '專案',
        generalChat: '一般聊天',
        moveToGeneralChat: '移至一般聊天',
        moveToProject: '移至專案',
        confirmMoveToGeneral: '確定要將此對話移回一般聊天？將會從「{{folder}}」資料夾移除。',
        sendMessage: '發送訊息',
        thinking: '思考中...',
        stopGeneration: '停止生成',
        regenerate: '重新生成',
        copyMessage: '複製訊息',
        deleteChat: '刪除對話',
        renameChat: '重新命名',
        placeholder: '輸入訊息...',
        noConversations: '尚無對話記錄',
        noChats: '尚無聊天',
        noProjects: '尚無專案',
        projectFolderLabel: '專案資料夾',
        askFromSource: '基於此來源開始提問 →',
        startNewChat: '開始新對話',
        copied: '已複製',
        messageCopied: '訊息已複製到剪貼簿',
        today: '今天',
        yesterday: '昨天',
        previous: '更早',
        promptTemplates: [
            { title: '摘要歸納', prompt: '請幫我摘錄以下內容的重點，並使用條列式呈現：\n\n' },
            { title: '翻譯助理', prompt: '請將以下文字以流暢、自然的語氣翻譯為繁體中文：\n\n' },
            { title: '程式原理解釋', prompt: '請幫我逐行解釋以下程式碼的執行邏輯與目的：\n\n' },
            { title: '除錯助手', prompt: '這段程式碼出現了錯誤，請幫我分析可能的原因並提供修正建議：\n\n' },
            { title: '撰寫正式 Email', prompt: '請幫我草擬一封正式的商務電子郵件，主要目的是：\n\n' },
            { title: '語氣潤飾', prompt: '請幫我潤飾以下文字，確保用詞更專業、得體：\n\n' }
        ],
    },

    // 設定
    settings: {
        title: '設定',
        theme: '主題',
        themeLight: '淺色',
        themeDark: '深色',
        language: '語言',
        profile: '個人資料',
        account: '帳號設定',
        about: '關於',
        guide: '使用說明',
        mobileScanner: '行動裝置掃描',
    },

    // 錯誤
    errors: {
        networkError: '網路連線錯誤',
        serverError: '伺服器錯誤',
        unauthorized: '請先登入',
        forbidden: '權限不足',
        notFound: '資源不存在',
        validationError: '資料驗證失敗',
    },

    // 導覽
    nav: {
        chat: '對話',
        documents: '文件',
        settings: '設定',
        admin: '管理',
    },

    // 關於
    about: {
        version: '版本',
        systemStable: '系統穩定',
        description: '企業級私有部署 AI 問答系統，支援本地大型語言模型與 RAG 企業知識庫精準檢索技術。',
        frontend: '前端介面 / API',
        inference: '模型推論引擎',
        vector: '向量儲存庫',
        dataCore: '核心資料庫',
        copyright: '© 2024 Corphia AI. MIT License.',
    },

    // 資安功能 (A1/A2 差異化)
    security: {
        piiDetected: '偵測到敏感資訊已自動遮罩',
        piiDescription: '送入 AI 模型的是遮罩後的內容，原始敏感資訊不會進入模型。',
        injectionDetected: '偵測到可疑的 Prompt Injection 模式',
        injectionDescription: '系統已自動清除危險標記，並記錄此事件於審計日誌。',
        riskLevel: '風險等級',
        matchedPatterns: '偵測到的模式',
        offlineMode: '✅ 資料主權保證：完全離線運行',
        onlineWarning: '⚠️ 偵測到外部網路連線',
    },

    // 系統監控 (C4 差異化)
    systemMonitor: {
        title: '系統監控',
        cpu: 'CPU',
        cpuUsage: 'CPU 使用率',
        memory: '記憶體',
        gpu: 'GPU',
        gpuUsage: 'GPU 使用率',
        vram: 'VRAM',
        noGpu: '未偵測到 GPU — 模型以 CPU 模式運行',
        llmModel: 'LLM 模型',
        modelLoaded: '已載入',
        simulationMode: '模擬模式',
        contextSize: 'Context Size',
        gpuLayers: 'GPU Layers',
    },

    // RAG 除錯 (C2 差異化)
    ragDebug: {
        title: 'RAG Debug',
        route: '路由決策',
        contextLength: 'Context 長度',
        promptLength: 'Prompt 長度',
        chunksCount: '檢索 Chunks 數',
        similarity: '相似度',
        ragRoute: '知識庫檢索',
        webRoute: '網路搜尋',
        chatRoute: '一般對話',
    },

    // 使用說明
    guide: {
        title: '系統使用說明書',
        subtitle: '歡迎使用 Corphia AI Platform！本指南將協助您快速熟悉系統各項資源與專屬功能。',
        auth: {
            title: '身份與權限管理',
            engineer: '系統最高權限，可建立與指派所有「租戶 (Tenants)」，並存取完整日誌紀錄。',
            admin: '專屬租戶管理員，可管理租戶內部成員名單並負責資料環境的基本設置。',
            user: '一般使用者，能執行一般聊天、查閱專案並建立個人化的知識萃取專案。'
        },
        project: {
            title: '專案模式與知識庫建立',
            descStart: '您可以將介面由左上方切換為 ',
            mode: '專案模式',
            descEnd: '，這將會開啟獨立的知識庫資料夾架構：',
            step1: '點擊左側的新增專案圖示，為您的研究或專案命名一個資料夾（例如：「財務報表分析」）。',
            step2Start: '進入該資料夾點擊上傳按鈕，支援上傳 ',
            step2Types: '.txt, .md, .csv 或 .pdf',
            step2End: ' 文件。',
            step3: '系統後台會自動將文件送入切片處理程序（Chunking）寫入企業向量資料庫（ChromaDB）。',
            step4: '處理完成後，您點選「基於此來源開始提問」，AI 便會針對您的文件內容給予答覆與精準溯源。'
        },
        chat: {
            title: '高效對話與導覽操作',
            minimapTitle: '聊天節點小地圖 (Scroll Minimap)',
            minimapDescStart: '當您輸入大量對話後，畫面右側的滾動條將會出現指示藍灰方塊，這代表整段畫佈中每一句發言的比例位置；',
            minimapDescHighlight: '停懸滑鼠並點擊',
            minimapDescEnd: ' 即可迅速將畫面躍動至對應節點。',
            scrollBottomTitle: '懸浮置底按鈕',
            scrollBottomDesc: '如果您正在往上翻閱過去的紀錄，畫面右下方會於一段距離後悄悄浮現一個往下箭頭。點擊它能讓您一秒內滑降回到最新回應處。',
            renameTitle: '改名與全域刪除',
            renameDesc: '將游標 Hover 到左側導覽列的任一對話上，會顯示出設定彈出式選單，您可以進行「修改標題」、「移轉專案目錄」或是立刻「刪除整個對話紀錄」。'
        }
    },
}
