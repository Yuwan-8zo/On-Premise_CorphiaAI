# Corphia AI Platform — On-Premise

**地端部署**的企業 LLM 對話 + RAG 平台。
本機跑 GGUF 模型推理、pgvector 做向量檢索、FastAPI + React 19 + Tailwind。

> 你正在看的是專案總入口。前後端的個別細節請看：
> - [`backend/README.md`](./backend/README.md)
> - [`frontend/README.md`](./frontend/README.md)
> - [`frontend/src/design-system/README.md`](./frontend/src/design-system/README.md) — 設計系統

---

## ⚡ 一鍵啟動（每天開機後就跑這個）

```powershell
cd D:\Antigravity\on-premise_CorphiaAI
python start.py
```

`start.py` 會幫你做完所有事：

```
[0/6] 自動喚醒 Docker Desktop + Ollama
[1/6] docker-compose up -d           ← postgres + pgvector
[2/6] 清掉佔用 5173 / 8168 的舊 process
[3/6] 偵測硬體決定 GGUF 推理參數
[4/6] 啟動前端 Vite (port 5173)        ← 同時自動開瀏覽器
[5/6] 啟動後端 uvicorn (port 8168)     ← 等 GGUF mmap，看到 ✅ 就好
[6/6] 啟動 ngrok 公開通道（如果有裝）
```

按 `Ctrl+C` 一次關掉所有東西。

> 第一次啟動需 1～2 分鐘讓 GGUF 模型 mmap，看到 `[OK] 後端 API 已就緒 ✅` 才算完整。
> `start.py` 會優先用 `backend/.venv/`（推薦），找不到才用 `backend/venv/`，再不行用全域 Python。

---

## 預設帳號（dev 用）

```
admin@gmail.com      / Admin123       ← 管理員
engineer@gmail.com   / Engineer123    ← 工程師
user@gmail.com       / User123        ← 一般使用者
```

帳號定義在 `backend/scripts/seed_users.py`，跑 `python scripts/seed_users.py` 重置。

---

## 第一次安裝（新電腦 / 重灌 / clone 下來）

```powershell
# 1. 後端 venv 與套件
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env       # 編輯 .env，至少設 SECRET_KEY、DATABASE_URL、LLAMA_MODEL_PATH
python scripts/init_db.py    # 建表
python scripts/seed_users.py # 預設帳號
deactivate
cd ..

# 2. 前端套件
cd frontend
npm install
copy .env.example .env.local  # 通常不用改
cd ..

# 3. GGUF 模型
# 從 Hugging Face 下載 .gguf 放到 ai_model/ 底下
# 預設用 ai_model/Qwen2.5-3B-Instruct-Q5_K_M.gguf

# 4. 之後就只要 python start.py 一條指令
python start.py
```

---

## 專案結構

```
on-premise_CorphiaAI/
├─ start.py                 ← 一鍵啟動（推薦用法）
├─ backend/                 ← FastAPI / Python
│  ├─ app/                    ← 主程式
│  ├─ scripts/                ← init_db、seed_users…
│  ├─ requirements.txt
│  └─ .venv/                  ← 虛擬環境（自己建，不進 git）
├─ frontend/                ← React 19 / Vite / Tailwind
│  ├─ src/
│  │  ├─ pages/                ← 路由頁面
│  │  ├─ components/           ← UI 元件
│  │  ├─ design-system/        ← 設計 token (單一資料來源)
│  │  ├─ store/                ← Zustand stores
│  │  ├─ api/                  ← REST/WebSocket clients
│  │  └─ i18n/locales/         ← 三語翻譯
│  └─ public/samples/          ← 範例檔（給 Documents 頁下載）
├─ ai_model/                ← GGUF 模型存放
├─ docker-compose.yml       ← postgres + pgvector
├─ scripts/                 ← 個別啟動腳本（start.py 是主流程）
│  ├─ start-backend.ps1       ← 只開後端
│  ├─ start-frontend.ps1      ← 只開前端
│  └─ reset-backend-venv.ps1  ← 砍壞 venv 重建（救援用）
└─ README.md                ← 你正在看
```

---

## 設計系統

整個 UI 的圓角、字級、主題色都從一個地方定義：

```
frontend/src/design-system/tokens.js   ← 唯一資料來源
frontend/src/design-system/index.ts    ← TS 入口
frontend/src/design-system/README.md   ← 完整文件
```

詳見該資料夾的 README。**修一個值會即時影響整個 App**。

---

## 常見問題

### 後端啟動報 `Fatal error in launcher: ... D:\Cursor\...`
舊 `venv/`（沒有點）是當專案在不同路徑時建的，內部 python.exe 寫死了舊路徑。
跑救援腳本一次解決：

```powershell
.\scripts\reset-backend-venv.ps1
```

它會砍掉壞掉的 `venv\` 並建立新的 `.venv\`。

### 前端 `rounded-cv-lg` 沒效果（圓角變成直角）
`tailwind.config.js` 變更需要重啟 Vite dev server。
最簡單的辦法：`Ctrl+C` 終止 `start.py`，再 `python start.py` 就好。

### Port 5173 / 8168 已被占用
`start.py` 會自動清掉，所以一般不需要手動處理。要手動的話：

```powershell
netstat -ano | Select-String ":5173"
taskkill /F /PID <pid>
```

### 不想用 `start.py`，只啟動其中一邊
- 只啟前端：`.\scripts\start-frontend.ps1`
- 只啟後端：`.\scripts\start-backend.ps1`

---

## 給協作者

- 改前端 UI 之前先看 `frontend/src/design-system/README.md`，請用 token、不要寫 `rounded-[20px]` / `text-[15px]` 之類的硬編碼。
- 後端改 schema 後記得 `alembic revision --autogenerate -m "..."`、`alembic upgrade head`。
- Commit 訊息走 conventional：`feat`/`fix`/`refactor`/`chore`/`docs`/`style` + `(scope)`。
