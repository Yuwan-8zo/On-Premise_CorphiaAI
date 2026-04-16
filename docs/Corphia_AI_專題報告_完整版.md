# Corphia AI Platform - 企業級本地部署大語言模型與檢索增強生成系統：完整專案技術報告

## 第一章：專案概述與動機 (Project Overview & Motivation)

### 1.1 專案背景
隨著人工語言模型（Large Language Models, LLM）的爆發性成長，企業對於導入 AI 輔助生產力的需求與日俱增。然而，將機密資料傳送至公有雲 API（如 OpenAI ChatGPT、Anthropic Claude）存在嚴重的資料外洩風險。為了達成「資料不落地」且具備高度客製化與擴展性的目標，我們開發了 **Corphia AI Platform** —— 一套專為企業設計、完全本地化部署（On-Premise）的生成式 AI 平台。

### 1.2 核心目標與價值主張
本專案的核心目標在於打造一個安全、高效、且具備強大資訊檢索能力的私有化 AI 平台。
1. **資料隱私絕對安全**：透過本地部署開源模型（如 Qwen 2.5 7B Instruct GGUF），確保所有的企業對話、機密文件、商業數據皆在內部網路處理，完全不需要呼叫外部雲端 LLM API。
2. **結合 RAG（檢索增強生成）**：單純的 LLM 缺乏企業內部知識。系統整合了高維度向量庫與文件解析引擎，允許使用者上傳 PDF、DOCX、TXT 等文件，讓 AI 能夠針對特定企業資料庫給出精確、附帶來源引用的回答，消除 AI 幻覺（Hallucinations）。
3. **動態網路搜尋能力**：雖然是本地模型，但系統能透過後端整合 DuckDuckGo 搜尋引擎，實施安全可控的外部資料檢索。
4. **細緻的權限與專案管理**：提供完整的會員註冊、登入機制、以及 JWT 身份驗證，並且引入「專案資料夾」概念，讓不同業務邏輯或專案的對話紀錄能被有效隔離與管理。

---

## 第二章：系統架構與技術選型 (Architecture & Technology Stack)

### 2.1 系統總體架構 (System Architecture Overview)
Corphia AI 採用前後端分離（Decoupled Architecture）的微服務風格架構。
* **表現層 (Frontend Layer)**：負責處理使用者互動、動畫渲染、訊息串流顯示、以及多語系切換。
* **應用邏輯層 (Backend Layer)**：負責處理 HTTP 請求、WebSocket 串流、路由守衛、以及與 LLM 的推論互動。
* **資料持久層 (Data Layer)**：負責儲存使用者帳戶、對話歷史紀錄、向量化文件資料、以及系統操作稽核日誌。

### 2.2 前端技術選型 (Frontend Stack)
* **框架**：React 19 + TypeScript (Strict Mode)
* **建構工具**：Vite（提供極快的 HMR 與優化的生產環境構建）
* **樣式工具**：Tailwind CSS（支援 Dark/Light 模式快速切換、高度客製化的 Apple iOS 風格 UI）
* **狀態管理**：Zustand（輕量級、無樣板代碼的狀態管理，負責管理 UI 狀態、對話歷史與使用者設定）
* **國際化 (i18n)**：react-i18next（支援繁體中文 zh-TW、日文 ja-JP、英文 en-US 的即時動態切換）
* **Markdown 渲染**：React-Markdown 搭配 rehype/remark 插件，提供豐富的程式碼高亮與排版。

### 2.3 後端技術選型 (Backend Stack)
* **框架**：Python 3.10+ 與 FastAPI（非同步、高效能的 API 框架）
* **資料庫**：PostgreSQL 搭配 pgvector 擴充（處理關聯式資料與高維度文本向量）
* **ORM 框架**：SQLAlchemy (Async) 與 Alembic（資料庫遷移管理）
* **AI 推論引擎**：`llama-cpp-python`（支援 GGUF 格式的 LLM，並支援 CPU/Vulkan/CUDA 多重硬體加速平台）
* **RAG 實作**：LangChain / LangGraph 搭配自研代理路由（Agent Router）進行意圖識別與文檔檢索。
* **安全與認證**：JWT (JSON Web Tokens) Bearer Auth、Passlib (Bcrypt) 密碼雜湊。

