# 🤖 Corphia AI Platform v2.2

企業級私有部署 AI 問答系統 - ChatGPT 替代方案

## ✨ 核心特色

| 特色 | 說明 |
|------|------|
| 📚 RAG 知識問答 | 基於企業內部文件的問答，提供來源追溯 |
| 🏢 多租戶支援 | 完全隔離的多組織資料架構 |
| 🔐 三層權限 | Engineer / Admin / User 細粒度控制 |
| 🏠 100% 地端 | 資料不外流，完全掌控 |
| 🌏 多語言 | 繁中 / 英文 / 日文介面 |

## 🛠️ 技術棧

### 後端
- Python FastAPI
- SQLite + ChromaDB
- llama.cpp (GGUF 模型)
- JWT 認證

### 前端
- React 19 + TypeScript
- Vite + Tailwind CSS
- Zustand + react-i18next

## 🚀 快速開始

### 1. 複製環境設定
```bash
cp .env.example .env
```

### 2. 放入 AI 模型
將 GGUF 模型檔案放入 `ai_model/` 目錄，並更新 `.env` 中的 `LLAMA_MODEL_PATH`

### 3. 啟動後端
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 4. 啟動前端
```bash
cd frontend
npm install
npm run dev
```

### 5. 開啟瀏覽器
http://localhost:5173

## 👥 預設帳號

| 角色 | Email | 密碼 |
|------|-------|------|
| Engineer | engineer@local | Engineer123! |
| Admin | admin@local | Admin123! |
| User | user@local | User123! |

## 📁 專案結構

```
On-Premise_CorphiaAI/
├── backend/          # FastAPI 後端
├── frontend/         # React 前端
├── ai_model/         # GGUF 模型目錄
├── docs/             # 文檔
└── docker-compose.yml
```

## 📄 授權

MIT License
