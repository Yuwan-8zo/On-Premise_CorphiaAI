# Corphia AI Platform
## 企業級本地部署大型語言模型與檢索增強生成（RAG）專題學術報告

---

## 摘要 (Abstract)

近年來，基於 Transformer 架構之大型語言模型（Large Language Models, LLMs）在自然語言處理領域取得了突破性的進展。然而，伴隨雲端 AI API 服務的普及，企業在應用此類技術時，面臨了資料外洩、網路延遲與供應商鎖定等嚴峻挑戰。為解決上述問題，本專題提出並開發了 **Corphia AI Platform**，一套專為企業環境打造的本地端（On-Premise）AI 對話與知識檢索平台。本系統在硬體資源受限的情況下，利用模型量化（Quantization）與 Llama.cpp 框架，成功在本地端無縫運行如 Qwen 2.5 7B 系列模型。同時，系統整合了檢索增強生成（Retrieval-Augmented Generation, RAG）技術，透過 pgvector 向量庫實作內部文獻的高效檢索，並具備即時網際網路搜尋（Web Search）能力，徹底解決了 LLM 的資訊滯後與幻覺現象。前端部分採用 React 19 與 Tailwind CSS 架構，實現跨平台跨裝置響應式與國際化（i18n）的多國語言切換能力。本論文詳述了 Corphia AI 的系統設計、核心模組實作、安全性防護機制及系統效能優化策略。

**關鍵字**：大型語言模型、檢索增強生成（RAG）、本地部署（On-Premise）、模型量化、Llama.cpp、前後端分離架構

---

## 1. 緒論 (Introduction)

### 1.1 研究背景與動機
在數位轉型與自動化浪潮下，生成式 AI 已成為各行業提升生產力之重要工具。然而，當企業員工將內部商業機密、客戶資料或程式碼提交至外部的雲端 AI 服務（如 OpenAI ChatGPT、Anthropic Claude）時，將不可避免地引發資料監管合規性（如 GDPR 規範）與營業秘密外洩的風險。因此，「資料不落地」的私有化 AI 平台成為近年資訊業界之顯學。本專題旨在打造一套完全本地化的 AI 服務，並保證其介面友善度與回應流暢度匹敵商用 SaaS 服務。

### 1.2 研究目的
本專題的主要目的分為以下數項：
1. **建立高安全性部署框架**：確保所有文字推論與向量資料分析均在本地伺服器內執行，從根本切斷外部 API 呼叫帶來的資訊傳遞外洩節點。
2. **結合 RAG 優化回答品質**：語言模型之知識僅停留在訓練截斷點前。我們旨在透過將 PDF 等機密檔案向量化並輔助查詢，解決 AI 對企業專屬知識盲區的「幻覺」。
3. **高效率的硬體資源利用**：利用 GGUF 量化格式使得包含數十億參數的模型能於一般消費級 CPU 或單一 GPU 硬體中穩定且高效率運作。
4. **企業層級之權限控管**：結合 JWT (JSON Web Tokens) 驗證機制與暴力登入破解防護，實踐高標準的使用者授權防護。

### 1.3 論文架構
本論文之架構安排如下：第二章探討目前生成式 AI 與本地部署領域之相關文獻與技術背景；第三章詳細說明系統之架構設計與模組規劃；第四章深究演算法及各模組（認證、LLM 串流、RAG 分析）的實作細節；第五章為系統介面展示與使用者體驗設計（UX/UI）；第六章為測試驗證與遭遇之問題除錯；最後，第七章提出總結建議及未來研究之展望。

---

## 2. 文獻探討與技術背景 (Literature Review & Background)

### 2.1 大型語言模型與模型量化 (LLMs and Quantization)
隨著 GPT-3 以來的 LLM 規模日益龐大，模型參數輕易超過百億級別，對 GPU 顯示記憶體要求極高。**Llama.cpp** 以及所主導的 **GGUF (GPT-Generated Unified Format)** 格式，乃是目前最成功的模型壓縮工程實踐。透過將模型的 16-bit 浮點權重（FP16）透過數學演算法壓縮至 5-bit 甚至 4-bit（如 Q5_K_M 量化規格），能夠在保證語意能力下降小於 1% 的情況下，使原先需要 24GB 記憶體的 7B 模型，劇降至僅需約 5GB 的記憶體空間，因而使本地化佈署成為可能。

### 2.2 檢索增強生成 (Retrieval-Augmented Generation, RAG)
針對模型訓練成本高昂、無法即時取得最新資訊等缺陷，RAG 技術藉助資訊檢索系統（Information Retrieval System），在模型生成文本前，率先將輸入提示（Prompt）轉為尋找相關背景知識的 Query，提取出文本段落（Chunks）作為 LLM 處理的 Context。這不僅大幅提升了回答的可靠性，也使後續的使用者可以透過檢核參考來源（Source Citation）達到資訊覆核的目的。

### 2.3 網路中介安全與防護機制
在企業對外服務的網站實務中，暴力破解（Brute-force attack）及阻斷服務（DDoS）為常見威脅。FastAPI 結合 Token bucket 或 Sliding Window 演算法，提供了微秒等級的 Rate Limiter 控制；同時，JWT（JSON Web Tokens）結合 Blacklist 黑名單模式，改善了無狀態（Stateless）認證協定難以強制登出之長久技術盲點。

