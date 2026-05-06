# Corphia AI Launcher - PyInstaller Build Script
# ================================================
# Packs corphia_launcher.py into a single .exe (~30-50 MB) using PyInstaller.
#
# This is much simpler than the backend bundle:
#   - No torch/transformers (those stay in corphia-server.exe)
#   - Just PySide6 + Python stdlib
#   - One-file mode is OK because it's tiny enough not to slow down startup
#
# Usage:
#   cd launcher
#   powershell -ExecutionPolicy Bypass -File build_launcher.ps1
#
# Output:
#   launcher\dist\Corphia AI Launcher.exe
#
# Then copy the launcher.exe + backend dist + frontend app.exe into one folder
# for distribution.

$ErrorActionPreference = "Stop"

$LauncherDir = Split-Path -Parent $PSCommandPath
$ProjectRoot = Split-Path -Parent $LauncherDir

Write-Host "============================================" -ForegroundColor Cyan
Write-Host " Corphia AI Launcher - PyInstaller Build" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Choose Python — prefer backend's venv (already has matching deps),
# fall back to system python.
$BackendVenvPython = Join-Path $ProjectRoot "backend\.venv\Scripts\python.exe"
if (Test-Path $BackendVenvPython) {
    $Python = $BackendVenvPython
    Write-Host "OK   Using backend venv Python: $Python" -ForegroundColor Green
} else {
    $Python = "python"
    Write-Host "..   backend venv not found, using system 'python'" -ForegroundColor Yellow
}

# Step 2: Ensure PySide6 + PyInstaller installed
Write-Host "..   Installing PySide6 + PyInstaller (if missing)..." -ForegroundColor Yellow
& $Python -m pip install --quiet PySide6 pyinstaller
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: pip install failed" -ForegroundColor Red
    exit 1
}
Write-Host "OK   Dependencies ready" -ForegroundColor Green
Write-Host ""

# Step 3: Find the icon to embed
$IconPath = Join-Path $ProjectRoot "frontend\src-tauri\icons\icon.ico"
$IconArg = @()
if (Test-Path $IconPath) {
    $IconArg = @("--icon", $IconPath)
    Write-Host "OK   Icon: $IconPath" -ForegroundColor Green
} else {
    Write-Host "..   No icon.ico found, launcher will use default Python icon" -ForegroundColor Yellow
}
Write-Host ""

# Step 4: Clean old build artifacts
Write-Host "..   Cleaning old build/dist..." -ForegroundColor Yellow
$BuildDir = Join-Path $LauncherDir "build"
$DistDir = Join-Path $LauncherDir "dist"
if (Test-Path $BuildDir) { Remove-Item $BuildDir -Recurse -Force }
if (Test-Path $DistDir) { Remove-Item $DistDir -Recurse -Force }
Write-Host "OK   Cleaned" -ForegroundColor Green
Write-Host ""

# Step 5: Run PyInstaller
Write-Host "..   Running PyInstaller (3-5 min first time)..." -ForegroundColor Yellow
Write-Host ""

Push-Location $LauncherDir
try {
    $pyiArgs = @(
        "--name", "Corphia AI Launcher",
        "--onefile",                    # single-file exe
        "--windowed",                   # no console window
        "--noconfirm",
        "--clean",
        "corphia_launcher.py"
    ) + $IconArg

    & $Python -m PyInstaller @pyiArgs
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "ERROR: PyInstaller build failed" -ForegroundColor Red
        exit 1
    }
}
finally {
    Pop-Location
}

# Step 6: Locate and report output
$OutputExe = Join-Path $LauncherDir "dist\Corphia AI Launcher.exe"
if (-not (Test-Path $OutputExe)) {
    Write-Host "ERROR: Build done but exe not found at $OutputExe" -ForegroundColor Red
    exit 1
}

$ExeSize = [Math]::Round((Get-Item $OutputExe).Length / 1MB, 1)
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " Done!" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Launcher exe: $OutputExe ($ExeSize MB)" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps to distribute:" -ForegroundColor Yellow
Write-Host "  1. Create a folder e.g. 'Corphia AI/'"
Write-Host "  2. Copy these into it:"
Write-Host "     - dist\Corphia AI Launcher.exe                 (this exe)"
Write-Host "     - backend\dist\corphia-server\corphia-server.exe"
Write-Host "     - backend\dist\corphia-server\_internal\         (whole folder)"
Write-Host "     - frontend\src-tauri\target\release\app.exe"
Write-Host "     - frontend\src-tauri\target\release\WebView2Loader.dll  (if exists)"
Write-Host "  3. (User adds) ai_model\*.gguf"
Write-Host "  4. Double-click launcher exe to start"
Write-Host ""
