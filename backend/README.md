# Corphia AI Backend

FastAPI backend，使用 Docker PostgreSQL + pgvector 作為資料庫，並以本機 GGUF + `llama-cpp-python` 推論。不使用 Ollama。

## 安裝

```powershell
cd D:\Antigravity\on-premise_CorphiaAI\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

`llama-cpp-python` 是必要套件。若要依 GPU/CPU 自動安裝最佳 wheel，可執行：

```powershell
python auto_engine.py --force
```

## 資料庫

資料庫由根目錄的 Docker Compose 啟動：

```powershell
cd D:\Antigravity\on-premise_CorphiaAI
docker compose up -d
```

後端 `.env` 預設：

```env
DATABASE_URL=postgresql+asyncpg://corphia:corphia123@localhost:5433/corphia_ai
```

初始化資料表與帳號：

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python scripts/init_db.py
python scripts/seed_users.py
```

## 啟動後端

```powershell
cd D:\Antigravity\on-premise_CorphiaAI\backend
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8168
```

API 文件：

```text
http://localhost:8168/docs
```

## 預設帳號

```text
admin@gmail.com      / Admin123
engineer@gmail.com   / Engineer123
user@gmail.com       / User123
```

## 注意

- Docker 只跑 PostgreSQL + pgvector，不跑 backend/frontend。
- GGUF 模型請放在 `ai_model/`。
- 如果後端進入模擬模式，通常代表 `llama-cpp-python` 未安裝成功，或找不到 `.gguf` 模型。
