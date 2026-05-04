# Corphia AI Platform On-Premise

本專案採用「資料庫用 Docker，應用程式本機執行」：

- Docker：只負責 PostgreSQL + pgvector
- Backend：本機 FastAPI + SQLAlchemy + asyncpg
- Frontend：本機 React + Vite
- LLM：本機 GGUF + `llama-cpp-python`
- 不使用 Ollama

## 一鍵啟動全部

Windows 可以直接雙擊：

```text
start-all.bat
```

或在 PowerShell 執行：

```powershell
cd D:\Antigravity\on-premise_CorphiaAI
python start.py
```

`start.py` 會自動處理：

```text
1. 檢查並啟動 Docker Desktop
2. 啟動 PostgreSQL + pgvector container
3. 檢查 backend Python 套件
4. 檢查/安裝 llama-cpp-python
5. 初始化資料庫 schema 與預設資料
6. 啟動 FastAPI backend
7. 啟動 Vite frontend
8. 開啟瀏覽器 http://localhost:5173
```

啟動完成後：

```text
Frontend: http://localhost:5173
Backend:  http://localhost:8168
API docs: http://localhost:8168/docs
DB:       localhost:5433
```

停止時，在啟動視窗按 `Ctrl+C`。Backend / Frontend 會關閉；Docker 資料庫會保留執行，方便下次快速啟動。

## 資料庫

Docker 只啟動資料庫：

```powershell
docker compose up -d
```

資料庫連線：

```env
DATABASE_URL=postgresql+asyncpg://corphia:corphia123@localhost:5433/corphia_ai
```

因為本機可能已經有 PostgreSQL 佔用 `5432`，所以 Docker PostgreSQL 對外使用 `5433`，container 內仍是 `5432`。

## llama-cpp-python

`llama-cpp-python` 是必要套件，已列在：

```text
backend/requirements.txt
```

一鍵啟動時會執行 `backend/auto_engine.py` 檢查。若 GPU wheel 不可用，會自動退回 CPU wheel，並設定：

```env
LLAMA_N_GPU_LAYERS=0
```

目前預設模型路徑：

```env
LLAMA_MODEL_PATH=../ai_model/Qwen2.5-7B-Instruct-Q5_K_M.gguf
```

## 常用指令

```powershell
# 一鍵啟動
python start.py

# 強制重新檢查/安裝 llama-cpp-python
python start.py --force-engine

# 不自動開瀏覽器
python start.py --skip-browser

# 只看資料庫 container
docker ps --filter name=corphia-postgres

# 停止資料庫 container
docker compose down
```

## 預設帳號

```text
engineer@local / Engineer123!
admin@local    / Admin123!
user@local     / User123!
```

另外 `backend/scripts/seed_users.py` 可建立測試用 Gmail 帳號。

## Log 位置

一鍵啟動後，服務 log 會寫到：

```text
.runtime/backend.log
.runtime/frontend.log
.runtime/init-db.log
.runtime/auto-engine.log
```
