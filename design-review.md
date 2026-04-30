# CorphiaAI 前端設計審視

審視範圍：localhost:5173（Vite + React 19 + Tailwind + Zustand + i18next + react-router）。
路徑覆蓋：`/login`、`/`（Chat 空狀態與對話）、設定 Modal（Profile/Theme）、`/documents`、`/admin`（總覽 / 使用者 / 模型 / 稽核 / 系統）。淺色與深色模式皆有檢視。

> 截圖以 Chrome MCP `save_to_disk` 拍攝，inline 顯示於本次對話中（依時間順序：login→chat empty→model picker→conversation menu→conversation→settings profile→settings theme→admin users→admin overview→admin user list→admin audit→admin models→admin system→documents）。Chrome MCP 不會把檔案落到我能存取的工作區路徑，因此本報告以節錄描述代替「附件路徑」。

---

## 1. 整體調性

整體美感是「Apple/Linear/Claude.ai 中間值」：圓角偏大（rounded-2xl 級別）、淡淡的玻璃霧化感、極克制的色彩、Inter / 思源黑體系字。深色模式才是這套產品的主舞台 —— Login、Admin、Documents 在深色下呈現更高完成度（配合青銅色 accent 的暖光、裝飾性的 RAG/CORE/LLM 知識圖譜底圖），淺色模式像是把同一套層次直接降亮，相對偏「素」。

品牌色是一個低飽和的青銅／古銅色（程式碼裡 `THEME_COLORS` 確認大約 `rgb(137,110,83)`），被同時用在主要按鈕、品牌 logo、選中態強調，整體一致性很好。

---

## 2. Chat 主畫面

**空狀態（淺色）**：左側 Sidebar（一般／專案 tab、新對話按鈕、對話列表、底部使用者）+ 右側「有什麼我可以幫忙的，工程師？」+ 4 張提示模板卡（摘要文件 / 翻譯內容 / 撰寫 Email / 說明程式碼）+ 底部訊息輸入框 + 右上模型選擇器。是非常標準、克制的 ChatGPT/Claude.ai 派構圖。

做得好的地方：

- 提示模板卡片對 onboarding 很友善，2×2 排版重心穩定，icon + 標題 + 副標的層級清楚。
- Sidebar 以「一般 / 專案」做一級分類是亮點，比 ChatGPT 單一列表多一層組織彈性。
- 訊息輸入框的左側 sparkle icon 與右側送出鈕不搶戲，留白充裕。
- 模型選擇下拉同時顯示體積（2.3 GB / 5.1 GB）與量化等級（Q5_K_M），對地端部署的目標使用者非常合適 —— 這是一個會關心「我這顆卡跑不跑得動」的族群，把這資訊放在主入口很對味。

可以再磨的地方：

- **未翻譯的 i18n key**：「chat.promptTemplatesTitle」這個 key 在無障礙樹上以 button label 形式出現，雖然視覺看起來正確，但代表有部分文字是直接從 i18n raw key 渲染或被 a11y 暴露。檢查 `t()` 是否正確包裝、`fallbackLng` 是否在缺鍵時靜默退回。
- **使用者頭像在訊息泡泡中缺席**：AI 訊息有一個 `C·` 圓徽記，使用者訊息只有右對齊白色泡泡、沒有頭像。雙方都帶頭像會更平衡（或都不帶亦可，但目前不對稱）。
- **歡迎標題的個人化稱謂**：「有什麼我可以幫忙的，工程師？」直接用角色名（ENGINEER）當稱謂在中文語境下有點生硬。改抓 `name` 欄位（資料庫裡就是「工程師」/「Yuwan」這類）會更人味。
- **對話列表分組標題（「一般聊天」）**：字級偏小、灰度偏弱，跟列表項目缺少明顯的視覺距離。可加大 letter-spacing 或改用 uppercase micro-label 風格區隔。

**對話內（淺色）**：使用者泡泡右對齊、AI 回覆左對齊帶 `C·` 圓徽，間距充裕。沒看到時間戳、token 用量、複製/重新生成等次級操作；hover 時若沒有也建議補上 —— 這是現代 LLM Chat 的基本配備，特別是 admin 數字頁有顯示「訊息總數」、「審計追蹤」這些字眼，意味產品在意可追溯性，那就更該讓使用者自己也能看到該訊息的 metadata。

