/**
 * English Translation
 */

export default {
    // Common
    common: {
        submit: 'Submit',
        cancel: 'Cancel',
        save: 'Save',
        delete: 'Delete',
        edit: 'Edit',
        loading: 'Loading...',
        search: 'Search',
        confirm: 'Confirm',
        confirmDelete: 'Do you want to delete?',
        back: 'Back',
        close: 'Close',
        error: 'Error',
        success: 'Success',
        warning: 'Warning',
        info: 'Info',
        changeName: 'Change Name',
    },

    // Authentication
    auth: {
        login: 'Login',
        logout: 'Logout',
        register: 'Register',
        email: 'Email',
        account: 'Email',
        password: 'Password',
        confirmPassword: 'Confirm Password',
        name: 'Name',
        namePlaceholder: 'Enter your name',
        forgotPassword: 'Forgot password?',
        rememberMe: 'Remember me',
        loginSuccess: 'Login successful',
        loginFailed: 'Login failed. Please check your credentials.',
        registerSuccess: 'Registration successful',
        registerFailed: 'Registration failed. Please try again.',
        noAccount: "Don't have an account?",
        hasAccount: 'Already have an account?',
        welcomeBack: 'Welcome back',
        createAccount: 'Create account',
        welcomeTitle: 'Welcome to',
        subtitle: 'Your Intelligent Enterprise Assistant',
        engineDesc: 'Enterprise-grade RAG & GGUF Analysis Engine',
        feature1: 'Intelligent Q&A',
        feature1Desc: 'Intelligent Q&A based on enterprise knowledge base',
        feature2: 'Deep Document Analysis',
        feature2Desc: 'Multi-dimensional analysis of document content and associations',
        feature3: 'On-Premise Privacy',
        feature3Desc: 'Controllable data security, guaranteed privacy',
        passwordMismatch: 'Passwords do not match',
        privacy: 'Privacy',
        terms: 'Terms of Service',
        help: 'Help & Support',
        changePassword: 'Change Password',
    },

    // Chat
    chat: {
        emptyGreeting: 'What can I help you with, {{name}}?',
        inputPlaceholder: 'Message Corphia AI...',
        projectInputPlaceholder: 'Send a message or upload documents...',
        suggestions: [
            { title: "Summarize Document", desc: "Help me organize a simple key summary" },
            { title: "Translate Content", desc: "Translate this text into fluent local language" },
            { title: "Write an Email", desc: "Write a business cooperation email using professional terms" },
            { title: "Explain Code", desc: "Help me explain the logic of this code in detail" }
        ],
        newChat: 'New Chat',
        newFolder: 'New Folder',
        general: 'General',
        project: 'Project',
        generalChat: 'General Chat',
        moveToGeneralChat: 'Move to General Chat',
        moveToProject: 'Move to Project',
        confirmMoveToGeneral: 'Are you sure you want to move this chat to General Chat? It will be removed from the "{{folder}}" folder.',
        sendMessage: 'Send Message',
        thinking: 'Thinking...',
        stopGeneration: 'Stop',
        regenerate: 'Regenerate',
        copyMessage: 'Copy',
        deleteChat: 'Delete',
        renameChat: 'Rename',
        placeholder: 'Type a message...',
        noConversations: 'No conversations yet',
        noChats: 'No recent chats',
        noProjects: 'No projects yet',
        projectFolderLabel: 'Project Folders',
        askFromSource: 'Ask questions based on this source →',
        startNewChat: 'Start a new chat',
        copied: 'Copied',
        messageCopied: 'Message copied to clipboard',
        today: 'Today',
        yesterday: 'Yesterday',
        previous: 'Previous',
        promptTemplates: [
            { title: 'Summarize', prompt: 'Please summarize the key points of the following text using bullet points:\n\n' },
            { title: 'Translate', prompt: 'Please translate the following text into fluent, natural-sounding English:\n\n' },
            { title: 'Explain Code', prompt: 'Please explain the logic and purpose of the following code line by line:\n\n' },
            { title: 'Debug Helper', prompt: 'There is an error in the following code. Please analyze the possible causes and provide a suggested fix:\n\n' },
            { title: 'Draft Email', prompt: 'Please help me draft a formal business email. The main purpose is:\n\n' },
            { title: 'Polish wording', prompt: 'Please polish the following text to make the vocabulary more professional and appropriate:\n\n' }
        ],
    },

    // Settings
    settings: {
        title: 'Settings',
        theme: 'Theme',
        themeLight: 'Light',
        themeDark: 'Dark',
        language: 'Language',
        profile: 'Profile',
        account: 'Account',
        about: 'About',
        guide: 'Guide',
        mobileScanner: 'Mobile Scanner',
    },

    // Errors
    errors: {
        networkError: 'Network error',
        serverError: 'Server error',
        unauthorized: 'Please login first',
        forbidden: 'Permission denied',
        notFound: 'Resource not found',
        validationError: 'Validation failed',
    },

    // Navigation
    nav: {
        chat: 'Chat',
        documents: 'Documents',
        settings: 'Settings',
        admin: 'Admin',
    },

    // About
    about: {
        version: 'Version',
        systemStable: 'System Stable',
        description: 'Enterprise-grade private deployment AI Q&A system, supporting local LLMs and RAG enterprise knowledge base precise retrieval technology.',
        frontend: 'Frontend / API',
        inference: 'Inference Engine',
        vector: 'Vector Storage',
        dataCore: 'Data Core',
        copyright: '© 2024 Corphia AI. MIT License.',
    },

    // Security Features (A1/A2)
    security: {
        piiDetected: 'Sensitive information detected and auto-masked',
        piiDescription: 'The AI model receives masked content only. Original sensitive data never enters the model.',
        injectionDetected: 'Suspicious Prompt Injection pattern detected',
        injectionDescription: 'Dangerous tokens have been sanitized and this event has been logged for audit.',
        riskLevel: 'Risk Level',
        matchedPatterns: 'Detected Patterns',
        offlineMode: '✅ Data Sovereignty: Fully Offline Operation',
        onlineWarning: '⚠️ External network connection detected',
    },

    // System Monitor (C4)
    systemMonitor: {
        title: 'System Monitor',
        cpu: 'CPU',
        cpuUsage: 'CPU Usage',
        memory: 'Memory',
        gpu: 'GPU',
        gpuUsage: 'GPU Usage',
        vram: 'VRAM',
        noGpu: 'No GPU detected — model running on CPU',
        llmModel: 'LLM Model',
        modelLoaded: 'Loaded',
        simulationMode: 'Simulation Mode',
        contextSize: 'Context Size',
        gpuLayers: 'GPU Layers',
    },

    // RAG Debug (C2)
    ragDebug: {
        title: 'RAG Debug',
        route: 'Route Decision',
        contextLength: 'Context Length',
        promptLength: 'Prompt Length',
        chunksCount: 'Retrieved Chunks',
        similarity: 'Similarity',
        ragRoute: 'Knowledge Base Retrieval',
        webRoute: 'Web Search',
        chatRoute: 'General Chat',
    },

    // Guide
    guide: {
        title: 'System Guide',
        subtitle: "Welcome to Corphia AI Platform! This guide will help you quickly familiarize yourself with the system's resources and exclusive features.",
        auth: {
            title: 'Identity and Access Management',
            engineer: 'System highest access, can create and assign all "Tenants", and access full logs.',
            admin: 'Tenant exclusive admin, can manage internal tenant members and basic data environment settings.',
            user: 'General user, can use general chat, view projects and create personalized knowledge extraction projects.'
        },
        project: {
            title: 'Project Mode and Knowledge Base Creation',
            descStart: 'You can switch the interface from the top left to ',
            mode: 'Project Mode',
            descEnd: ', which will open an independent knowledge base folder structure:',
            step1: 'Click the New Project icon on the left to name a folder for your research or project (e.g., "Financial Report Analysis").',
            step2Start: 'Enter the folder and click the upload button, supporting ',
            step2Types: '.txt, .md, .csv or .pdf',
            step2End: ' files.',
            step3: 'The system backend will automatically send files to chunking and write to the enterprise vector database (ChromaDB).',
            step4: 'Once processed, click "Ask questions based on this source", and AI will answer and trace sources accurately based on your documents.'
        },
        chat: {
            title: 'Efficient Chat and Navigation',
            minimapTitle: 'Scroll Minimap',
            minimapDescStart: 'After entering many messages, a blue-gray block indicator will appear on the right scrollbar, representing the proportional position of each message in the entire canvas; ',
            minimapDescHighlight: 'hover and click',
            minimapDescEnd: ' to quickly jump to the corresponding node.',
            scrollBottomTitle: 'Floating Scroll-to-Bottom Button',
            scrollBottomDesc: 'If you are scrolling up through past records, a downward arrow will quietly emerge at the bottom right after some distance. Clicking it will drop you back to the latest response in one second.',
            renameTitle: 'Rename and Global Delete',
            renameDesc: 'Hover over any chat in the left navigation to display a popup menu, where you can "Edit Title", "Move Project Directory" or immediately "Delete Entire Chat Record".'
        }
    },
}
