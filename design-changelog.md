# Design Review 改造紀錄

> 在 Antigravity 開啟此專案前先把所有改動記錄下來，避免遺漏或重複。
>
> 本檔案分兩段：
> 1. **已套用的改動**（8 項，已寫入程式碼，HMR 已驗證）
> 2. **預計繼續的改動**（依 design-scorecard.md 的 Top-5 優先排序，尚未動手）

---

## PART 1 — 已套用（DONE）

每一項都記錄了動到的檔案、改動內容、驗證方式。版本控管時可直接拿去當 commit message。

### ✅ 1. 修補 `chat.promptTemplatesTitle` i18n 漏翻

**動到的檔案**

```
frontend/src/i18n/locales/zh-TW.ts
frontend/src/i18n/locales/en-US.ts
frontend/src/i18n/locales/ja-JP.ts
```

**改動**

在 `chat.promptTemplates` 陣列後加 `promptTemplatesTitle` key：

- zh-TW: `'提示詞模版'`
- en-US: `'Prompt templates'`
- ja-JP: `'プロンプトテンプレート'`

**驗證**

a11y tree 上原本顯示 `button "chat.promptTemplatesTitle"`，改後變 `button "提示詞模版"`。

---

### ✅ 2. Documents 加返回聊天的入口

**動到的檔案**

```
frontend/src/pages/Documents.tsx
frontend/src/i18n/locales/zh-TW.ts
frontend/src/i18n/locales/en-US.ts
frontend/src/i18n/locales/ja-JP.ts
```

**改動**

- `Documents.tsx`: import `Link` from `react-router-dom`；header 左側 title 前面插入 `<Link to="/chat">` 包一個左箭頭 svg。
- 三語 locales 在 `common.back` 後加 `backToChat`：
  - zh-TW: `'返回聊天'`
  - en-US: `'Back to chat'`
  - ja-JP: `'チャットに戻る'`

**驗證**

走 `/documents`，左上「📁 文件」前出現 `<` 箭頭，hover 顯示 tooltip「返回聊天」，點擊正確跳到 `/chat`。

---

### ✅ 3. Login 裝飾圖與 feature 文字打架

**動到的檔案**

```
frontend/src/features/auth/components/AuthEngineScene.tsx
frontend/src/pages/Login.tsx
```

**改動**

- `AuthEngineScene.tsx`: 加 `decorative?: boolean` prop；`decorative=true` 時：
  - 加 radial-gradient `mask-image`，由中央向邊緣淡出
  - 加 `pointer-events: none`
  - `aria-hidden=true`
  - 隱藏底部 `engine-copy` 區塊（`Enterprise Knowledge Engine` 副標）
- `Login.tsx`: 把背景用法的 `<AuthEngineScene>` 加 `decorative` prop。

**驗證**

Login 深色畫面下知識圖譜環縮成中央光暈，feature 列「智能問答系統 / 文檔深度剖析 / 本地部署隱私」完全不會被覆蓋。

---

### ✅ 4. Login placeholder（floating label）對比度

**動到的檔案**

```
frontend/src/features/auth/components/FloatingInput.tsx
```

**改動**

`motion.label` 在「未浮動」狀態的 color 從 `rgb(var(--text-muted))`（dark 100,100,100，contrast ~2.7:1）改成 `rgb(var(--text-secondary))`（dark 154,154,154，contrast ~5.6:1，達 WCAG AA）。

**驗證**

Login 深色畫面下「信箱 / 密碼」浮動標籤在 placeholder 位置可清楚看到。

---

### ✅ 5. Bonus：修掉 `確認密碼` 在登入模式下穿透容器外溢

**動到的檔案**

```
frontend/src/pages/Login.tsx
```

**改動**

包住 `FloatingInput` 確認密碼的 `motion.div`：

- 加 `className="overflow-hidden"`（原本只有 height/opacity 動畫，但 absolute label 會穿透容器）
- 加 `aria-hidden={activeTab !== 'register'}`

**驗證**

