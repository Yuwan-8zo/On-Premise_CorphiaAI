@echo off
chcp 65001 >nul
title Corphia AI Updater
cd /d "%~dp0"
rem One-click update: checks for a newer version, backs up, applies it, restarts.
rem Needs this machine to reach the internet (only to download the update package).
python update.py
echo.
pause