**Conversation hover 選單**：分享 / 重新命名 / 移至專案 / 刪除（紅字）。視覺乾淨、icon 一致、刪除用紅色提示，符合預期。

---

## 3. Settings Modal

**Profile**：左側分頁（個人資料、主題、語言、使用說明、關於 + 底部「管理後台」、「行動裝置掃描」）+ 右側內容區。「管理後台」與「行動裝置掃描」放在分隔線下方很對：它們不是「設定我這個帳號」而是「跳到別的功能」，在資訊架構上分得清楚。**ENGINEER** 用 pill 標籤呈現也很俐落。

「修改密碼」、「登出」並排，登出按鈕用紅色提示色但飽和度低、不嚇人 —— 拿捏得當。

可以再磨：

- 「個人資料」頁右下角空盪盪。建議塞配額（看 `.env` 有 `DEFAULT_DAILY_TOKEN_QUOTA=100000`）或最近登入時間，把這頁變得有「資訊密度」一點。
- 編輯名稱用 inline pencil icon 觸發、不開新畫面，非常好；但無障礙樹上 a11y label 是「修改名稱」，按下後行為描述應當提到「按 Enter 儲存／Esc 取消」之類的微提示。

**Theme**：兩張大卡片（淺色 / 深色，太陽 / 月亮 icon），下方「強調顏色」可自訂品牌色。佈局乾淨，但「跟隨系統」（System / Auto）模式缺席 —— 程式碼裡其實已監聽 `prefers-color-scheme`（App.tsx L63-70），等於自動同步系統，那就應該把這選項做成第三張卡片或預設策略，使用者才知道有這件事。

---

## 4. Login（深色模式）

這是整個產品「最有設計企圖」的畫面：

- 左側「歡迎使用 / Corphia 字標 / 三條 feature 列（智能問答系統 / 文檔深度剖析 / 本地部署隱私）」+ 中央 RAG/CORE/LLM/AUDIT/VECTOR/DOCS 知識圖譜環狀裝飾圖 + 右側登入卡（登入/註冊 tab 切換、Email/Password 浮動標籤、青銅色實心 CTA）。
- 左上 `● Backend: Online` 狀態徽章 → 一個地端 LLM 產品就該把後端心跳放在登入頁，這是面向工程師客戶的訊號，加分。
- 失敗訊息「帳號或密碼錯誤，剩餘 4 次嘗試機會」直接 inline 在密碼欄旁，沒有彈框，且把剩餘嘗試次數透明化 → 很 enterprise 的處理方式。

需要修的地方：

- **裝飾圖跟 feature 文字「ENTERPRISE KNOWLEDGE ENGINE」字樣會打架**：在某些尺寸下，左側 feature 欄底部那行小字 subtitle 與第三張卡「本地部署隱私」直接重疊，可讀性差。建議讓 SVG 裝飾圖加 `pointer-events: none` 並在背後加一層 backdrop blur 或暗色漸層遮罩，避免文字打架。
- **Inputs 的 placeholder 反差**：信箱、密碼欄位的 placeholder 在深色底上灰度太低，幾乎看不到「信箱 / 密碼」字。WCAG AA 需要 4.5:1，現況看起來介於 2:1~3:1，建議把 placeholder 至少調到 `gray-400`。
- **語言/主題 toggle 在右上**：兩個 icon 沒有 tooltip / aria-label（無障礙樹回傳的 button 沒有 accessible name），改鍵盤導覽時就很模糊。

---

## 5. Admin 後台

整個 `/admin` 在深色下表現非常成熟：

