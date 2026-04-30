# CorphiaAI 各畫面評分與具體改造建議

> 評分基準：5 分 = 能看，但離 production 還遠；7 分 = 可以 demo，但細節能看出粗糙；8 分 = enterprise-ready，少數環節可加分；9 分 = 設計師同行會點頭；10 分 = 拿去比賽會得獎。
>
> 評分維度：視覺層級 / 資訊密度 / 互動回饋 / 品牌一致性 / 可用性 / 可達性。各畫面以本次 walkthrough 觀察為依據（含已套用的修補後版本）。

---

## 1. Login（深色）— **8.5 / 10**

### 為什麼分數高
- Backend 心跳徽章 + Corphia wordmark + 知識圖譜環，開門就把產品定位（地端 / 工程師取向）講清楚。
- 登入卡 1:1 正方形 + 玻璃霧化是這套產品最有「設計企圖」的決定。
- 失敗訊息 inline 顯示「剩餘 N 次嘗試」是 enterprise 風格的微體貼。

### 還能加分的地方
- **沒有「忘記密碼」入口**。地端產品不一定要走 email reset，但至少要寫一句「請聯絡管理員重設」並 link 到 admin email；目前完全空白。
- 「跟隨系統」現在是預設，但 Login 頁右上的太陽 icon toggle 點下去其實只切 light/dark，不會跳到 system。Login 頁面對非登入使用者，主題切換建議拿掉（造成困惑：他都還沒登入，為什麼要記住他的主題？）。
- 知識圖譜環經過 radial mask 後位置略顯空洞——左下空白 200px×200px 還是太空。
- 鍵盤 Enter 提交表單的回饋（spinner inline）目前隱藏在按鈕中，可放更明顯一些。

### 具體改畫面
1. **登入卡下方**塞一條極小字：「初次使用 / 忘記密碼？聯絡 IT 管理員」+ 一個 mailto 連結。
2. **背景增加**第二層 SVG 漸變，從左下往右上，色調用 corphia-bronze 5% 透明度，把空洞補實。
3. **Backend 心跳徽章**右側增加 LLM Engine 狀態（等同 admin 系統頁的卡），讓登入頁就能看到「待機 / 載入中 / 就緒」。
4. **語言切換**改用 dropdown 顯示語言名稱「中 / EN / 日」三個圓鈕，比目前的「地球 icon → 點開選單」少一次點擊。

---

## 2. Chat 空狀態 — **7 / 10**

### 為什麼分數中等
- 4 張提示模板卡（摘要 / 翻譯 / Email / 程式碼）排版穩定。
- Sidebar「一般 / 專案」一級分類比 ChatGPT 多一層組織彈性。
- 訊息輸入框留白足、底部 sparkle icon 不搶戲。

### 為什麼不到 8
- 「有什麼我可以幫忙的，**工程師**？」直接用 ROLE 當稱謂在中文語境下生硬，應改用 `name`（如「Yuwan」）。
- 4 張提示卡的 icon 全用相同灰度 + 沒有 hover 變化，缺乏「點我」的暗示。
- Sidebar 的對話列表分組標題「一般聊天」字級太小（11px 灰色），跟列表項目幾乎沒有距離感。
- 模型選擇器在右上角，但畫面底下 chat input 才是主要操作區——使用者要切模型得抬頭，這個動線不順。

### 具體改畫面
1. **歡迎標題**：`有什麼我可以幫忙的，{user.name || user.email.split('@')[0]}？`，配合斜體小字副標「Corphia 已連線本地 Qwen2.5-7B」這種 LLM 狀態提示。
2. **提示卡 hover** 時用 `bg-accent/5 + scale-[1.02]` 給回饋；icon 顏色用 `text-accent`（青銅色）取代灰色，跟 admin 後台的 icon 處理一致。
3. **Sidebar 分組標題**改用 `text-xs uppercase tracking-[0.18em] text-text-muted` + 上下加 padding 8px，讓視覺切分更清楚。
4. **模型選擇器**從右上 header 移到 chat input 左側（sparkle icon 旁邊），跟模型相關的操作集中在輸入區。
5. **新增「最近使用模板」**區塊，5 個小 chip，比 4 大卡更省版面、又能個人化。