登入模式下不再看到 `確認密碼` 灰色 label。

---

### ✅ 6. 加「跟隨系統」主題選項

**動到的檔案**

```
frontend/src/store/uiStore.ts
frontend/src/App.tsx
frontend/src/components/ui/SettingsModal.tsx
frontend/src/i18n/locales/zh-TW.ts
frontend/src/i18n/locales/en-US.ts
frontend/src/i18n/locales/ja-JP.ts
```

**改動**

- `uiStore.ts`:
  - 新增 type `ThemePreference = 'system' | 'light' | 'dark'`
  - 新增 state `themePreference`（持久化），預設 `'system'`
  - 新增 action `setThemePreference(pref)`：`'system'` 時依現在的 `prefers-color-scheme` 同步 `theme`，否則直接 set
  - `toggleTheme()` 同時鎖 `themePreference` 到目標主題（跳出 system 模式）
  - `partialize` 新增 `themePreference`
- `App.tsx`: 系統主題 listener 改成只在 `themePreference === 'system'` 時生效；之前有個 bug 是不論偏好都會被系統覆蓋掉。
- `SettingsModal.tsx`:
  - 從 store 解構 `themePreference` 與 `setThemePreference`，移除沒用到的 `toggleTheme`
  - 主題分頁從 2 張卡（淺色 / 深色）改成 3 張卡（淺色 / 深色 / 跟隨系統）
  - 「跟隨系統」卡使用半邊太陽半邊月亮 mockup，標題加 hint tooltip
- 三語新增 `settings.themeSystem` 與 `settings.themeSystemHint`。

**驗證**

設定 → 主題 看到 3 張卡；點「跟隨系統」會立刻同步系統當下偏好；切完關閉再開仍然記住。

---

### ✅ 7. 訊息泡泡加 Regenerate 與 Token 用量

**動到的檔案**

```
frontend/src/components/chat/MessageBubble.tsx
frontend/src/hooks/useChatLogic.ts
frontend/src/pages/Chat.tsx
```

**改動**

- `MessageBubble.tsx`:
  - props 新增 `onRegenerate?: (messageId: string) => void`
  - import `RefreshCw` from lucide-react
  - AI 訊息 hover toolbar 在 Copy 後面加 `<button onClick={() => onRegenerate(message.id)}>` 顯示重新整理 icon
  - AI 與使用者訊息 toolbar 都加 `message.tokens > 0` 時顯示 `123 tok` 小字
- `useChatLogic.ts`:
  - 新增 `handleRegenerate(assistantMessageId)`：往上找最近一則 user 訊息，呼叫既有的 `handleResubmit`
  - 回傳 props 加上 `handleRegenerate`
- `Chat.tsx`: `<MessageBubble>` 的 props 加上 `onRegenerate={mainProps.handleRegenerate}`

**驗證**

需要實際發一則對話才看得到 hover toolbar，這次走查未當場驗證視覺，但 code-level 確認無誤。

---

### ✅ 8. Admin KPI 卡 accent 高亮

**動到的檔案**

```
frontend/src/pages/Admin.tsx
```

**改動**

- `metricCards` 陣列每筆加 `primary?: boolean`，把「對話總數」標 `primary: true`
- 渲染時：
  - primary 卡：`border-accent/40 ring-1 ring-accent/20 bg-gradient-to-br from-accent/10 to-transparent shadow-md`
  - primary 卡 icon 圓圈：`bg-accent/20`（其他用 `bg-accent/10`）
  - primary 卡數字：`font-semibold text-accent`（其他用 `font-light text-text-primary`）

**驗證**

Admin 總覽頁，「對話總數 18」那張卡明顯比其他 3 張暖、亮，數字本身用青銅色，邊緣有微光。

---

### ✅ 9. 稽核紀錄表格 compact

**動到的檔案**

```
frontend/src/pages/Admin.tsx
```

**改動**

稽核 section 的 `<thead>` 與 `<tbody>` 內：

