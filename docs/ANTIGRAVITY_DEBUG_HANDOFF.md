# Antigravity 聊天不回應問題 — Debug 交接文件

> 此文件用於將 Antigravity 桌面版「聊天區無回應」的除錯工作交接給下一位協助者（人或 AI）。
> 交接日期：2026-04-29

---

## 一、問題描述

Antigravity 桌面版聊天區送出訊息後，**API 全部回 200 OK**，但 **AI 完全沒有任何回應顯示**。
畫面空白，連錯誤提示都沒有。

---

## 二、環境

| 項目 | 內容 |
|---|---|
| 作業系統 | Windows 11 |
| Antigravity 版本 | 2026 年 4 月最新版（非 1.20.6） |
| 使用地區 | 台灣（**不在 Antigravity 官方支援地區**） |
| 測試模型 | Gemini 3.1 Pro (High)、Claude Sonnet 4.6 (Thinking)（兩者皆失敗） |
| 模式 | Plan |
| 工作專案 | on-premise_CorphiaAI |

---

## 三、已嘗試的修復步驟

### 步驟 1：DevTools 開啟與 Console 檢查
- DevTools 開啟方式：`Ctrl+Shift+P` → `Developer: Toggle Developer Tools`
- 初始狀態 Console：**10 errors / 15 warnings**

關鍵錯誤訊息：
```
[google.antigravity]: 功能表項目參考了 'commands' 區段中未定義的命令
  - antigravity.importAntigravitySettings
  - antigravity.importAntigravityExtensions
  - antigravity.prioritized.chat.open    ← 聊天命令未註冊！

Extension 'ms-python.vscode-python-envs' CANNOT USE these API proposals
[vscode.git]: 'title' 為必要屬性
```

### 步驟 2：A 方案 — 清理快取（部分有效）
在 `%APPDATA%\Antigravity` 重新命名以下資料夾為 `_bak`：
- `Cache`
- `CachedData`
- `CachedExtensionVSIXs`
- `Code Cache`
- `GPUCache`

**結果：** 錯誤計數從 10 降到 0，但聊天仍不回應。

### 步驟 3：換模型測試（排除模型問題）
- Gemini 3.1 Pro (High) → 不回應
- Claude Sonnet 4.6 (Thinking) → 不回應

**結論：** 與模型無關。

### 步驟 4：開新對話（解決舊對話狀態錯誤）
原本舊對話有此錯誤：
```
[consumeAgentStateStream] streamAgentStateUpdates error:
ConnectError: [unknown] agent state for conversation [UUID] not found
```

開新對話後此錯誤消失，但**仍然不回應**。

### 步驟 5：Network 分析
新對話送出訊息後 Network 紀錄：

| 請求 | Status | Type | Size |
|---|---|---|---|
| StartCascade (preflight) | 204 | preflight | 0.0 kB |
| StartCascade | 200 | fetch | 0.1 kB |
| StreamAgentStateUpdates (preflight) | 204 | preflight | 0.0 kB |
| StreamAgentStateUpdates | 200 | fetch | **1.1 kB**（懷疑為空殼回應） |
| SendUserCascadeMessage (preflight) | 204 | preflight | 0.0 kB |
| SendUserCascadeMessage | 200 | fetch | 0.1 kB |
| antigravityCascadeDone.mp3 | 200 | media | 55.9 kB |

「叮」的完成音效檔被下載並播放，但 UI 沒顯示任何 AI 回應。

---

## 四、★ 真因確認（最關鍵發現）★

在後續 Network 觀察到一個失敗請求：

```
Request URL:    https://127.0.0.1:59257/exa.language_server_pb.LanguageServerService/GetAgentScripts
Request Method: POST
Status Code:    500 Internal Server Error
Remote Address: 127.0.0.1:59257
```

**這個請求是打到本機（127.0.0.1）的 Language Server，不是 Google 雲端！**

### 真實流程重建
1. 訊息送到 Google → 200 OK ✓
2. Google 開始準備執行 Agent
3. Agent 需要呼叫**本機** Language Server 拿 `GetAgentScripts`
4. **本機 Language Server 回 500 → 整個流程在這裡斷掉**
5. Agent 沒有腳本可執行，直接結束
6. 前端「叮」音效照播（純時序事件，不代表真有回應）
7. 用戶看到畫面空白

### 為什麼這個結論成立
- 排除了模型問題（換 Claude 也壞）
- 排除了帳號問題（API 都回 200）
- 排除了對話狀態問題（開新對話也壞）
- 唯一持續失敗的是本機 LS 的 500 error

---

## 五、推薦下一步

### 立即驗證（尚未完成）
- [ ] 點開 Network 中 `GetAgentScripts` 那一列 → 切到 **Response/Preview** 分頁 → 看具體 500 錯誤訊息

### 修復方案優先順序

#### 方案 C（推薦）：退版到 1.20.6
- 已知穩定版本
- 多位用戶實測，4 月新版本身就有此 bug，重灌最新版無效
- 步驟：
  1. `appwiz.cpl` 解除安裝目前版本
  2. 下載官方簽名的 1.20.6 安裝檔
  3. 安裝完成後 → Settings → 搜尋 `update` → `Update: Mode` 設為 `none`

#### 方案 B：重新安裝最新版（可能無效）
若不希望退版，可先試重灌覆蓋。但根據社群回報成功率不高。

#### 方案 D：檢查本機環境
- 防毒軟體 / 防火牆是否擋了 `127.0.0.1:59257`
- Windows Defender 排除清單是否包含 Antigravity 安裝目錄
- 是否有其他程式佔用 59257 port（`netstat -ano | findstr :59257`）

#### 方案 E：換 Google 帳號（最後手段）
雖然 API 都 200 OK 看似帳號正常，但仍不能完全排除帳號被軟標記的可能。

---

## 六、相關背景資訊

### Antigravity 近期事件時間軸
- **2025-11-18**：Antigravity 發布（Google 收購 Windsurf 後的成果）
- **2025 年底~2026 初**：Pro/Ultra 配額大幅縮減
- **2026-01-15**：大規模封號事件
- **2026-02**：Ultra 用戶無預警永久封禁、跨區登入漏洞被修復
- **2026-04 新版本起**：聊天不回應、Agent execution terminated 錯誤大量回報
- **2026-04-19 起**：Google AI Developers Forum 出現大量類似問題回報

### 已知影響因素
- **地區封鎖**：台灣不在支援地區，但**這不是本案主因**（本機 LS 才是）
- **Plan 模式**：在 4 月版本回報有 bug
- **MCP Server `Context7`**：與 Antigravity 工具定義有衝突，會讓 Claude 模型崩潰

---

## 七、附件清單（建議一併上傳）

若有以下截圖請一併放入 repo：
- [ ] Console 初始 10 errors 的截圖
- [ ] Console 顯示 `agent state ... not found` 的截圖
- [ ] Network 分頁顯示所有 200 OK 但 UI 空白的截圖
- [ ] **GetAgentScripts 500 Internal Server Error 的截圖**（最關鍵）
- [ ] GetAgentScripts 的 Response 內容（待補）

---

## 八、給接手者的建議提問方式

可以這樣對下一位 Claude / 工程師說明：

> 「Antigravity 桌面版聊天區送訊息後不回應。已確認本機 Language Server 在
> `https://127.0.0.1:59257/.../GetAgentScripts` 回 500 Internal Server Error，
> 已試過清快取、換模型、開新對話皆無效。請協助查 500 的具體原因或執行退版到 1.20.6。」

附上本文件 + 第七節的截圖即可。
