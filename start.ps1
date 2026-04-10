# =========================================
# Corphia AI - 快速啟動腳本 (Windows)
# 用法：右鍵 → 使用 PowerShell 執行
#       或在終端執行 .\start.ps1
# =========================================

$RootDir = $PSScriptRoot

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "   Corphia AI - 快速啟動" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# --- 啟動 Backend ---
Write-Host "[1/2] 啟動 Backend (FastAPI)..." -ForegroundColor Yellow
$backendDir = Join-Path $RootDir "backend"
$venvPython = Join-Path $backendDir "venv\Scripts\python.exe"

# 判斷使用 venv 還是系統 python
if (Test-Path $venvPython) {
    $pythonCmd = $venvPython
    Write-Host "      使用 venv Python: $pythonCmd" -ForegroundColor Gray
} else {
    $pythonCmd = "python"
    Write-Host "      使用系統 Python" -ForegroundColor Gray
}

Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$backendDir'; & '$pythonCmd' -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
) -WindowStyle Normal

Write-Host "      Backend 視窗已開啟 → http://localhost:8000" -ForegroundColor Green

# 稍等 Backend 初始化
Start-Sleep -Seconds 2

# --- 啟動 Frontend ---
Write-Host ""
Write-Host "[2/2] 啟動 Frontend (Vite)..." -ForegroundColor Yellow
$frontendDir = Join-Path $RootDir "frontend"

Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$frontendDir'; npm run dev -- --host"
) -WindowStyle Normal

Write-Host "      Frontend 視窗已開啟 → http://localhost:5173" -ForegroundColor Green

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " ✅ 前後端已成功啟動！" -ForegroundColor Green
Write-Host "    Backend  → http://localhost:8000" -ForegroundColor White
Write-Host "    Frontend → http://localhost:5173" -ForegroundColor White
Write-Host "    API Docs → http://localhost:8000/docs" -ForegroundColor White
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host " 關閉方式：直接關閉兩個 PowerShell 視窗即可" -ForegroundColor Gray
Write-Host ""