---

## 第三章：核心功能模組深入分析 (Core Modules Analysis)

### 3.1 認證與安全性控制 (Authentication & Security)
安全性是企業級系統的基石，Corphia AI 具備多層次的綜合性安全防護。

#### 3.1.1 JWT 雙杖驗證機制 (Access/Refresh Token)
系統不僅僅使用單一 Token，更實作了完整的 Token 輪換防禦機制：
1. 使用者成功登入後，後端會簽發具備短時效性的 `AccessToken` 與長時效性的 `RefreshToken`。
2. 引入 **Token 黑名單 (Token Blacklist)** 設計的 `token_service.py`。當使用者登出時，剩餘有效期的 Token 會被紀錄進黑名單資料庫，徹底防止已註銷的 Token 被惡意攔截並重複使用 (Replay Attack)。
3. Token 中的 `expires_at` 屬性採用符合資料庫定義的 Naive DateTime (UTC)，避免時區混合造成的比較誤差。

#### 3.1.2 速率限制與防爆破機制 (Rate Limiting & Anti-Brute-Force)
在 `rate_limiter.py` 與 `password_service.py` 中，系統針對登入與註冊 API 進行了多維度限制：
* **IP 級別限制**：透過 FastAPI 中介軟體，使用滑動窗口演算法 (Sliding Window) 限制單一 IP 一定時間內的惡意高頻請求。
* **帳號鎖定演算法**：針對密碼猜測攻擊，系統引入了失敗次數計數。若連續輸入錯誤 5 次以上，該帳號將在記憶體與資料庫中被即時鎖定 15 分鐘，並透過 `minutes_remaining` 回應給前端進行體驗優化的錯誤提示。

### 3.2 大語言模型推論引擎 (LLM Inference Engine)
這部分是整個 Corphia AI 的核心，負責管理實體運算資源與模型記憶體。

#### 3.2.1 GGUF 模型載入與管理
專案使用 `llama-cpp-python` 作為底層引擎。該函式庫透過 C++ 綁定，能極大化優化量化模型（Quantized Models）在 CPU 與 GPU 上的執行效率。
* **自動路徑解析**：在 `llm_service.py` 內，我們實作了高魯棒性的相對路徑與絕對路徑相容性演算法。無論文是從 `start.py` 或是 `backend/` 根目錄啟動項目，系統都能透過 `Path(__file__).parent` 自動解析出 `ai_model/Qwen2.5-7B-Instruct-Q5_K_M.gguf` 的絕對路徑，解決了不同啟動 CWD 造成的 FileNotFoundError 問題。
* **硬體加速適配**：`auto_engine.py` 腳本能夠偵測系統環境（如 NVIDIA GPU 或 Intel CPU/Vulkan 平台），動態調整編譯參數。如遭遇驅動問題，系統具備優雅降級（Graceful Degradation）能力，主動切回純 CPU 模式的 Wheel 包，確保系統的絕對可用性。

#### 3.2.2 WebSocket 非同步串流生成
為了達到類似 ChatGPT 毫秒級的打字機效果，後端採用 `AsyncGenerator` 搭配 FastAPI 的 `WebSocket` 協定：
* 在接收使用者訊息後，系統觸發 LangGraph 解析意圖。
* 模型逐個 Token 生成時，`ChatService.send_message_stream` 方法透過 `yield { "type": "stream", "content": chunk }` 將片段即時回傳。
* 前端的 `ChatStore` 將接收到的 chunk 進行 state 變異，直接驅動 React 的 Virtual DOM 更新，實現平滑無比的字元流顯示。

