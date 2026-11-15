@echo off
chcp 65001 >nul
rem Build the Corphia AI desktop app (output: desktop\dist\Corphia AI.exe).
rem First-time setup: python -m venv .venv  then  .venv\Scripts\pip install pywin32 pywebview pyinstaller
rem The build recipe (icon, splash, manifest, hidden imports) is in corphia.spec.
rem This file is kept ASCII-only with CRLF line endings so cmd.exe parses it correctly on every code page.
cd /d "%~dp0"
if not exist ".venv\Scripts\pyinstaller.exe" (
  echo PyInstaller was not found in .venv. Run the first-time setup above.
  exit /b 1
)
".venv\Scripts\pyinstaller.exe" --noconfirm --clean corphia.spec
if errorlevel 1 exit /b 1
echo Built: dist\Corphia AI.exe
