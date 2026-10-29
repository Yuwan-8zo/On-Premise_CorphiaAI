@echo off
chcp 65001 >nul 2>&1
title Corphia Demo
cd /d "%~dp0"

:: Kill any leftover node processes running server.js on this machine
taskkill /F /IM node.exe /FI "WINDOWTITLE eq Corphia Demo" >nul 2>&1

:: Small wait to release the port
timeout /t 1 /nobreak >nul

:: Start the demo server
node server.js

pause