- `th` 從 `px-5 py-4` → `px-5 py-2.5`
- `td` 從 `px-5 py-4` → `px-5 py-2`
- 動作 pill `px-3 py-1` → `px-3 py-0.5`
- 時間欄加 `whitespace-nowrap`

**驗證**

同個 viewport 從原本 3 行擠到現在 8 行，無資訊損失。

---

## PART 1.5 — 第二輪改完的（DONE）

> 在 user 確認 5 個 open questions 後，依「最小最有感」順序施工的成果。

### ✅ 10. Chat 個人化稱謂與「已連線本地 ___」副標

**動到的檔案**
```
frontend/src/pages/Chat.tsx
frontend/src/hooks/useChatLogic.ts
frontend/src/i18n/locales/{zh-TW,en-US,ja-JP}.ts
```

**改動**
- Chat 歡迎詞 fallback 改成 `name → email split → t('common.user')`
- 標題下方加副標 `已連線本地 {{model}}`，從 `mainProps.selectedModel` 拉資料
- `useChatLogic.ts` 把 `selectedModel` 加到 `mainProps`（原本只在 `headerProps`）
- 三語新增 `chat.connectedToModel` 與 `common.user`
- 後端 `register` 函式原本就有 `display_name = request_body.name or request_body.email.split("@")[0]`，註冊時自動把 email 前綴當暱稱，使用者可在設定改

**驗證**：登入後 chat 顯示「有什麼我可以幫忙的，管理員？」+「已連線本地 Qwen2.5-7B-Instruct-Q5_K_M」副標。

---

### ✅ 11. Documents Onboarding 卡與範例檔下載

**動到的檔案**
```
frontend/src/pages/Documents.tsx
frontend/public/samples/sample-zh.md  （新檔）
frontend/public/samples/sample-en.md  （新檔）
frontend/public/samples/sample-ja.md  （新檔）
frontend/src/i18n/locales/{zh-TW,en-US,ja-JP}.ts
```

**改動**
- 在 `frontend/public/samples/` 新增三份範例 markdown，介紹 Corphia 平台與 RAG 流程
- Documents drop zone 副標多一個「下載範例檔試試看」連結，依 i18n 當前語言自動切到對應檔案
- drop zone 副標補「最大 50MB」字樣
- 文件數為 0 時，drop zone 下方顯示 3 張 onboarding 卡（01 上傳什麼 / 02 會發生什麼 / 03 怎麼用 RAG）
- 已上傳列表標題列加搜尋 input（檔名 fuzzy filter）+ 顯示「已過濾 / 總數」
- 列表空狀態與搜尋無結果有不同文案
- 三語新增 `documents` 整個 namespace

**驗證**：訪問 `/documents`，drop zone + 「下載範例檔試試看」link + 3 張 onboarding 卡完整呈現。

---

### ✅ 12. 稽核紀錄動作 pill 色彩 + Row Click Drawer

**動到的檔案**
```
frontend/src/pages/Admin.tsx
frontend/src/i18n/locales/{zh-TW,en-US,ja-JP}.ts
```

**改動**
- 加 `getActionPillClass(action)` 工具函式，依 action 名稱回傳：
  - 紅：刪除 / 停用 / 失敗 / revoke / disable
  - 綠：登入成功 / Token 刷新 / 啟用
  - 藍：建立 / 更新 / 註冊
  - 灰：其他
- 稽核表格 row 加 `onClick={() => setAuditDrawer(log)}` 開啟 right-side drawer
- Drawer 內容：時間、動作、資源、使用者、IP、描述、User Agent、payload JSON
- Drawer 用 framer-motion 從右側滑入，加 backdrop click 關閉
- import lucide `X` icon
- 三語新增 `admin.audit.detailEyebrow / detailDescription / detailUserAgent / detailPayload`

**Live tail 部分** deferred — 需要後端 WebSocket endpoint（`/ws/audit`），等下個 sprint。目前未動到後端。

---

### ✅ 13. Admin 系統頁即時 metric

