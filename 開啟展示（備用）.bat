@echo off
title Corphia AI 展示

:: 切換到此 bat 所在目錄
cd /d "%~dp0"

:: 用 node 直接啟動（不用 npx，不需要網路）
node server.js

pause
