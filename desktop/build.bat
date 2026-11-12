@echo off
rem 打包 Corphia AI 桌面版（輸出 desktop\dist\Corphia AI.exe）
rem 需要先建立環境：python -m venv .venv ＆ .venv\Scripts\pip install pywin32 pywebview pyinstaller
cd /d "%~dp0"
.venv\Scripts\pyinstaller.exe --noconfirm --clean --onefile --windowed --name "Corphia AI" ^
  --hidden-import win32timezone --collect-submodules webview.platforms ^
  corphia_desktop.py
