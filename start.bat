@echo off
REM Corphia AI Platform - 啟動腳本

echo ========================================
echo      Corphia AI Platform v2.2
echo ========================================
echo.

REM 檢查 Python venv
if not exist "backend\venv" (
    echo [!] Python 虛擬環境不存在，請執行:
    echo     cd backend
    echo     python -m venv venv
    echo     .\venv\Scripts\activate
    echo     pip install -r requirements.txt
    pause
    exit /b 1
)

REM 啟動後端
echo [1/2] 啟動後端服務...
start "Backend" cmd /k "cd backend && .\venv\Scripts\activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

REM 等待後端啟動
timeout /t 3 /nobreak > nul

REM 啟動前端
echo [2/2] 啟動前端服務...
start "Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo [OK] 服務啟動中
echo.
echo     後端: http://localhost:8000
echo     前端: http://localhost:5173
echo     API 文檔: http://localhost:8000/docs
echo.
pause
