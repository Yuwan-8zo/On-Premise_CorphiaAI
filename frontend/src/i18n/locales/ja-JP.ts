/**
 * 日本語翻訳 (Japanese Translation)
 */

export default {
    // 通用 (Common)
    common: {
        submit: '送信',
        cancel: 'キャンセル',
        save: '保存',
        delete: '削除',
        edit: '編集',
        loading: '読み込み中...',
        search: '検索',
        confirm: '確認',
        confirmDelete: '本当に削除しますか？',
        back: '戻る',
        close: '閉じる',
        error: 'エラー',
        success: '成功',
        warning: '警告',
        info: '情報',
    },

    // 認證 (Auth)
    auth: {
        login: 'ログイン',
        logout: 'ログアウト',
        register: 'アカウント登録',
        email: 'メールアドレス',
        account: 'メールアドレス',
        password: 'パスワード',
        confirmPassword: 'パスワード（確認用）',
        name: '名前',
        namePlaceholder: 'お名前を入力してください',
        forgotPassword: 'パスワードをお忘れですか？',
        rememberMe: 'ログイン状態を保持する',
        loginSuccess: 'ログインしました',
        loginFailed: 'ログインに失敗しました。認証情報を確認してください',
        registerSuccess: '登録が完了しました',
        registerFailed: '登録に失敗しました。後でもう一度お試しください',
        noAccount: 'アカウントをお持ちではありませんか？',
        hasAccount: 'すでにアカウントをお持ちですか？',
        welcomeBack: 'おかえりなさい',
        createAccount: 'アカウント作成',
        welcomeTitle: 'ようこそ',
        subtitle: 'あなたのインテリジェント企業アシスタント',
        engineDesc: 'エンタープライズ RAG & GGUF 分析エンジン',
        feature1: 'インテリジェントQ&A',
        feature2: '詳細なドキュメント分析',
        feature3: 'ローカルデプロイによるプライバシー保護',
        passwordMismatch: 'パスワードが一致しません',
        privacy: 'プライバシーポリシー',
        terms: '利用規約',
        help: 'ヘルプ＆サポート',
    },

    // 對話 (Chat)
    chat: {
        emptyGreeting: '何かお手伝いしましょうか、{{name}}？',
        inputPlaceholder: 'Corphia AI にメッセージを送信...',
        projectInputPlaceholder: 'メッセージを送信するか、資料をアップロードしてください...',
        suggestions: [
            { title: "ドキュメントを要約", desc: "簡単な要点のまとめを作成してください" },
            { title: "コンテンツを翻訳", desc: "このテキストを自然な現地語に翻訳してください" },
            { title: "メールを作成", desc: "専門用語を使ってビジネス協力のメールを作成してください" },
            { title: "コードを説明", desc: "このコードのロジックを詳しく説明してください" }
        ],
        newChat: '新しいチャット',
        newFolder: '新しいフォルダ',
        general: '一般',
        project: 'プロジェクト',
        generalChat: '一般チャット',
        moveToGeneralChat: '一般チャットへ移動',
        moveToProject: 'プロジェクトへ移動',
        confirmMoveToGeneral: 'このチャットを一般チャットに移動しますか？「{{folder}}」フォルダから削除されます。',
        sendMessage: 'メッセージを送信',
        thinking: '考え中...',
        stopGeneration: '生成を停止',
        regenerate: '再生成',
        copyMessage: 'メッセージをコピー',
        deleteChat: 'チャットを削除',
        renameChat: '名前を変更',
        placeholder: 'メッセージを入力...',
        noConversations: '会話履歴がありません',
        noChats: 'チャットがありません',
        startNewChat: '新しいチャットを始める',
        copied: 'コピーしました',
        messageCopied: 'クリップボードにコピーしました',
        today: '今日',
        yesterday: '昨日',
        previous: '以前',
    },

    // 設定 (Settings)
    settings: {
        title: '設定',
        theme: 'テーマ',
        themeLight: 'ライト',
        themeDark: 'ダーク',
        language: '言語',
        profile: 'プロフィール',
        account: 'アカウント設定',
        about: '概要',
    },

    // 錯誤 (Errors)
    errors: {
        networkError: 'ネットワークエラー',
        serverError: 'サーバーエラー',
        unauthorized: 'ログインしてください',
        forbidden: 'アクセス権限がありません',
        notFound: 'リソースが見つかりません',
        validationError: '検証エラー',
    },

    // 導覽 (Navigation)
    nav: {
        chat: 'チャット',
        documents: 'ドキュメント',
        settings: '設定',
        admin: '管理',
    },
}
