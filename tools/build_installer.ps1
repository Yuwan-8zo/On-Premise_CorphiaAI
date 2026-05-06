# Corphia AI - Build Windows Installer (one-shot)
# ==================================================
# Pipeline:
#   1. backend  -> PyInstaller -> corphia-server.exe (onedir)
#   2. backend  -> Copy sidecar to frontend/src-tauri/binaries/
#   3. Patch tauri.conf.json: add externalBin + resources
#   4. frontend -> npm run build (Vite production)
#   5. frontend -> npx tauri build (Rust release + NSIS/MSI)
#   6. Restore tauri.conf.json
#   7. Copy installers to releases/ for easy distribution
#
# Output:
#   frontend/src-tauri/target/release/bundle/nsis/Corphia AI_*_x64-setup.exe
#   frontend/src-tauri/target/release/bundle/msi/Corphia AI_*_x64_en-US.msi
#   releases/                    (mirrored copies)
#
# First run: 30-60 min. Subsequent runs: 5-15 min.
#
# Usage (run from anywhere):
#   powershell -ExecutionPolicy Bypass -File tools\build_installer.ps1

$ErrorActionPreference = "Stop"

# Resolve project paths regardless of cwd
$ToolsDir = Split-Path -Parent $PSCommandPath
$ProjectRoot = Split-Path -Parent $ToolsDir
$BackendDir = Join-Path $ProjectRoot "backend"
$FrontendDir = Join-Path $ProjectRoot "frontend"
$ReleasesDir = Join-Path $ProjectRoot "releases"
$TauriConfPath = Join-Path $FrontendDir "src-tauri\tauri.conf.json"
$TauriConfBackup = "$TauriConfPath.backup"

function Write-Stage {
    param([string]$Title)
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host " $Title" -ForegroundColor Cyan
    Write-Host "================================================" -ForegroundColor Cyan
}

function Restore-TauriConf {
    if (Test-Path $TauriConfBackup) {
        Move-Item -Force $TauriConfBackup $TauriConfPath
        Write-Host "OK   tauri.conf.json restored to original" -ForegroundColor Green
    }
}

# Trap so we always restore conf even on error
trap {
    Write-Host ""
    Write-Host "ERROR: Build interrupted" -ForegroundColor Red
    Restore-TauriConf
    break
}

# ----------------------------------------------------------------
# Stage 1: Backend
# ----------------------------------------------------------------
Write-Stage "Stage 1/3 - Backend (PyInstaller)"
Write-Host "Estimated: 5-10 min (first time)" -ForegroundColor Gray
Write-Host ""

$BackendBuildScript = Join-Path $ToolsDir "build_backend.ps1"
if (-not (Test-Path $BackendBuildScript)) {
    Write-Host "ERROR: tools/build_backend.ps1 not found" -ForegroundColor Red
    exit 1
}

& powershell -ExecutionPolicy Bypass -File $BackendBuildScript
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Backend build failed, abort" -ForegroundColor Red
    exit 1
}

$ExpectedSidecar = Join-Path $FrontendDir "src-tauri\binaries\corphia-server-x86_64-pc-windows-msvc.exe"
if (-not (Test-Path $ExpectedSidecar)) {
    Write-Host "ERROR: sidecar not in expected location: $ExpectedSidecar" -ForegroundColor Red
    exit 1
}
Write-Host ""
Write-Host "OK   Sidecar ready" -ForegroundColor Green

# ----------------------------------------------------------------
# Stage 2: Patch tauri.conf.json with externalBin
# ----------------------------------------------------------------
Write-Stage "Stage 2/3 - Patching tauri.conf.json"

# Backup original — use byte-exact copy to preserve UTF-8 without BOM
Copy-Item -Force $TauriConfPath $TauriConfBackup

# Read with explicit UTF-8 (PowerShell 5.1's Get-Content defaults to ANSI/Windows-1252,
# which corrupts the Chinese strings in copyright/shortDescription/longDescription).
$confText = [System.IO.File]::ReadAllText($TauriConfPath, [System.Text.Encoding]::UTF8)
$conf = $confText | ConvertFrom-Json

