# reset-backend-venv.ps1
# 把後端 venv 砍掉重建。
# 用途：當資料夾搬家後 venv 內 python.exe 路徑寫死導致無法啟動時。
# 用法：在專案根目錄跑 `.\scripts\reset-backend-venv.ps1`

$ErrorActionPreference = 'Stop'

$backendDir = Join-Path $PSScriptRoot '..\backend'
Set-Location -Path $backendDir

# 砍舊的 venv（沒有點，舊命名）
if (Test-Path '.\venv') {
    Write-Host "[reset-venv] 砍掉舊的 venv\ ..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force .\venv
    Write-Host "[reset-venv] 完成。" -ForegroundColor Green
}

# 砍既有的 .venv（如果想徹底重建）
if (Test-Path '.\.venv') {
    $confirm = Read-Host "[reset-venv] .venv 已存在，要砍掉重建嗎？(y/N)"
    if ($confirm -eq 'y' -or $confirm -eq 'Y') {
        Remove-Item -Recurse -Force .\.venv
        Write-Host "[reset-venv] .venv 已砍掉。" -ForegroundColor Green
    } else {
        Write-Host "[reset-venv] 跳過，使用既有 .venv。" -ForegroundColor Cyan
        exit 0
    }
}

Write-Host "[reset-venv] 建立新的 .venv ..." -ForegroundColor Cyan
python -m venv .venv
. .\.venv\Scripts\Activate.ps1

Write-Host "[reset-venv] 安裝 requirements ...（這會花幾分鐘）" -ForegroundColor Cyan
pip install -r requirements.txt

Write-Host ""
Write-Host "[reset-venv] 完成。現在可以 .\scripts\start-backend.ps1 啟動後端。" -ForegroundColor Green