---

## 3. Chat 對話內 — **6.5 / 10**

### 為什麼這分
- ChatGPT/Claude.ai 風格泡泡：使用者右對齊 + AI 左對齊帶 `C·` 圓徽，留白舒服。
- AI streaming 時有 thinking 圖示淡入淡出，是巧思。
- Hover 操作（複製 / 編輯 / 重新生成 / token 用量）已加上，但**仍藏得太深**——`opacity-0 group-hover:opacity-100` 在觸控 / 鍵盤導覽上等於不存在。

### 扣分點
- **沒有時間戳**。即使 hover 也看不到「這則訊息何時送出」，跟 admin「審計追蹤」的可追溯性訴求矛盾。
- 使用者訊息**沒有頭像**，跟 AI 不對稱。
- AI 訊息的 markdown rendering 區塊**沒有「複製代碼」按鈕**在 code block 右上角（這是 LLM Chat 必備）。
- 連續 AI 訊息之間沒有 visual separator，內容多時容易黏在一起。

### 具體改畫面
1. **時間戳常駐**（不是 hover 才出現）：放在頭像下方，極小字 11px，灰度 0.5。同訊息流如果在同分鐘內可以省略。
2. **使用者頭像**：用 `<UserAvatar>` 元件，預設用名字首字 + 隨機（但 deterministic）背景色；尺寸跟 AI 的 C 圓徽一致。
3. **Code block 右上**用 absolute 放一個「複製」icon button，hover 整個 code block 時才浮現。
4. **連續 AI 訊息**間用 `border-t border-border-subtle/20 py-3` 分隔。
5. Hover toolbar 改用 `opacity-50 group-hover:opacity-100`（不是 0→100），提供持續的「這裡有東西可點」提示，特別是手機 / 觸控環境。
6. **Token 用量**目前是「123 tok」一個小數字，可加一個 hover tooltip 顯示「prompt: 100 / completion: 23」拆解。

---

## 4. Conversation 三點選單 — **8 / 10**

### 加分
- 4 個動作（分享 / 重新命名 / 移至專案 / 刪除）配 icon 一致，刪除用紅字。
- 半透明 backdrop blur 把後面 chat 模糊掉，焦點明確。
- 從清單外的 `...` 觸發，符合 Apple HIG 風格。

### 扣分
- 沒有快捷鍵 hint（如 `Cmd+Shift+R` 重新命名）。
- 「移至專案」沒有展開二層選擇——會是先點再看到專案列表？UX flow 沒測到。
- 動畫：彈出時太硬，缺 spring 效果。

### 具體改畫面
1. **每個項目右側**加 `<kbd>` 樣式的快捷鍵 hint（淺色 monospace）。例：分享 ⌘S、重新命名 F2、刪除 ⌫。
2. **「移至專案」**改成「→」展開二層 submenu，顯示專案清單 + 「+ 新建專案」。
3. **彈出**動畫加 `transition: spring damping=20`，從 trigger 點微微縮放展開。

---

## 5. 模型選擇器下拉 — **8 / 10**

### 加分
- 同時顯示體積（2.3 GB / 5.1 GB）+ 量化等級（Q5_K_M）對工程師友善。
- 「掃描最新模型庫…」有刷新 affordance。
- 已使用的項目用 ✓ 標記。

### 扣分
- 沒有顯示參數量（3B / 7B 已在名稱裡，但不一致）、context window、預估推理速度。
- 切換模型沒有「切換中…」過渡狀態，使用者會以為點了沒反應。

### 具體改畫面
1. **每個模型卡**多兩行 metadata：`Context: 4K · Quant: Q5_K_M · ~12 tok/s（預估）`。
2. **切換時**先 disable 整個下拉並顯示 spinner 2 秒，再關閉選單；同步在 chat header 顯示 toast「已切換至 Qwen2.5-7B」。
3. **加一個「自動」選項**——根據 prompt 長度自動選 3B/7B（地端產品的 killer feature）。

---

