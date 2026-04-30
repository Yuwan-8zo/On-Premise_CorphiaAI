# start-backend.ps1
# 啟動 Corphia 後端 dev server (FastAPI on :8168)
# 用法：在專案根目錄跑 `.\scripts\start-backend.ps1`

$ErrorActionPreference = 'Stop'

# 切到 backend 目錄
$backendDir = Join-Path $PSScriptRoot '..\backend'
Set-Location -Path $backendDir

# 確認 .venv 存在；若沒有就提示建立
if (-not (Test-Path '.\.venv\Scripts\Activate.ps1')) {
    Write-Host "[start-backend] .venv 不存在，請先建立：" -ForegroundColor Yellow
    Write-Host "  cd backend"
    Write-Host "  python -m venv .venv"
    Write-Host "  .\.venv\Scripts\Activate.ps1"
    Write-Host "  pip install -r requirements.txt"
    exit 1
}

Write-Host "[start-backend] 啟用 .venv ..." -ForegroundColor Cyan
. .\.venv\Scripts\Activate.ps1

Write-Host "[start-backend] 啟動 uvicorn 在 :8168 ..." -ForegroundColor Cyan
Write-Host "[start-backend] 第一次啟動需 1~2 分鐘讓 GGUF mmap，等 'Application startup complete.' 字樣出現就 OK。" -ForegroundColor Cyan
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8168