**狀態**：原本就有 `<SystemMonitorPanel>` 在系統 section 第二排（CPU / GPU / VRAM / LLM 狀態），第一輪設計審視只截到上半就誤判為「全部靜態」。

**動到的檔案**：無（本就存在）

**驗證**：滑到 `/admin` → 系統 → 下半部 section title「即時健康監控 / Real-time Health」，展開 `SystemMonitorPanel` 即看到動態圖表。

---

### ✅ 14. Demo Mode（隱藏絕對路徑）

**動到的檔案**
```
frontend/src/store/uiStore.ts
frontend/src/pages/Admin.tsx
frontend/src/components/ui/SettingsModal.tsx
frontend/src/i18n/locales/{zh-TW,en-US,ja-JP}.ts
```

**改動**
- `uiStore.ts` 新增 `demoMode: boolean`、`setDemoMode`、`toggleDemoMode`，持久化
- `Admin.tsx` 新增 `sanitizePath(p)` 工具：demoMode 開啟時把絕對路徑壓縮成最後 1～2 段（如 `D:\\Antigravity\\on-premise_CorphiaAI\\AI_MODEL` → `on-premise_CorphiaAI/AI_MODEL`）
- 模型管理 section 的 eyebrow 改用 `sanitizePath(modelsDir)`
- SettingsModal 在 RAG Debug 開關下方加一個 Demo Mode toggle
- 三語新增 `settings.demoMode / demoModeHint / demoModeToggle`

**驗證**：設定 → 主題（最後）→ Demo Mode 開關 ON 後，admin 模型管理頁不再顯示 `D:\\...` 完整路徑。

---

### ⏸ 15. Settings Profile Sessions + 每日配額（DEFERRED）

**狀態**：本次未動。原因是這項需要：

1. 後端新增 `sessions` 資料表（user_id, refresh_token_hash, device_info, ip, created_at, last_activity_at）
2. 後端 alembic migration
3. 後端 refresh-token 流程改寫（從純 JWT 改成 DB-backed session）
4. 兩個新 endpoint：`GET /users/me/sessions`、`DELETE /users/me/sessions/{id}`
5. 前端 SettingsModal 個人資料 section 補 right column

工時估 6 小時、跨層多動，且 user 在 5 個 open questions 答 #4 是「先加加看」，所以列為下一輪 sprint。Plan 在本檔下方 PART 2 #5 還在。

---

## 第二輪整體 i18n 影響

zh-TW / en-US / ja-JP 三語都新增了下列 namespace 與 key：
- `common.user`
- `chat.connectedToModel`
- `documents.*`（dropZoneTitle / dropZoneSubtitle / downloadSample / uploadedTitle / searchPlaceholder / noMatch / empty / onboard1Title-3Desc）
- `settings.demoMode / demoModeHint / demoModeToggle`
- `admin.audit.detailEyebrow / detailDescription / detailUserAgent / detailPayload`

---

## PART 2 — 預計繼續（TODO）

按 design-scorecard.md 的 Top-5 順序排，估計每項實作時間。

### 🟡 1. Chat 個人化稱謂 + 模型選擇器搬位置（Top priority）

**動到的檔案（預估）**

```
frontend/src/pages/Chat.tsx
frontend/src/components/chat/ChatHeader.tsx
frontend/src/components/chat/ChatInputArea.tsx
frontend/src/i18n/locales/{zh-TW,en-US,ja-JP}.ts
```

**改動清單**

1. 歡迎 H1 從「有什麼我可以幫忙的，{role 翻譯}？」改成「有什麼我可以幫忙的，{user.name}？」（fallback 才用 role）
2. 增加副標一行「Corphia 已連線本地 {model.name}」（綁 `chatStore.currentModel`）
3. 把模型選擇器（目前在 ChatHeader 右上）整段搬到 ChatInputArea 左側 sparkle icon 旁邊；ChatHeader 該位置改放 conversation 標題或留空
4. 4 張提示卡 hover 時加 `hover:bg-accent/5 hover:scale-[1.02] transition`，icon 顏色從預設灰改 `text-accent`

**i18n key 新增**