### 3.3 檢索增強生成系統 (Retrieval-Augmented Generation, RAG)
為使模型具備內部知識，系統整合了完整的文檔向量化流程。

#### 3.3.1 文檔上傳與嵌入 (Document Embedding)
1. 使用者在「專案資料夾」中上傳 PDF。後端透過 `pdfplumber` 進行版面結構感知解析。
2. 進行 Chunking（文字分塊），並加入語義重疊保留（Overlap）防止斷句語意丟失。
3. 採用特定 Embedding 模型將文字轉化為高維度浮點數陣列。
4. 將向量與識別 Metadata (Tenant ID, Folder ID) 寫入 PostgreSQL 的 `pgvector` 表中。

#### 3.3.2 意圖識別與雙路徑檢索 (Intent Routing)
當使用者提問時，系統會啟動有狀態的 Agent 進行路徑判定（Routing）：
* **直接回答 (Direct Chat)**：模型判斷這只是普通的閒聊（如 "你好"），則繞過檢索階段減省資源。
* **內部 RAG 檢索**：若問題在專案資料夾內發起，Agent 會轉換為嚴格的 RAG 提示詞（Strict RAG System Prompt），強制模型「僅根據提供的來源文件回答」。
* **外部 Web 搜尋**：若判斷為對外部最新知識的需求，則非同步啟動 `_web_search_node`。
  * **超時保護 (Timeout Protection)**：為了防止外部網路不穩定阻塞整個非同步事件迴圈，我們使用 `asyncio.wait_for(..., timeout=15.0)` 包裝 DuckDuckGo 的同步 API 呼叫，極大程度提升了整體的服務容錯力（Fault Tolerance）。

---

## 第四章：前端使用者介面與體驗設計 (Frontend UI/UX Engineering)

在前端層面，Corphia 嚴格遵循現代化、高質感的設計語言，並實作了大量微互動（Micro-interactions）與防護機制。

### 4.1 蘋果 iOS 設計語彙 (Apple iOS Design System)
專案不使用普通的預設色彩，而是引入了高度客製化的 Tailwind 主題設置。
* 顏色矩陣包含深入還原 iOS 質感的 `ios-blue-light` (`#007aff`) 以及各層級的 `ios-light-gray1 ~ gray6` 與 深色對應色版。
* 圓角運用 `rounded-[20px]` 到 `rounded-[38px]`，並大量使用 Back-drop Blur (毛玻璃效果) 應用於 Modal 與側邊欄背景，使得介面具備通透質感。

### 4.2 動態跨漸變圖示渲染 (Icon Cross-Fade Animation)
在 AI 生成回應時，Corphia 實作了一套絕佳的視覺反饋動畫：
```tsx
const AIAvatar = ({ isStreaming }: { isStreaming: boolean }) => (
    <div className="relative w-8 h-8 flex-shrink-0">
        <span className="absolute inset-0 flex items-center justify-center transition-opacity duration-300" style={{ opacity: isStreaming ? 1 : 0 }}>
            <CorphiaThinkingIcon className="animate-draw-c" />
        </span>
        <span className="absolute inset-0 flex items-center justify-center transition-opacity duration-300" style={{ opacity: isStreaming ? 0 : 1 }}>
            <CorphiaLogo />
        </span>
    </div>
)
```
1. 思考期間：顯示具備 SVG `stroke-dashoffset` 軌跡描繪特效的藍色 Thinking Icon，並附帶 `pop-spark` 星芒閃爍，提供用戶系統正在運算的直觀感受。
2. 串流結束時：利用 CSS 的 `opacity` 過渡，優雅平滑地 Cross-fade 轉換回靜態的 Corphia Logo 標誌。
3. **字體基準線對齊修復**：透過為 `Tailwind Typography` 修改 `[&>:first-child]:mt-0`，並精確調整頭像的 margin `mt-[2px]`，解決了長久以來 Markdown 首段文字被推移導致與 AI 頭像沒有平行對齊的問題，達到像素級完美 (Pixel Perfect)。

