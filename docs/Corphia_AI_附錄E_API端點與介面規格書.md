# 附錄 E：API 端點與後端介面完整規格書 (OpenAPI Specification)

本附錄提供 Corphia AI 系統後端（FastAPI）所有對外暴露之 RESTful API 端點與 WebSocket 節點的強制性介面契約（Interface Contract）。此文件可直接視為前端與後端協作時的系統地圖。

## E.1 認證與授權路由 (Authentication API)

### E.1.1 註冊新帳號
- **Endpoint**: `POST /api/v1/auth/register`
- **Rate Limit**: 5 次 / 分鐘 (基於 IP)
- **Request Body (JSON)**:
  ```json
  {
    "email": "user@example.com",
    "password": "SecurePassword123!",
    "name": "企劃部小明"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "id": "uuid-string",
    "email": "user@example.com",
    "name": "企劃部小明",
    "created_at": "2026-04-16T10:00:00"
  }
  ```
- **Error (400 Bad Request)**: `{"detail": "該電子郵件已註冊"}`

### E.1.2 登入獲取憑證
- **Endpoint**: `POST /api/v1/auth/login`
- **Request Format**: `application/x-www-form-urlencoded`
  - `username`: 信箱地址
  - `password`: 密碼字串
- **Security**: 失敗 5 次封鎖 15 分鐘。
- **Response (200 OK)**: 返還 `access_token` 與 `refresh_token`。

## E.2 對話與專案路由 (Conversation & Project API)

API 接需在 Headers 中夾帶 `Authorization: Bearer <access_token>`。

### E.2.1 獲取所有對話與專案夾
- **Endpoint**: `GET /api/v1/conversations/`
- **Response (200 OK)**:
  ```json
  [
    {
      "id": "conv-uuid-1",
      "title": "2026 年產品發佈問答",
      "settings": {"isProject": true, "folderName": "行銷部專案"},
      "created_at": "..."
    }
  ]
  ```

### E.2.2 創建新對話
- **Endpoint**: `POST /api/v1/conversations/`
- **Request Body (JSON)**:
  ```json
  {
    "title": "新對話",
    "settings": {"isProject": false}
  }
  ```

### E.2.3 獲取單一對話之歷史訊息
- **Endpoint**: `GET /api/v1/messages/conversation/{conversation_id}`
- **Response (200 OK)**:
  ```json
  [
    {
      "id": "msg-uuid",
      "role": "user",
      "content": "請幫我總結今年的財報",
      "sources": null
    },
    {
      "id": "msg-uuid-2",
      "role": "assistant",
      "content": "根據您上傳的資料，今年的重點為...",
      "sources": [{"title": "Q1_Report.pdf", "snippet": "..."}]
    }
  ]
  ```

## E.3 文獻與向量 RAG 路由 (Document Handling)

### E.3.1 上傳私有外部數據 (PDF/DOCX)
- **Endpoint**: `POST /api/v1/documents/upload`
- **Request Format**: `multipart/form-data`
  - `file`: 二進位檔案
  - `folder_name`: 對應的專案資料夾名稱
- **Response (200 OK)**: `{"detail": "文件已成功解析並進行 Embedding 向量化"}`

## E.4 即時推論與 WebSocket (LLM Stream Node)

### E.4.1 WebSocket 雙向訊息通道
- **Endpoint**: `WS /api/v1/ws/chat/{conversation_id}?token={access_token}`
- **Client (Browser) 傳送 Payload**:
  ```json
  {
    "type": "message",
    "content": "幫我解釋這段合約",
    "use_rag": true,
    "temperature": 0.7,
    "language": "zh-TW"
  }
  ```
- **Server 端逐字串流推播 (Streaming Yields)**:
  ```json
  {"type": "stream", "content": "這"}
  {"type": "stream", "content": "段"}
  {"type": "stream", "content": "合"}
  {"type": "stream", "content": "約..."}
  {"type": "done", "message_id": "uuid"}
  ```
- **Server 錯誤廣播**:
  ```json
  {"type": "error", "message": "模型伺服器無回應或超時。"}
  ```
