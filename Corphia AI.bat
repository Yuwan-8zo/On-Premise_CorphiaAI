@echo off
REM ========================================================
REM Corphia AI - One-click launcher (dev mode)
REM ========================================================
REM Double-click this file to start backend + Tauri desktop app.
REM Two windows will open:
REM   1. Backend (uvicorn on port 8168) - keep open while using app
REM   2. Tauri (compiles + launches desktop window)
REM
REM Close both windows to fully exit.

cd /d "%~dp0"

echo.
echo ============================================
echo   Corphia AI - Starting...
echo ============================================
echo.
echo Opening backend window...
start "Corphia Backend" powershell -NoExit -Command "cd '%~dp0backend'; .\.venv\Scripts\uvicorn.exe app.main:app --host 127.0.0.1 --port 8168"

echo Waiting 3 seconds for backend to start...
timeout /t 3 /nobreak > nul

echo Opening Tauri desktop app window...
start "Corphia Desktop" powershell -NoExit -Command "cd '%~dp0frontend'; npx tauri dev"

echo.
echo Both windows opened.
echo The desktop app window will appear in 1-2 minutes (first compile).
echo Subsequent launches are 5-10 seconds.
echo.
echo You can close THIS window now.
timeout /t 5