- `chat.welcomeWithName`: `'有什麼我可以幫忙的，{{name}}？'` / `'How can I help you, {{name}}?'` / `'何かお手伝いできますか、{{name}}さん？'`
- `chat.connectedToModel`: `'已連線本地 {{model}}'` / `'Connected to local {{model}}'` / `'ローカル {{model}} に接続中'`

**估計**：1.5 hr（動到 layout 主結構與 i18n）

---

### 🟡 2. Documents 空狀態升級成 onboarding + 加控制列

**動到的檔案**

```
frontend/src/pages/Documents.tsx
frontend/src/i18n/locales/{zh-TW,en-US,ja-JP}.ts
```

**改動清單**

1. 空狀態：drop zone 下方加 3 張說明卡（icon + title + 一行描述）「能上傳 PDF/Word/Excel/TXT/MD」「上傳後會自動向量化、切 chunk」「對話開「專案」模式 RAG 自動引用」
2. 範例檔下載 link：用 GitHub raw 或專案內 `public/sample.pdf`
3. drop zone 副標補「最大 50MB · 目前已索引 N 個檔案 / X MB」（從 `/admin/stats` 拉資料或新增 `/documents/usage` API）
4. 控制列 sticky 在列表上方：搜尋 input + 檔案類型 multi-select filter + 排序 dropdown
5. 每個檔案 row 加可展開的 details，顯示 chunk 數、向量化耗時、最近被引用次數

**估計**：3 hr（含 API 串接 + 控制列邏輯）

---

### 🟡 3. 稽核動作 pill 色彩編碼 + Live tail

**動到的檔案**

```
frontend/src/pages/Admin.tsx
frontend/src/api/admin.ts            （或 wherever getAuditLogs 在）
frontend/src/i18n/locales/*.ts
backend (可能要加 WebSocket endpoint /ws/audit)
```

**改動清單**

1. 在 `Admin.tsx` 加一個 `getActionColor(action)` 工具函式：
   - 登入成功 / Token 刷新 → `bg-emerald-500/10 text-emerald-500 border-emerald-500/30`
   - 建立使用者 / 啟用使用者 → `bg-sky-500/10 text-sky-500 border-sky-500/30`
   - 停用使用者 / 刪除 → `bg-red-500/10 text-red-500 border-red-500/30`
   - 其他 → 原本灰色
2. pill 套色彩
3. row click 開 right-side drawer（用 framer-motion + portal），顯示完整 IP / user agent / payload JSON / before-after diff（後端要支援）
4. 頂部加 Live tail switch toggle；開啟時建立 WebSocket 連線到 `/ws/audit`，收到新事件後 prepend 到 `auditLogs` state
5. 後端：`backend/app/api/admin.py` 加 `@router.websocket('/audit/stream')`，pubsub 已有 audit log 寫入時 broadcast

**估計**：5 hr（前後端 WebSocket + drawer）

---

### 🟡 4. Admin 系統頁加即時 metric

**動到的檔案**

```
frontend/src/pages/Admin.tsx
backend/app/api/admin.py             （加 /admin/system/metrics endpoint）
backend/app/services/metrics.py      （新檔，psutil 蒐集）
```

**改動清單**

1. 後端新增 `GET /admin/system/metrics`，回傳 `{cpu_percent, memory_percent, gpu_memory_used_mb, gpu_memory_total_mb, active_requests, requests_per_minute, error_rate}`，用 `psutil` + `nvidia-smi`
2. 前端 `Admin.tsx` 系統 section：第一排維持靜態 metadata（Version / Backend / LLM Engine / Vector Store / DB / Runtime）；新增第二排：4 張 metric 卡，每張用圓形 progress + 數字
3. 用 `useEffect` 60 秒 polling，或改 WebSocket
4. 加一個 events feed 元件（垂直時間軸），抓 audit logs 中與系統有關的事件

**估計**：4 hr（後端 metrics + 前端圖表）

---

### 🟡 5. Settings Profile 加 Sessions 與每日配額

**動到的檔案**

