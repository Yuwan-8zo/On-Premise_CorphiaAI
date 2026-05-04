@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo Starting Corphia AI...
echo.

python start.py

echo.
if errorlevel 1 (
  echo Startup failed. Press any key to close this window.
) else (
  echo Corphia AI stopped. Press any key to close this window.
)
pause >nul