### 4.3 側邊欄與無障礙文字排版 (Sidebar & Typography Accessibility)
側邊欄底部顯示當前登入使用者的區塊，在此前曾因為 Tailwind 的 `leading-none`（line-height: 1）屬性，導致英文尾巴（Descender）如 "g", "y" 被父容器 `overflow-hidden` 硬生生截斷。
透過深度除錯並更改為 `leading-snug`（line-height: 1.375），完美解決了文字截切的 Layout 問題；進一步確立了 UI 排版上的「Safe Area」認知。

### 4.4 國際化與語系綁定 (i18n Integration)
全系統支援動態語言熱切換，甚至貫穿到 LLM 的提示詞架構中。
* 介面上透過 `react-i18next` 提供的 `t()` 函數，使按鈕（例如 "新對話", "一般", "專案"）根據 localStorage 的語系動態渲染。
* 本次版本清理了散落在 `Chat.tsx` 內的所有硬編碼中文字串，補齊至 `zh-TW.ts`, `en-US.ts`, `ja-JP.ts` 字典檔。
* 對策上：前端改變語系不僅變換字體，更在發送請求給後端時附帶 `language` 參數。後端的 ChatService 會擷取該語言，並在 `system_prompt` 末端動態注入語言強制指令（Language Directive），例如：「強制使用繁體中文回覆」，從根本上解決了 LLM 跨語種回答的錯亂問題。

---

## 第五章：專案結構與模組目錄 (Project Structure & Organization)

Corphia 的程式碼結構遵循高內聚、低耦合原則，並嚴格遵循 Python 及 TypeScript 社群的最佳實踐規範。

### 5.1 Backend 目錄結構
```text
backend/
├── app/
│   ├── api/          # FastAPI 路由控制器 (conversations.py, messages.py, websocket.py, auth.py)
│   ├── core/         # 系統核心設定檔 (config.py, database.py, security.py, logging_config.py)
│   ├── models/       # SQLAlchemy 實體關聯模型 (user.py, conversation.py, document.py)
│   ├── schemas/      # Pydantic 驗證類別與 DTO 模型 (確保請求的安全性與結構化)
│   └── services/     # 業務邏輯封裝的核心層 
│       ├── chat_service.py     # LLM 狀態流轉與 LangGraph 邏輯
│       ├── llm_service.py      # llama-cpp 模型初始化與上下文推論
│       ├── rag_service.py      # 文件解析與 pgvector 相似度比對
│       └── password_service.py # 登入暴力破解防護
└── pyproject.toml    # 依賴管理
```

### 5.2 Frontend 目錄結構
```text
frontend/
├── src/
│   ├── api/          # Axios 實例配置與後端通訊 API (防禦 401/403 等全局攔截)
│   ├── components/   # UI 共用元件 
│   │   ├── chat/     # (MessageBubble.tsx, MarkdownRenderer.tsx, SourceCitations.tsx)
│   │   └── icons/    # SVG 客製化圖示原始碼
│   ├── i18n/         # 國際化語系 JSON/TS 翻譯檔案
│   ├── pages/        # 頁面路由視圖 (Chat.tsx, Login.tsx, Register.tsx, Admin.tsx)
│   ├── store/        # Zustand 狀態管理器 (uiStore, chatStore, authStore)
│   └── types/        # TypeScript 型別宣告，確保編譯期的靜態檢查
├── tailwind.config.js# 總體樣式配置、配色變數字典與 CSS 動畫定義
└── vite.config.ts    # 建構設定與 HMR 代理
```

---

## 第六章：測試與效能驗證 (Testing & Validation)

為了保證平台能在企業環境中長期穩定運行，我們進行了完善的邊界條件與自動化測試驗證。

