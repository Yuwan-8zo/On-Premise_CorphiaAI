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
        changeName: '名前を変更',
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
        changePassword: 'パスワード変更',
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
        noProjects: 'プロジェクトがありません',
        projectFolderLabel: 'プロジェクトフォルダ',
        askFromSource: 'このソースを元に質問する →',
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
        guide: '使用説明',
        mobileScanner: 'モバイルQRコード',
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

    // 概要 (About)
    about: {
        version: 'バージョン',
        systemStable: 'システム安定',
        description: 'ローカル大規模言語モデルと高精度な RAG ナレッジベース検索をサポートする企業向けプライベート AI チャットシステム。',
        frontend: 'Frontend / API',
        inference: 'Inference Engine',
        vector: 'Vector Storage',
        dataCore: 'Data Core',
        copyright: '© 2024 Corphia AI. MIT License.',
    },

    // 使用説明 (Guide)
    guide: {
        title: 'システム利用ガイド',
        subtitle: 'Corphia AI Platform へようこそ！このガイドでは、システムの各種リソースと専用機能を素早く理解するお手伝いをします。',
        auth: {
            title: 'ロールと権限管理',
            engineer: 'システム最高権限。「テナント (Tenants)」の作成と割り当てができ、すべてのログにアクセス可能です。',
            admin: 'テナント専用管理者。テナント内のメンバーリストを管理し、データ環境の基本設定を担当します。',
            user: '一般ユーザー。一般チャットやプロジェクトの閲覧、パーソナライズされた知識抽出プロジェクトの作成が可能です。'
        },
        project: {
            title: 'プロジェクトモードとナレッジベース構築',
            descStart: '画面左上から ',
            mode: 'プロジェクトモード',
            descEnd: ' に切り替えることができ、独立したナレッジベースのフォルダ構造が開きます。',
            step1: '左側の「新規プロジェクト」アイコンをクリックし、研究やプロジェクト用のフォルダに名前を付けます（例：「財務諸表分析」）。',
            step2Start: 'そのフォルダに入り、アップロードボタンをクリックします。対応形式は ',
            step2Types: '.txt, .md, .csv または .pdf',
            step2End: ' です。',
            step3: 'システムのバックエンドは自動的にファイルをチャンキング（分割）処理に送り、企業用ベクトルデータベース (ChromaDB) に保存します。',
            step4: '処理完了後、「このソースに基づいて質問する」をクリックすると、AIがドキュメント内容に基づいて正確な情報源とともに回答を提供します。'
        },
        chat: {
            title: '効率的なチャットとナビゲーション',
            minimapTitle: 'チャットスクロールミニマップ',
            minimapDescStart: '大量のチャットを入力した後、画面右側のスクロールバーに青灰色のブロックインジケーターが表示されます。これはチャット全体の各発言の位置割合を表しています。',
            minimapDescHighlight: 'マウスをホバーしてクリック',
            minimapDescEnd: ' すると、該当の箇所へ瞬時に移動できます。',
            scrollBottomTitle: 'フローティング一番下へ移動ボタン',
            scrollBottomDesc: '過去の履歴を上にスクロールして閲覧している場合、画面右下に下向きの矢印が静かに表示されます。クリックすると一瞬で最新の回答部分に戻ることができます。',
            renameTitle: '名前変更と全域削除',
            renameDesc: '左側のナビゲーションにあるいずれかのチャットにマウスをホバーすると、右側にメニューが表示され、「タイトルの変更」、「プロジェクトディレクトリの移動」、または「チャット履歴全体を直ちに削除」することができます。'
        }
    },
}