- **Header**：左側 `CORPHIA CONTROL` 微標 + 大標題「管理後台」+ 返回箭頭；右側「後端已連線」徽章 + 角色 pill。空間感舒適。
- **Sidebar**：「目前模型」卡片在最上方，下方是 `Qwen2.5-7B-Instruct-Q5_K_M` + 載入進度條。把「模型」放在左側 chrome 而非藏在頁面深處，是這產品定位的清楚表態。
- **總覽 KPI 卡**：4 張數字卡（使用者總數 / 對話總數 / 文件總數 / 訊息總數），每卡左上 icon、左下大數字、右下副標。視覺秩序好，但**所有 KPI 卡都同樣大小、同色背景**，意味使用者得花時間掃完才知道哪個重要。建議至少把「待處理 / 異常」類數據用 accent 高亮。
- **使用者管理表**：頭像（縮寫圓徽，色階一致是巧思）、姓名+email、角色 pill（ADMIN/ENGINEER/USER 三色微差別）、狀態（啟用 dot+標籤）、最後登入、編輯／刪除。資料密度與留白比例很舒服。
- **稽核紀錄**：頂部過濾「目標資源」+ CSV/JSON 匯出按鈕；下方表格 + 分頁（1/27）。匯出位置乾淨。表格列高（80px+）對 392 筆事件的場景有點奢侈，建議 compact 模式。
- **模型管理**：列出 gguf 檔案 + 大小 + 量化等級，「目前使用」用 pill 標示，右上「重新掃描」即時刷新檔案系統。對地端 LLM 完全對胃口。把實體路徑 `D:\ANTIGRAVITY\ON-PREMISE_CORPHIAAI\AI_MODEL` 直接顯示在頁面標題上方是個有趣的選擇 —— 對工程師客戶有用，但若 demo 給高層看會略顯「裸露」。
- **系統資訊**：Version / Backend / LLM Engine / Vector Store 四張 metadata 卡。乾淨。

整體 admin 的風格比 chat 主畫面成熟——應該是同一個團隊但把更多力氣花在 admin。

---

## 6. Documents

唯一的 rough edge 集中區。

- 頁首僅有「📁 文件」標題＋右上太陽 toggle，**沒有任何返回 chat 的入口**。使用者需要靠瀏覽器返回鍵或重新打網址，這是明顯的導覽斷層。Chat 與 Admin 都有 sidebar 或返回箭頭，Documents 沒有，IA 不一致。
- Drop zone 文字「拖放文件到此處，或點擊選擇」+「支援 PDF、Word、Excel、TXT、Markdown」配置正確，但虛線框邊緣灰度太低、hover/drag-over 狀態未明顯（沒測 drag-over，但靜態時邊緣幾乎隱形）。
- 「已上傳文件 (0)」與空狀態「尚無上傳的文件」，可考慮合併（卡片標題已經寫了 0，再寫一次「尚無」是冗餘）。

---

## 7. 視覺系統 / Design Tokens

從 `App.tsx` 看得出有把 accent 動態算對比文字色（luminance > 0.55 切黑/白）、把 CSS 變數 `--color-ios-accent-light/dark`、`--text-on-accent` 注入 root，並在主題切換時同步 `meta[theme-color]`、`meta[color-scheme]`、`html.background-attachment: fixed`。對 iOS Safari 的工具列顏色一致性是有意識在處理的——這代表產品有真心在乎 mobile PWA 體驗，但這次審視在桌面，看不到這層收益。

字型選擇：CJK 字重在 600/700 之間切換，標題與粗體 weight 對比夠強。英文標題（CORPHIA / RUNTIME / REMOTE ACCESS）用 spaced uppercase 做小標 → 是這套產品的個性特徵，建議在 chat 主畫面也酌量放一點，現在 chat 那邊太「白紙」。

---

## 8. 建議的優先順序

1. **修 `chat.promptTemplatesTitle` 漏翻 / a11y 暴露** — 這是 ship-blocker 級別的小 bug。
2. **Documents 頁加回到 Chat 的導覽** — 五分鐘工作，IA 一致性立刻變高。
3. **Login 裝飾圖與 feature 文字重疊** — 加 `pointer-events:none` + 漸層遮罩。
4. **訊息泡泡補 hover 操作（複製 / 重新生成 / token usage）** — 與 admin「訊息總數 / 審計追蹤」的可追溯性一致。
5. **加「跟隨系統」主題選項** — 程式碼已經做了一半，UI 補上。
6. **Login placeholder 對比度修到 WCAG AA**。
7. **Admin KPI 卡用 accent 高亮重點數字**。
8. **稽核紀錄 compact 列高**。

---

## 9. 一句話總結

這是一個以「地端 LLM、可審計、給工程師客戶看得舒服」為設計命題的產品，admin 與 login 已經可以直接拿去 demo，chat 主畫面骨架對但細節（操作層、文案個人化、a11y）還可以再加一輪 polish；Documents 是目前最弱的一環，需要先補導覽再談視覺。