### 6.1 發現與解決的隱性 Bugs
在深入代碼掃描（Deep Code Scan）期間，系統解決了以下數個會導致嚴重視誤的隱性錯誤：

1. **時區衝突問題 (Timezone Naive vs Aware)**
   * **問題**：`token_service.py` 在寫入 Token 黑名單時，呼叫 `datetime.now(timezone.utc)` 產生了附加時區的 aware object，但 PostgreSQL 欄位為 `TIMESTAMP WITHOUT TIME ZONE`，導致 SQLAlchemy 拋出型別錯誤的 Exception，進而造成使用者無法正常登出。
   * **解決**：在生成結束日期時強制呼叫 `.replace(tzinfo=None)`，精確對齊資料庫規格。

2. **例外吞噬問題 (Naked global exception trap)**
   * **問題**：`websocket.py` 中，發送訊息的 try 區塊結尾使用了不規範的裸露 `except:` 搭配 `pass`，它會靜默吞掉包含 `KeyboardInterrupt` 在內的所有系統錯誤，讓開發時無據可循。
   * **解決**：重構為 `except Exception as send_err:` 並接入標準 `logger.warning` 記錄，大幅提升系統可觀測性（Observability）。

### 6.2 自動化全系統整合測試 (E2E Integration Testing)
我們利用本地智能瀏覽器 Agent 跑完了所有的核心測試矩陣，全數通過驗證：
* **認證流程**：輸入空密碼、錯誤密碼均正常跳出預防爆破與計數的友善提示。註冊新帳號流程 Token 寫入 `localStorage` 一氣呵成。
* **介面操作**：使用者的設定面板（主題、語言切換）皆可以觸發順滑的彈出式動畫，iOS 狀態列顏色也可完美同步。
* **LLM 串流渲染**：發送問題後，從 Thinking 狀態的呼吸燈切換到模型實際回傳位元組串流的 Markdown 解析，過程流暢無任何阻塞。

---

## 第七章：總結與未來展望 (Conclusion & Future Outlook)

### 7.1 專案總結
**Corphia AI Platform** 已經成功轉化為一個強壯、美觀、高度自治的企業級產品。從後端底層利用 Llama.cpp 榨乾本地實體資源的推論極限、搭配 LangGraph 以及向量資料庫，實作了具備外部視野的 RAG 代理功能；到前端採用 Apple 現代設計準則實作流暢的圖示淡入淡出、文字排版與多語系動態切換，這套系統證明了「資料隱私」與「卓越的使用者體驗」是能夠兩全其美的。

### 7.2 未來演進方向 (Future Roadmap)
儘管系統已臻完善，面對未來爆炸式的 AI 需求，本平台提出了以下的技術演進藍圖：
1. **多模態接入 (Multimodal Integration)**
   引進 VLM (Visual Language Models) 支援圖片內容識別分析，並可考慮接入 Stable Diffusion 針對文本提示於本地端生成圖片。
2. **多租戶與企業管理強化 (Multi-Tenancy & Analytics)**
   擴展目前的 `Admin.tsx` 儀表板，提供用量統計、Token 計算、使用者行為熱區、模型微調介面（Fine-tuning management）。
3. **分佈式異步任務架構 (Distributed Asynchronous Queues)**
   面對巨量 PDF (如數百萬字的財報) 的上傳與 Embedding，未來計畫拆分獨立伺服器使用 Celery 或 RabbitMQ 處理耗時任務，保證主 FastAPI 程序的超低延遲回應。
4. **LLM 硬體再加速 (Hardware Acceleration Tuning)**
   未來版本將研發自動化設定工具，確保 `llama-cpp-python` 可以在佈署伺服器上完美預編譯 GPU 版（CUDA/Vulkan），突破 CPU 模式的速度天花板，達到每秒超過 50 Tokens 的閃電速度。

*(本報告由 Antigravity 智能體與使用者共同迭代編寫・技術實例結案)*