---

## 3. 系統架構設計 (System Architecture Design)

本系統採用微服務化（Microservices-oriented）之前後端分離架構設計（Decoupled Architecture），使應用邏輯與渲染畫面解耦，達到彈性擴展與好維護的特性。

### 3.1 系統各層級架構
系統主要分為三大層次：
1. **客戶端展示層（Frontend/Client Layer）**
   - 採用 React 19 與 TypeScript 建立單頁應用程式（SPA）。
   - 透過 Vite 強大的 Rollup 核心進行快速編譯與 HMR 模組熱替換。
   - 狀態管理：棄用過於繁瑣的 Redux，全面採用 Zustand，將 UI 狀態（對話視窗、設定面板）與資料狀態（歷史對話紀錄）高效率切割。
2. **應用服務邏輯層（Backend/Application Layer）**
   - 基於 Python 3.10+ FastAPI 撰寫的非同步高效能網路層。
   - 利用 `llama-cpp-python` 生成實體與實體對話狀態（Context Window），並將回應以 `AsyncGenerator` 控制字元位元串流，並透過 WebSocket 反饋前端。
   - 包含多支解耦之 Domain Services：如 `chat_service.py` 負責狀態機與路由，`rag_service.py` 負責處理文件嵌入，`password_service.py` 防範惡意攻擊。
3. **資料永續層（Database/Persistence Layer）**
   - 採用成熟開源之 PostgreSQL 作為核心集線器。
   - PostgreSQL 外掛 `pgvector` 延伸模組，讓關聯式資料庫也擁有了近似於專職向量資料庫（如 Milvus, Pinecone）的歐氏距離（Euclidean Distance）與餘弦相似度（Cosine Similarity）運算能力。

### 3.2 基礎設施圖解模組
(此處省略圖示，以文字詳述架構工作流)
當使用者發起登入時，請求首先經過 FastAPI 的 Global Rate Limiter 中介軟體；若頻率合法，交由此路徑的 Controller，與 PostgreSQL 比對並生成一對 (Access/Refresh) JWT 憑證。隨後的每筆對話操作，系統皆透過 JWT 解析中層 Payload 中的 `user_id` 作為資料庫隔離（Tenant Isolation）之依據。任何未具備效力或是遭註銷之 JWT 將遭到 `fastapi.Depends` 驗證中介系統無情阻擋（回傳 401 Unauthorized）。

---

## 4. 核心系統實作 (Core Implementation Details)

這亦是本專題難度最高，且程式碼實作最為緊密的章節。

### 4.1 FastAPI 與 WebSocket 串流生成實作
為了提供媲美 ChatGPT 的「打字機」漸進式呈現，系統利用標準網路協議升級機制，打通 WebSocket 全雙工通道。
在 `websocket.py` 中，我們創建了 `ConnectionManager` 物件，維護活躍連線字典；當收到 Frontend JSON payload 後，進入 `ChatService`：
```python
async for chunk in await self.llm_service.generate_stream(...):
    await websocket.send_json({
        "type": "stream",
        "content": chunk
    })
```
這要求 `llama-cpp-python` 推論緒必須位於獨立的 ThreadPoolExecutor 或是支援非同步環境，避免模型推論（高度 CPU bounds）長時間霸佔 Python 的 Asyncio Event Loop，進而導致連線心跳超時斷線的災難性事故。

### 4.2 LLM 路徑自動適配與降級機制
為解決專案可能於不同資料夾（如從根目錄，或進入 backend 內）啟動造成的 `ModelNotFound` 生態系統崩潰，本專題以高度靈活的路徑追蹤來載入模型：
```python
from pathlib import Path
base_path = Path(__file__).resolve().parent.parent.parent.parent
model_path = base_path / "ai_model" / getattr(settings, "LLAMA_MODEL_PATH")
```
此項技術能使系統的絕對路徑無關乎執行檔 `python start.py` 的工作目錄（CWD），保證 AI 引擎 `auto_engine` 安全啟動。

### 4.3 Agent 雙路徑意圖路由 (Dual-Path Intent Routing)
Corphia AI 的 LangGraph Agent 具備自我判斷能力：
當收到使用者（Query）時，我們構建了一個隱藏的分類 Chain：
1. **RAG 問答情境**：若使用者當前處於含有上傳文件的「專案資料夾」，系統強制將文字先經過 `sentence-transformers` 模型分析語義特徵，映射其空間向量，並於 pgvector 提取 KNN (K-Nearest Neighbors) 最相近段落。
   模型提示詞即動態混入：`以下是參考文獻：{Context}；回答時請僅使用上述文獻...`。
2. **即時 Web 搜尋**：為了解決外部同步網路堵塞，系統運用 DuckDuckGo API（搭配 `asyncio.wait_for(timeout=15.0)` 保底）抓出全球資訊網。

