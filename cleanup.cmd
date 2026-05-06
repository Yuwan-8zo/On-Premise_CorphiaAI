@echo off
REM Corphia AI - one-click cleanup wrapper
REM Double-click this file. It runs cleanup.ps1 with the right ExecutionPolicy.

cd /d "%~dp0"

echo.
echo ============================================================
echo   Corphia AI - Cleanup
echo ============================================================
echo.
echo This will delete:
echo   - Python caches, build artifacts, logs
echo   - Duplicate build scripts (canonical lives in tools\)
echo   - One-off icon scripts and intermediate PNGs
echo   - Cancelled lottie infrastructure
echo   - Old Corphia AI.bat launcher
echo.
echo Files preserved:
echo   - backend\.venv  (huge, but you need it)
echo   - frontend\node_modules  (same)
echo   - ai_model\*.gguf  (the LLM weights)
echo.
echo Press any key to start, or close this window to abort.
pause > nul

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0cleanup.ps1"

echo.
echo ============================================================
echo   Cleanup finished. Press any key to close this window.
echo ============================================================
pause > nul
