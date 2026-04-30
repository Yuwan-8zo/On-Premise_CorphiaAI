# start-frontend.ps1
# 啟動 Corphia 前端 dev server (Vite on :5173)
# 用法：在專案根目錄跑 `.\scripts\start-frontend.ps1`

$ErrorActionPreference = 'Stop'

$frontendDir = Join-Path $PSScriptRoot '..\frontend'
Set-Location -Path $frontendDir

if (-not (Test-Path '.\node_modules')) {
    Write-Host "[start-frontend] node_modules 不存在，先跑 npm install ..." -ForegroundColor Yellow
    npm install
}

Write-Host "[start-frontend] 啟動 Vite 在 :5173 ..." -ForegroundColor Cyan
npm run dev
