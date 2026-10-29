@echo off
chcp 65001 >nul
title Corphia AI Launcher
cd /d "%~dp0"
rem One-click start: Docker + database + backend + AI model + frontend, then opens the browser.
rem To stop everything, double-click the stop file (do not just close this window).
python start.py --model 3B
echo.
echo Corphia AI has stopped. If you saw [ERROR] above, take a photo of this window.
pause