# Add externalBin + resources to bundle
if (-not ($conf.bundle | Get-Member -Name "externalBin" -MemberType NoteProperty)) {
    $conf.bundle | Add-Member -MemberType NoteProperty -Name "externalBin" -Value @("binaries/corphia-server")
}
# IMPORTANT: use "**/*" not "*" — single-star only matches direct children,
# so _internal/ subfolder (Python runtime + DLLs) won't be packed.
# Without _internal/, the bundled exe fails to import torch/transformers/etc.
if (-not ($conf.bundle | Get-Member -Name "resources" -MemberType NoteProperty)) {
    $conf.bundle | Add-Member -MemberType NoteProperty -Name "resources" -Value @("binaries/corphia-server/**/*")
}

# Write back with UTF-8 NO BOM (Tauri's JSON parser dislikes BOM, and Set-Content -Encoding UTF8
# in PS 5.1 writes WITH BOM by default → use .NET API directly)
$newJson = $conf | ConvertTo-Json -Depth 100
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($TauriConfPath, $newJson, $utf8NoBom)
Write-Host "OK   externalBin + resources added for build" -ForegroundColor Green

# ----------------------------------------------------------------
# Stage 3: Tauri build
# ----------------------------------------------------------------
Write-Stage "Stage 3/3 - Frontend + Tauri Bundle"
Write-Host "Estimated: 20-50 min (first Rust release build is slow)" -ForegroundColor Gray
Write-Host ""

Push-Location $FrontendDir
try {
    Write-Host "..   npm run build (Vite production)..." -ForegroundColor Yellow
    & npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Vite build failed" -ForegroundColor Red
        Restore-TauriConf
        exit 1
    }
    Write-Host "OK   Vite done" -ForegroundColor Green
    Write-Host ""

    Write-Host "..   npx tauri build (Rust release + installer wizard)..." -ForegroundColor Yellow
    Write-Host "     This takes a while. Many 'Compiling' lines is normal." -ForegroundColor Gray
    Write-Host ""
    & npx tauri build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: tauri build failed" -ForegroundColor Red
        Restore-TauriConf
        exit 1
    }
}
finally {
    Pop-Location
}

# Restore conf so dev mode keeps working
Restore-TauriConf

# ----------------------------------------------------------------
# Stage 4: Mirror installers to releases/ folder
# ----------------------------------------------------------------
Write-Stage "Mirroring to releases/"

if (-not (Test-Path $ReleasesDir)) {
    New-Item -ItemType Directory -Path $ReleasesDir | Out-Null
}

$BundleDir = Join-Path $FrontendDir "src-tauri\target\release\bundle"
$NsisDir = Join-Path $BundleDir "nsis"
$MsiDir = Join-Path $BundleDir "msi"

if (Test-Path $NsisDir) {
    Get-ChildItem $NsisDir -Filter *.exe | ForEach-Object {
        $dest = Join-Path $ReleasesDir $_.Name
        Copy-Item -Force $_.FullName $dest
        Write-Host "OK   $dest" -ForegroundColor Green
    }
}
if (Test-Path $MsiDir) {
    Get-ChildItem $MsiDir -Filter *.msi | ForEach-Object {
        $dest = Join-Path $ReleasesDir $_.Name
        Copy-Item -Force $_.FullName $dest
        Write-Host "OK   $dest" -ForegroundColor Green
    }
}

# ----------------------------------------------------------------
# Done
# ----------------------------------------------------------------
Write-Stage "Done!"

Write-Host ""
Write-Host "Installers produced:" -ForegroundColor Yellow

if (Test-Path $NsisDir) {
    Write-Host ""
    Write-Host "  NSIS installer (recommended for end users):" -ForegroundColor White
    Get-ChildItem $NsisDir -Filter *.exe | ForEach-Object {
        $size = [Math]::Round($_.Length / 1MB, 1)
        Write-Host ("    {0}  ({1} MB)" -f $_.FullName, $size) -ForegroundColor Cyan
    }
}

if (Test-Path $MsiDir) {
    Write-Host ""
    Write-Host "  MSI installer (for IT deployment):" -ForegroundColor White
    Get-ChildItem $MsiDir -Filter *.msi | ForEach-Object {
        $size = [Math]::Round($_.Length / 1MB, 1)
        Write-Host ("    {0}  ({1} MB)" -f $_.FullName, $size) -ForegroundColor Cyan
    }
}

Write-Host ""
Write-Host "Mirrored copies in: $ReleasesDir" -ForegroundColor Green
Write-Host "Double-click any installer above to install Corphia AI." -ForegroundColor Green
Write-Host ""