## 6. Settings — 個人資料 — **7 / 10**

### 加分
- ENGINEER pill 形式俐落。
- 「修改密碼」與「登出」並排，登出用淡紅色（不嚇人）拿捏剛好。
- 編輯名稱用 inline pencil icon。

### 扣分
- **右側空盪**——Profile 頁有 1/3 空間沒用到。
- 沒有顯示重要 metadata：每日 token 配額（`.env` 有 `DEFAULT_DAILY_TOKEN_QUOTA=100000`）、最近登入、帳號建立日。
- ROLE pill 點不開——其實角色用 admin 後台改，這沒錯，但缺少「跟管理員申請角色升級」的入口。

### 具體改畫面
1. **右側補 metadata 卡**：今日已用 token / 配額（progress bar 用 accent）、最近登入時間、帳號建立日、最近活動數量。
2. **角色 pill** 旁加「請求變更」icon 連結到 mailto: 管理員 email。
3. **加一個 Sessions 區塊**：列出目前所有 active session（裝置 / IP / 上次活動），給「登出其他裝置」按鈕——這是 enterprise 必備。

---

## 7. Settings — 主題（已改造後）— **9 / 10**

### 加分
- 3 張卡（淺色 / 深色 / 跟隨系統）+ accent 顏色 picker。
- 「跟隨系統」用半邊太陽半邊月亮 mockup，視覺即文字。
- 選中態用 accent 邊框 + ring，清楚。

### 扣分
- 卡片裡的 mockup 是抽象 sun/moon，**沒辦法看出實際 app 在該主題下長什麼樣**。
- accent 顏色 picker 只有一個圓圈 + 文字「點擊選擇自訂品牌主題色」，沒有預設色 palette（如 5 個推薦色：青銅、墨藍、墨綠、酒紅、深紫）。

### 具體改畫面
1. **每張主題卡**裡的 mockup 換成迷你 app preview（簡化的 sidebar + chat bubble + button），讓使用者看到實際效果。
2. **Accent 顏色**加 5 個 preset chips（一鍵套用），下方再放自訂 picker。每個 chip 直接用該顏色填色 + accent name，例：`Bronze` / `Indigo` / `Forest` / `Crimson` / `Plum`。
3. 「跟隨系統」下方多一行極小字寫「依 prefers-color-scheme 自動切換」，把 hint tooltip 的內容直接放出來。

---

## 8. Documents（已改造後）— **6.5 / 10**

### 加分
- 加了返回箭頭，IA 一致性問題解掉。
- Drop zone + 已上傳列表的兩欄結構乾淨。

### 扣分
- **空狀態太單薄**——`已上傳文件 (0)` 卡 + 「尚無上傳的文件」一句，沒有引導 / 範例。
- Drop zone 在靜態時邊緣灰度太低（虛線快看不到），drag-over 有 active 樣式但 hover 沒有。
- 沒有上傳檔案大小限制提示（`.env` 有 `MAX_UPLOAD_SIZE_MB=50`）。
- 沒有檔案篩選 / 排序 / 搜尋。

### 具體改畫面
1. **空狀態**改成 onboarding 引導：3 張小卡解釋「什麼能上傳 → 上傳會發生什麼 → RAG 怎麼用到它」，配合範例檔（「下載一份範例 PDF 試試」）。
2. **Drop zone hover**：`hover:border-accent/60 hover:bg-accent/5`，drag-over 用更深的 accent，把這兩個狀態做出層次。
3. **Drop zone 副標**加「最大 50MB」限制 + 顯示後端目前檔數與容量總計。
4. **列表上方** sticky 一條控制列：搜尋 input、檔案類型 filter（PDF / DOCX / XLSX / TXT / MD）、排序（時間 / 大小 / 名稱）。
5. **每個檔案 row** 加可展開的 details，顯示已索引的 chunk 數、向量化耗時、最近被引用次數（這些都是 RAG debug panel 已有的資料）。

---

## 9. Admin — 使用者管理 — **8 / 10**

