# Corphia AI Platform On-Premise

本專案採用「資料庫用 Docker，應用程式本機執行」：

- Docker：只負責 PostgreSQL + pgvector
- Backend：本機 FastAPI + SQLAlchemy + asyncpg
- Frontend：本機 React + Vite
- LLM：本機 GGUF；推論引擎是 llama.cpp 的 `llama-server`（放在 `engine/llama-vulkan/`，每個模型一個行程、只聽本機）；找不到引擎時退回 `llama-cpp-python`
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

# 只啟動後端（前端已用 npm run dev 跑著時）
python start.py --backend-only

# 不啟動 Vite（僅後端 + DB）
python start.py --skip-frontend

# 只看資料庫 container
docker ps --filter name=corphia-postgres

# 停止資料庫 container
docker compose down
```

## 備份與還原

更新系統前、或平常定期，備份資料庫、使用者上傳的文件與 AI 產出的檔案（放在 `backups\`，不進版本庫）：

```powershell
# 做一份備份
backend\.venv\Scripts\python.exe backend\scripts\backup.py create

# 列出備份
backend\.venv\Scripts\python.exe backend\scripts\backup.py list

# 還原演練：還原到暫時的資料庫、核對每張表的筆數後刪掉，不動正式資料
backend\.venv\Scripts\python.exe backend\scripts\backup.py check backups\corphia-日期-時間

# 真的還原（會蓋掉現在的資料；要先關閉系統，還原前會自動把現在的資料另存一份）
backend\.venv\Scripts\python.exe backend\scripts\backup.py restore backups\corphia-日期-時間 --yes
```

資料庫的結構升級是自動的：功能更新若要在舊資料表加欄位，寫在 `backend/app/core/migrations.py`（只能往後加），後端啟動時會自動套用還沒做過的步驟。

## 桌面版（操控 Word / Excel / PowerPoint）

桌面版是一個視窗顯示伺服器上的同一套介面，加上本機小幫手：把 AI 的回答寫進這台電腦的 Word、Excel、PowerPoint，讀取開著的文件來提問，直接開啟 AI 產出的檔案。

- 打包：`desktop\build.bat`（輸出 `desktop\dist\Corphia AI.exe`；第一次要先照 `desktop/README.md` 建立環境）
- 發給使用者：伺服器會提供下載，使用者在「設定 › 關於」按下載；之後有新版，桌面版開啟時會向伺服器查詢並提示更新（只連公司自己的伺服器）
- 手機、平板直接用瀏覽器（沒有桌面功能，但可以請 AI 在伺服器產生檔案再下載）

安全設計與細節見 `desktop/README.md`。

## 資料不出公司

- 模型、向量檢索、語音轉文字都在這台伺服器上執行，後端啟動時設定為離線模式
- 頁面的安全政策（`frontend/index.html` 的 Content-Security-Policy）只允許連自己這台伺服器：字型已打包在程式裡，外部圖片、外部連線在瀏覽器層級就被擋下。之後若真的需要連某個外部服務，只在政策裡加那一個網址
- 進模型之前（使用者訊息、文件片段、記憶、專案指示）與模型的回答，都會先經過檢查：個資遮罩、列管字詞、藏在文件裡的指令、外部圖片

## 測試

```powershell
# 後端（需要資料庫容器；使用獨立的測試資料庫 corphia_test）
cd backend
python -m pytest tests -q

# 前端型別與規範
cd frontend
npx tsc --noEmit -p .
npx eslint src --max-warnings=0
```

## 建議硬體規格（地端）

| 項目 | 最低 | 建議 |
|------|------|------|
| RAM | 16 GB | 32 GB（7B Q5 + Embedding） |
| 磁碟 | 20 GB 可用 | SSD 50 GB+（含 GGUF 模型） |
| GPU | 無（CPU 模式） | NVIDIA 8 GB+ VRAM（可 offload 層數） |
| Docker | 必須 | Desktop 常駐（僅 PostgreSQL） |

首次啟動：API 約 **10–30 秒** 可進登入頁；LLM/RAG 背景預熱可能再需 **1–5 分鐘**（視模型與磁碟速度）。

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
