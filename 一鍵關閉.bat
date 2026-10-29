@echo off
chcp 65001 >nul
title Corphia Stop
cd /d "%~dp0"
rem One-click stop: backend, frontend, database and a clean Docker Desktop shutdown.
python stop.py
echo.
timeout /t 8
