$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -Path $root

Write-Host "Starting Corphia AI..." -ForegroundColor Cyan
python start.py
