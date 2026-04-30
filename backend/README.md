# Corphia AI Platform — Backend

FastAPI + SQLAlchemy + pgvector + 本地 GGUF（llama-cpp-python）

---

## 第一次安裝

```powershell
cd D:\Antigravity\on-premise_CorphiaAI\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

> ⚠️ 名稱用 `.venv` （前面有個點）。`.gitignore` 已經把它排除，不會被推上雲端。
> 不要用 `venv`（沒有點），以免跟舊資料殘留混淆。

---

## 啟動開發伺服器

```powershell
cd D:\Antigravity\on-premise_CorphiaAI\backend
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8168
```

> Port 一律用 **8168**，跟前端 `vite.config` 的 proxy 對齊。
> README 舊版寫 8000 是錯的。

啟動後等 1～2 分鐘讓 GGUF 模型完成 mmap，看到 `Application startup complete.` 就可以登入了。

---

## 初始化資料庫與種子資料

```powershell
.\.venv\Scripts\Activate.ps1
python scripts/init_db.py
python scripts/seed_users.py    # 建立預設 admin / engineer / user 帳號
```

預設帳號（可在 `scripts/seed_users.py` 修改）：
- `admin@gmail.com / Admin123`
- `engineer@gmail.com / Engineer123`
- `user@gmail.com / User123`

---

## 環境變數

複製 `.env.example` 為 `.env`，至少要設定：

- `DATABASE_URL` — postgres + pgvector 連線字串
- `SECRET_KEY` — JWT 簽章用，必改
- `LLAMA_MODEL_PATH` — GGUF 檔案路徑

完整變數說明見 `.env.example` 上方註解。

---

## 常見問題

**`Fatal error in launcher: Unable to create process using '...D:\Cursor\...'`**

venv 內部 python.exe 的 base path 寫死成建立 venv 時的位置；資料夾搬家後就壞了。
解法：把 `venv/` 整個刪掉重建。

```powershell
cd D:\Antigravity\on-premise_CorphiaAI\backend
Remove-Item -Recurse -Force .\venv     # 砍掉舊的（如果還在）
python -m venv .venv                   # 建乾淨的 .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

**Port 8168 已被占用**

```powershell
netstat -ano | Select-String ":8168"   # 找 PID
taskkill /F /PID <pid>                 # 殺掉
```

**Ollama 連線失敗的 WARNING**

正常。Corphia 預設先試 Ollama，失敗會 fallback 到本地 GGUF。WARNING 可以忽略。