### 加分
- 表格 row 高度 + 留白舒服（admin 主畫面不能太擠）。
- 角色 pill 三色（ADMIN / ENGINEER / USER）微差別。
- 啟用狀態用 dot + 文字。

### 扣分
- 上方沒有搜尋 / 篩選——7 個使用者還能用眼睛找，70 個就完蛋。
- 沒有 bulk actions（批次停用、批次改角色）。
- 「最後登入」顯示絕對時間（04/29 下午 06:23），但 admin 比較關心相對時間（「3 天前」）。
- 編輯 / 刪除按鈕在每個 row 都顯示，視覺擁擠；常用模式是 hover 才出現。

### 具體改畫面
1. **表格上方** sticky 一條工具列：搜尋（信箱 / 名字）、角色 filter、狀態 filter、`+ 新增使用者`。
2. **每個 row 左邊**加 checkbox，選取後上方 toolbar 變成「批次停用 / 批次改角色 / 批次重置密碼」。
3. **「最後登入」**改成 `<RelativeTime>` 元件：「3 天前 / 剛剛 / 30 分鐘前」，hover 顯示絕對時間 tooltip。
4. **編輯 / 刪除**用 `opacity-0 group-hover:opacity-100`，預設只看到資料、hover row 才浮現操作。
5. **角色 pill** 點下去打開角色選擇 popover，省一次 modal。

---

## 10. Admin — 總覽（已改造後）— **8.5 / 10**

### 加分
- 4 KPI 卡 + 1 張 primary 高亮的 accent 處理。
- Ngrok 公開網址 panel 是這個產品獨有的細節（地端 + 偶爾 demo 給外部）。

### 扣分
- KPI 卡的數字很大，但**沒有趨勢**（昨天 vs 今天、過去 7 天 sparkline）。
- 「使用者總數 7 / 活躍 5」副標「即時工作區 / 審計追蹤 / 已索引來源」這些註解寫得很詩意但**對 admin 沒實用資訊**。
- 沒有時間範圍切換（這些數字都是 all-time，看不出近況）。

### 具體改畫面
1. **每張 KPI 卡** 在右下角加迷你 sparkline（recharts 已可用），顯示過去 14 天趨勢。
2. **副標**改寫成有資訊量的：「使用者 7（5 活躍 / 2 停用）」、「對話 18（過去 7 天 +12）」、「文件 0（尚未啟用 RAG）」、「訊息 76（平均每日 4.2）」。
3. **頁面右上**加時間範圍切換（今日 / 過去 7 天 / 過去 30 天 / 全部），切換時 KPI + 圖表跟著變。
4. **Ngrok 卡片**直接放在 KPI 卡同列當作第 5 張卡（「公開存取」），數字顯示「線上 24h / 已開 3h」這種 uptime 指標。

---

## 11. Admin — 稽核紀錄（已改造後）— **8 / 10**

### 加分
- 已縮減 row 高度，一個 viewport 從 3 行變 8 行。
- CSV / JSON 匯出按鈕位置乾淨。
- 363 筆事件 + 1/25 分頁顯示。

### 扣分
- **動作欄沒有色彩編碼**：登入成功 vs 停用使用者 vs Token 刷新——所有 pill 都是同色，掃讀困難。
- 沒有 row click 看 detail（IP, user agent, payload, 修改前後 diff）。
- 沒有 real-time tail（Live tail switch）——這是稽核工具的標配。
- 搜尋 input 寫「信箱、操作或描述...」但動作類型已有單獨 dropdown，搜尋欄能否搜「動作」邏輯不一致。

### 具體改畫面
1. **動作 pill 色彩**：登入成功 / Token 刷新 = 綠；建立使用者 / 啟用 = 藍；停用 / 刪除 = 紅；其他 = 灰。
2. **點 row** 開 right-side drawer 顯示 metadata：完整 IP / user agent / payload JSON / 對應 user / link 到該使用者 detail。
3. **頂部加 Live tail switch**：開啟後 WebSocket 訂閱新事件，每 1 秒前置插入新 row（高亮 1 秒淡出）。
4. **搜尋邏輯**改寫：把搜尋限制在 user_email + description；動作和資源類型只走 dropdown filter。
5. **匯出按鈕**加進度條（10000 筆事件匯出可能要幾秒）。

