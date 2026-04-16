# 附錄 B：架構與通訊協定設計規範 (Architecture & API Spec)

為滿足企業級產品的要求，Corphia AI 具備了高度結構化的資料庫流與 API 節點設計。本附錄詳細列舉了專案中涵蓋的核心資料表、以及在前後端通訊中使用的規範與協定模型。本章節具備強烈的系統架構學意義，為專題報告不可或缺的技術細節。

## B.1 資料庫關聯模型設計 (Database Entity-Relationship Model)

在 PostgreSQL 體系下，我們設計了以 User 為核心，輻射至 Conversation, Message, 以及 Document（向量資料）的龐大 ER 模型。

### B.1.1 Users (使用者層)
使用者表是權限控管與資料隔離（Isolation）的最高指導實體。
- `id` (UUID, Primary Key)：採用對時間相對隨機的 UUIDv4，避免自增長整數造成的業務量外洩風險。
- `email` (VARCHAR, Unique)：系統帳號主鍵。
- `hashed_password` (VARCHAR)：經由 bcrypt 加密雜湊的 60 字元長度金鑰。
- `last_login_at` (TIMESTAMP)：採用 Naive UTC 時間儲存，每次成功獲取 Access Token 時更新。

### B.1.2 Conversations (對話層)
對話表用來實作「專案資料夾」的樹狀結構展示與隔離。
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key) -> `users.id`
- `title` (VARCHAR)：對話名稱（例如 "2026 Q1 財報分析"）。
- `settings` (JSONB)：PostgreSQL 特有的二進位 JSON 格式，我們利用它來儲存高彈性且無固定 Scheme 的資料。例如：
  `{"isProject": true, "folderName": "財務部", "system_prompt_addition": "強制輸出繁體"}`

### B.1.3 Messages (訊息實體層)
所有的問答歷史紀錄。
- `id` (UUID, Primary Key)
- `conversation_id` (UUID, Foreign Key) -> `conversations.id`
- `role` (ENUM: 'user', 'assistant', 'system')
- `content` (TEXT)：Markdown 格式的文字。
- `created_at` (TIMESTAMP)

### B.1.4 Documents & Embeddings (向量擴充層)
與 `pgvector` 深度結合的 RAG 核心底層表。
- `id` (UUID)
- `folder_name` (VARCHAR)：標記該檔案歸屬的資料夾（如 "財務部"）。
- `chunk_text` (TEXT)：經過 500 tokens 切割後的純文字段落。
- `embedding` (VECTOR)：`[1536]` 維度的浮點數陣列映射特徵。此欄位被建立了 HNSW (Hierarchical Navigable Small World) 索引，確保高維度的最近鄰搜尋延遲能維持在數十毫秒內。

## B.2 FastAPI RESTful 核心介面規範

為了確保前端 React 或是未來的行動端 App 能夠完美接軌，所有的存取點皆嚴格遵守 OpenAPI 3.0 與 REST 規範。底下解析核心通訊。

### B.2.1 JWT 無狀態授權認證 (Login & Auth)

**`POST /api/v1/auth/login`**
* **業務邏輯**：接受 `OAuth2PasswordRequestForm` (Form Data)，核對 bcrypt 密碼池。若符合，簽發含有時間戳 (`exp`) 與用戶特徵 (`sub`) 的 JWT。
* **安全性防護**：若錯誤達到 `MAX_FAILED_ATTEMPTS = 5`，觸發 HTTP 403 Forbidden 並攜帶 `{"detail": "帳號已鎖定", "minutes_remaining": 15}`。
* **回傳模型**：
```json
{
  "access_token": "eyJhbG...",
  "refresh_token": "eyJhbG...",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "email": "user@company.com",
    "name": "Local User"
  }
}
```

**`POST /api/v1/auth/logout`**
* **業務邏輯**：接受使用者的登出請求，解析 HttpHeader 中的 `Authorization: Bearer <token>`。提取 Token 中的到期時間，將整把字串寫入 `token_blacklist` 資料表中，徹底廢棄。

### B.2.2 WebSocket 雙向串流通道 (Context Stream)

**`WS /api/v1/ws/chat/{conversation_id}`**
* **協定升級**：前端透過標準 `Upgrade: websocket` 發起連線。
* **身分鑒權**：由於 WebSocket 標準無法在 Browser 自訂 Header 夾帶 JWT，我們實作了透過 `query param` (`?token=...`) 或是在初次發出特定格式的握手封包來進行身分稽核。
* **狀態機流轉 (State Machine Lifecycle)**：
  1. Frontend 發送：`{"type": "message", "content": "你好", "use_rag": false}`
  2. Backend 收到後阻斷其餘操作，交予 LangGraph Agent 處理。
  3. Backend 產出第一個 Token 即觸發 Generator 回傳：`{"type": "stream", "content": "你"}`
  4. 迴圈執行第三步直至模型輸出 `<|im_end|>` 或 `[DONE]` 標記。
  5. 寫入資料庫 Messages。

## B.3 RAG 檢索相似度演算法深度解析 (Vector Math)

在處理 RAG 文件檢索時，我們選用了餘弦相似度（Cosine Similarity）而非歐氏距離（L2 / Euclidean Distance）。其數學意義如下：

給定兩個向量 $A$ 與 $B$（在此專案中為維度極高的 `[0.12, -0.05, ...]` 陣列）：
$$ \text{Cosine Similarity}(A, B) = \frac{A \cdot B}{||A|| \times ||B||} = \frac{\sum_{i=1}^n A_i B_i}{\sqrt{\sum_{i=1}^n A_i^2} \sqrt{\sum_{i=1}^n B_i^2}} $$

* **為何選擇餘弦？** 因為在自然語言處理的 Embedding Space 中，兩句話的方向代表語意的相近程度；而長度（Magnitude）往往僅代表字詞頻率或文件長度。透過歸一化（Normalization），餘弦相似度能在不受文件字數的絕對長度影響的狀態下，精確比對「問題（Query）」與「知識段落（Chunk）」間的主題重合度。
* **在 pgvector 的實作**：
  使用運算子 `<=>`：`SELECT * FROM document_embeddings ORDER BY embedding <=> '[0.1, 0.2, ...]' LIMIT 5;` 
  透過此 SQL 原生運算指令，我們得以將複雜的數學矩陣運算轉嫁並交由資料庫引擎層底層在 C 語言層級高速處理，遠超在 Python `numpy` 或迴圈中手動計算的速度。
