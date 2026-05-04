@echo off
chcp 65001 >nul
cd /d "%~dp0\.."
echo ============================================
echo  Fix default tenant + remap orphan tenant_id
echo ============================================
echo.

set "PYEXE=%~dp0\..\.venv\Scripts\python.exe"
if not exist "%PYEXE%" (
  echo [ERROR] venv python not found: %PYEXE%
  echo Please run "python -m venv .venv" in backend dir first.
  pause
  exit /b 1
)

"%PYEXE%" "%~dp0\fix_default_tenant.py"
set RC=%ERRORLEVEL%

echo.
if %RC%==0 (
  echo [OK] Script finished successfully.
) else (
  echo [FAIL] Script returned code %RC%
)
echo.
echo Press any key to close...
pause >nul