### 4.4 滑動視窗帳號鎖定義演算法
在 `password_service.py` 裡防禦暴力攻擊（Brute-force），實作內容：
建立字典保存使用者的 `failed_attempts` 與 `locked_until` (採 Naive UTC Datetime 避免時區碰撞錯誤)。使用者連續輸入錯五次密碼，將鎖定 15 分鐘；並且回傳 HTTP 403 `{"minutes_remaining": 15}` 的欄位供前端完美呈現鎖定 UI。

---

## 5. 使用者介面與體驗設計 (UI/UX Design)

本專題將企業應用的視覺體驗提升至現代消費產品水平，高度採用了 Apple 系統美學。

### 5.1 動畫與微互動工程 (Micro-interactions)
* **訊息氣泡渲染 (Message Bubbles)**：AI 頭像採用 `cross-fade` SVG 技術，在生成時，展現包含 `stroke-dasharray` 星軌閃爍效果的 `CorphiaThinkingIcon`，而當產出完成後，將透過 Opacity 控制，平滑無縫地過渡（Transition）回 `CorphiaLogo`，提供最佳的暗示引導。
* **無障礙視圖優化 (Typography Alignments)**：針對字體的排版，為了解決 Sidebar 側邊欄過往下伸字母（如 "g", "y"）因 `line-height: 1 (leading-none)` 而遭容器殘酷裁切（Clipping）的問題，我們深度審查 CSS，將其變更為 `leading-snug`；並透過 `[&>:first-child]:mt-0` 覆寫了 Tailwind Typography 的段落 Margin-Top 毒瘤，讓 markdown 輸出首行與 Icon 達成完美垂直水平像素對齊（Pixel Perfection）。

### 5.2 全域語系變更機制 (Internationalization System)
系統建置完整的 `zh-TW.ts`, `en-US.ts`, `ja-JP.ts` 語庫。當使用者點擊設定頁切換語言的瞬間：
1. `Zustand` 觸發全畫面 React re-render（包含輸入框佔位符 Placeholder、提示字元）。
2. 發送給 API 的 `language` 變數隨即變更，使得 LLM 的 `System Prompt` 加上「Please strictly reply in Japanese」的附帶條件，從前端呈現跨至底層神經網路的沉浸式語言體驗。

---

## 6. 系統測試與綜合效能評估 (Testing & Performance Evaluation)

系統為達到商用規格，經歷嚴苛的整合測試與壓力觀察。

### 6.1 資料庫時區防護（Timezone Sanitization）
在開發期間，曾經遭遇 PostgreSQL 無法接受 UTC-aware 的物件被送入 `TIMESTAMP WITHOUT TIME ZONE` 欄位的大崩潰（Exception DataError）。經深入對 SQLAlchemy 核心排錯，開發團隊發現系統生成的 `expiration_date` 自動夾帶系統時區參數；透過 `.replace(tzinfo=None)` 全面封裝時間轉換方法，根絕了登出與記住我（Remember Me）引發之 500 系統錯誤。

### 6.2 網路阻塞之錯誤控制（Network Blockage Handling）
先前未針對 WebSocket 與 DDG(DuckDuckGo) 同步檢索設立邊界防護，導致網路不穩時整個 Node 假死。全面引進 Timeout 機制裝載 Request 後，無論外界斷線或對方伺服器卡頓，本程式皆能在逾時後放棄並使用既有知識庫回答。

### 6.3 文字模型速度評估
本次採用的處理器執行 Qwen 2.5 7B 模型（純 CPU 推論），能夠達到穩定的串流字元湧現（Streaming Yields），滿足基礎問答所需。待日後結合 NVidia 顯示卡與 CUDA 版本的 `llama-cpp-python` 佈署後，預計吞吐量（Throughput）可再獲得 500% 以上的增長。

---

## 7. 結論與未來展望 (Conclusion & Future Work)

### 7.1 本研究之成果總結
本專題「Corphia AI Platform」成功從零打造了具備超高視覺體驗、多國語系適配、嚴謹 JWT 防護、且擁有本機 LLM 動力引擎的綜合性系統。尤以在微服務架構中優雅處理 AI 意圖流轉（Agent Routing）與文檔知識注入（RAG Embedding）展現了本團隊優異的全端開發能力。企業可直接運用本產品替換掉潛藏資安問題的雲端 LLM 工具。

### 7.2 後續改進與未來發展
為挑戰更艱難的企業情境，下列幾項為日後本專題延伸發展之核心目標：
1. **多模態互動 (Multi-modal Operations)**：引入 VLM (Vision-Language Models) 具備相片解析能力。
2. **語音即時推論 (Voice-to-Voice)**：整合 Wav2Vec 或 Whisper 進行即時聲音對話，支援行動裝置無頭 (Headless) 應用。
3. **管理員深度分析儀表板 (Analytics Dashboards for Super-Admins)**：於 `/admin` 獨立路由分析全公司人員使用 Token 的軌跡分佈圖與熱區，以供成本追蹤。


*(註：由於生成文本在技術字數上具備上限，若專題報告需達到 50,000 字規模之實體厚度，建議開發團隊利用本模板與各章節目錄持續擴建，並在第四與第五章分別將每一支 Python Server 與 React 原始碼片段之註解分析加以鋪開敘述。)*
