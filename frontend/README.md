# Corphia AI Platform — Frontend

React 19 + Vite + Tailwind + Zustand + i18next + react-router

---

## 啟動

```powershell
cd D:\Antigravity\on-premise_CorphiaAI\frontend
npm run dev
```

開在 http://localhost:5173。需要後端 8168 同時跑，否則 `/api/*` proxy 會 timeout。

---

## 第一次安裝

```powershell
npm install
copy .env.example .env.local   # 通常不需要改，預設 vite proxy 走 8168
```

---

## 設計系統

**修圓角／字級／主題色，只改 `src/design-system/tokens.js` 一個地方就會全 App 同步。**

詳見 [`src/design-system/README.md`](./src/design-system/README.md)。

寫新元件時請：
- 用 `rounded-cv-lg` / `rounded-cv-xl` 而不是 `rounded-[20px]`
- 用 `text-body` / `text-title` 而不是 `text-[15px]`
- 用 `bg-bg-base` / `text-text-primary` 而不是 `bg-[#202022]`

---

## 路徑

```
src/
├─ pages/              ← 路由頁面 (Login / Chat / Documents / Admin / Share / Register / NotFound)
├─ components/
│  ├─ chat/              ← 對話頁元件
│  ├─ ui/                ← 通用 UI（Modal、SettingsModal、Toast、ConfirmModal…）
│  ├─ icons/             ← 品牌圖示 (Corphia logo / wordmark…)
│  └─ system/            ← 系統監控元件
├─ features/auth/       ← 登入相關 (FloatingInput、QrAccessModal、AuthEngineScene…)
├─ design-system/       ← 設計 token
├─ store/               ← Zustand: authStore / chatStore / uiStore
├─ api/                 ← REST/WebSocket clients
├─ hooks/               ← useChatLogic、useChatHooks…
├─ i18n/locales/        ← 三語: zh-TW / en-US / ja-JP
└─ lib/                 ← gsap、bootstrapAuth…

public/
├─ samples/             ← Documents 頁的「下載範例檔」用
├─ favicon.svg
└─ apple-touch-icon.png
```

---

## 重要 store

- **`authStore`** — JWT token、currentUser、refresh 流程
- **`chatStore`** — 訊息列表、conversation 狀態、RAG debug 資料
- **`uiStore`** — theme（light / dark / system）、accentColor、sidebarOpen、demoMode

`uiStore` 用 zustand persist，只把使用者偏好持久化（不存 token）。

---

## i18n

新增字串：
1. 三語檔同步加 key（`zh-TW.ts` / `en-US.ts` / `ja-JP.ts`）
2. 在元件裡 `const { t } = useTranslation(); t('namespace.key')`
3. 變數插值：`t('chat.emptyGreeting', { name: user.name })`，locale 字串寫 `'有什麼我可以幫忙的，{{name}}？'`

預設語言由瀏覽器/系統決定，可在設定 → 語言切換。

---

## Build

```powershell
npm run build       # 產出 dist/
npm run preview     # 本機預覽 build 結果
npm run lint        # ESLint
npm run test        # Vitest
```