---

## 12. Admin — 模型管理 — **8.5 / 10**

### 加分
- 顯示路徑 `D:\ANTIGRAVITY\ON-PREMISE_CORPHIAAI\AI_MODEL` 對地端工程師友善。
- 列出檔案 + 大小 + 量化等級 + 「目前使用」pill。
- 「重新掃描」即時刷新檔案系統。

### 扣分
- 沒有「下載新模型」入口（模型管理應該也能拉新模型，不只切換）。
- 沒有 GPU memory 估算（地端 LLM 最關心的問題：我這顆卡跑不跑得動 7B？）。
- 沒有顯示推理速度（tok/s）歷史。
- 顯示的本機路徑可能讓非工程師客戶感到「裸露」，建議在 demo mode 隱藏。

### 具體改畫面
1. **頁面右上** 加「+ 下載模型」按鈕，開 modal 顯示 HuggingFace gguf 推薦列表（Qwen / Llama / Mistral / Phi 等系列），可選量化等級下載，下載中顯示進度條 + 預估時間。
2. **每個模型卡**右側加 GPU memory 估算 chip：「需 ~6 GB VRAM」，根據 quant + size 計算。
3. **目前使用的模型卡**展開顯示推理速度 sparkline（過去 100 次推理的 tok/s）。
4. **路徑顯示**加一個「複製」icon，點了複製到剪貼簿；可選「Demo 模式」設定隱藏絕對路徑。

---

## 13. Admin — 系統資訊 — **7 / 10**

### 加分
- 6 張 metadata 卡：Version / Backend / LLM Engine / Vector Store / Database / Runtime。
- icon + 標題 + 值的層級乾淨。

### 扣分
- **全部是靜態文字**——這頁應該是 admin 最該看到「即時健康」的地方。
- 沒有 CPU / RAM / GPU 用量。
- 沒有 request rate / error rate。
- 沒有近期 deployment / restart 紀錄。

### 具體改畫面
1. **第一排** Version / Backend / LLM Engine 維持靜態 metadata。
2. **第二排換成即時 metric**：CPU usage（圓形 progress + 數字）、RAM usage、GPU memory、active requests/min。每個用 60 秒 polling 或 WebSocket 更新。
3. **加一個 events feed**：服務啟動時間、最近一次 restart、最近一次 model swap、最近一次 backend error。
4. **底部加 health check 結果**：DB ping、ngrok 連線、LLM 推理測試（送個 hello world 看是否正常返回）。

---

## 整體優先順序（如果只能改 5 個地方）

1. **Chat 主畫面個人化 + 模型選擇器搬到輸入區**（影響每個使用者每天）。
2. **Documents 空狀態 onboarding + 控制列**（產品的核心功能 RAG 入口）。
3. **稽核動作 pill 色彩編碼 + Live tail**（稽核可用性對 enterprise 銷售直接加分）。
4. **Admin 系統頁加即時 metric**（地端產品最該秀的「我跑得很穩」）。
5. **Settings Profile 加 Sessions 與配額卡**（enterprise 客戶在 procurement 流程一定會問）。

---

## 整體加權平均：**7.7 / 10**

```
Login           8.5  ████████▌
Chat 空         7.0  ███████
Chat 對話       6.5  ██████▌
Hover 選單      8.0  ████████
模型選擇        8.0  ████████
Profile         7.0  ███████
主題            9.0  █████████
Documents       6.5  ██████▌
使用者管理      8.0  ████████
Admin 總覽      8.5  ████████▌
稽核            8.0  ████████
模型管理        8.5  ████████▌
系統資訊        7.0  ███████
─────────────────────────────
平均            7.7  ███████▋
```

**結論**：admin 後台 + 主題設定 + Login 已經達到 enterprise demo 等級，**Chat 對話內 與 Documents 是兩個拖後腿的房間**——剛好都是「使用者每天都會用」的核心區。建議下一輪 sprint 把這兩塊先整修到 8 分，整體就能拉到 8.2 以上。
