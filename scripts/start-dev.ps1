# start-dev.ps1
# ⚠️ 請改用 `python start.py`（在專案根目錄），它做的事更完整：
#    - 自動拉 Docker / Ollama
#    - 自動清 port
#    - 自動偵測硬體
#    - 自動啟動 ngrok 公開通道
#    - Ctrl+C 一次關掉所有東西
#
# 此腳本保留作為 fallback：如果不想用 start.py，這裡會直接呼叫它。

$root = Split-Path -Parent $PSScriptRoot
Set-Location -Path $root

Write-Host "[start-dev] 委派給 python start.py（主流程入口）..." -ForegroundColor Cyan
python start.py
