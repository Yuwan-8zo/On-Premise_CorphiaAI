# Corphia AI Platform - Backend

## 安裝

```bash
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
```

## 啟動開發伺服器

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 初始化資料庫

```bash
python scripts/init_db.py
```
