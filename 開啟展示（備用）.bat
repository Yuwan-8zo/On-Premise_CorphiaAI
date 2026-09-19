@echo off
title Corphia AI 展示伺服器
color 0A
cls
echo.
echo  ╔══════════════════════════════════════╗
echo  ║   Corphia AI - 展示模式啟動中...    ║
echo  ║   請保持此視窗在背景，不要關閉      ║
echo  ╚══════════════════════════════════════╝
echo.
echo  正在啟動本地伺服器...

:: 等 2 秒後開啟瀏覽器
timeout /t 2 /nobreak >nul
start "" "http://localhost:5174/Corphia-Demo.html"

echo  ✓ 瀏覽器已開啟，請切換過去開始錄影
echo.
echo  （錄影結束後，關閉此視窗即可停止展示）
echo.

:: 啟動伺服器（Node.js / npx serve）
npx --yes serve -l 5174 --no-request-logging 2>nul

:: 若上面失敗，用 Python 備援
if errorlevel 1 (
    echo  npx 不可用，改用 Python...
    python -m http.server 5174
)

pause
