# Corphia AI Platform - 快速啟動指南

## 🚀 一鍵啟動

```powershell
# 在專案根目錄執行
python start_servers.py
```

---

## 📋 手動啟動步驟

### 1. 後端 (Backend)

```powershell
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

- API: http://localhost:8000
- Swagger 文檔: http://localhost:8000/docs

### 2. 前端 (Frontend)

```powershell
cd frontend
npm run dev
```

- 網站: http://localhost:5173

### 3. 資料庫

SQLite 資料庫會在後端首次啟動時自動初始化，無需手動設定。

資料庫檔案位置: `backend/corphia.db`

---

## ⚙️ 必要條件

| 項目 | 版本 | 安裝指令 |
|------|------|----------|
| Python | ≥ 3.10 | - |
| Node.js | ≥ 18 | - |
| npm | ≥ 9 | - |

### 首次安裝依賴

```powershell
# 後端
cd backend
pip install -r requirements.txt

# 前端
cd frontend
npm install --legacy-peer-deps
```

---

## 🔧 常見問題

**Q: 前端啟動失敗？**
```powershell
cd frontend
rmdir /s /q node_modules
del package-lock.json
npm install --legacy-peer-deps
```

**Q: 後端 import 錯誤？**
```powershell
cd backend
pip install -r requirements.txt
```