```
frontend/src/components/ui/SettingsModal.tsx
frontend/src/api/users.ts
frontend/src/api/auth.ts
backend/app/api/auth.py
backend/app/api/users.py
backend/app/models/session.py        （可能要新建）
```

**改動清單**

1. 後端：JWT refresh token 改成記在 DB（一張 sessions 表，記 user_id, refresh_token_hash, device_info, ip, created_at, last_activity_at），讓 server 可以列出 active sessions
2. 後端 `/users/me/sessions` GET：列出該 user 所有 active sessions
3. 後端 `/users/me/sessions/{id}` DELETE：撤銷某個 session（強制該 refresh token 失效）
4. 後端 `/users/me/usage` GET：今日 token 消耗 + 每日配額（讀 `DEFAULT_DAILY_TOKEN_QUOTA` env）
5. 前端 `SettingsModal.tsx` 個人資料 section 右側補：
   - 「每日 Token 用量」progress bar
   - 「最近登入」相對時間
   - 「目前裝置」列表（icon + IP + 最近活動）+ 「登出其他裝置」按鈕

**估計**：6 hr（後端 sessions 表 + 兩個 API + 前端）

---

## 整體預估

| 項目 | 工時 |
|---|---|
| ✅ Part 1（已完成 9 項小修補） | -- |
| Part 2 #1 Chat 個人化 | 1.5 hr |
| Part 2 #2 Documents onboarding | 3 hr |
| Part 2 #3 稽核 Live tail | 5 hr |
| Part 2 #4 系統頁即時 metric | 4 hr |
| Part 2 #5 Profile Sessions | 6 hr |
| **TOTAL Part 2** | **~20 hr** |

依重要性 / 工時比，順序建議是 **#1 → #2 → #5 → #3 → #4**（先把每天會用到的 chat / documents 修好；再補 enterprise procurement 一定會問的 sessions / quota；最後是 admin 加分項）。

---

## Open questions（要 PM/PO 拍板才能繼續）

1. **Chat 歡迎稱謂** — 用 `name` 還是 `email split before @` 還是 nickname？三者都有 trade-off。
2. **Documents 範例檔** — 範例檔內容要中文還是英文？走 GitHub raw 還是 bundle 在 `public/`？
3. **稽核 row drawer 的 payload diff** — 後端目前 `audit_log` 是否有存 before-after JSON？沒有的話這個 feature 要先擴 schema。
4. **Sessions 表新增** — 要不要保留歷史 session（log table 一起當稽核 source）還是 active-only？
5. **Demo mode** — 模型管理那邊的 absolute path 要做 demo mode 隱藏嗎？這是 product strategy 不是設計題。

---

## 開啟 Antigravity 的 Suggested workflow

1. 開 `D:\Antigravity\on-premise_CorphiaAI`
2. 看 `design-review.md` 了解整體脈絡
3. 看 `design-scorecard.md` 看每個畫面評分與建議
4. 看本檔（`design-changelog.md`）Part 1 確認 9 項小修補的 diff 範圍
5. `git status` 應該會看到以下檔案被改：
   ```
   frontend/src/i18n/locales/zh-TW.ts
   frontend/src/i18n/locales/en-US.ts
   frontend/src/i18n/locales/ja-JP.ts
   frontend/src/pages/Documents.tsx
   frontend/src/pages/Login.tsx
   frontend/src/pages/Admin.tsx
   frontend/src/pages/Chat.tsx
   frontend/src/features/auth/components/AuthEngineScene.tsx
   frontend/src/features/auth/components/FloatingInput.tsx
   frontend/src/components/ui/SettingsModal.tsx
   frontend/src/components/chat/MessageBubble.tsx
   frontend/src/hooks/useChatLogic.ts
   frontend/src/store/uiStore.ts
   frontend/src/App.tsx
   ```
6. 建議 commit 訊息：`feat(ui): design review polish — i18n leak, theme system, login overlap, audit compact, KPI accent`
7. 接著挑 Part 2 的某一項開分支實作
