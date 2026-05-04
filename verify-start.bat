@echo off
REM Corphia AI — verification launcher
REM Wraps `python start.py` in a way that's runnable by double-clicking
REM (so we don't need to type into a locked terminal). Pauses at the end
REM so the window stays open if start.py crashes early.

cd /d "%~dp0"

echo ============================================================
echo   Running:  python start.py
echo   CWD:      %CD%
echo ============================================================
echo.

python start.py
set RC=%ERRORLEVEL%

echo.
echo ============================================================
echo   start.py exited with code %RC%
echo ============================================================
pause
