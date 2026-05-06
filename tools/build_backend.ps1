# Corphia AI Backend - PyInstaller Build Script
# ================================================
# Bundles FastAPI + llama-cpp-python + asyncpg into a single exe (onedir).
# Output goes to backend/dist/corphia-server/, then copied into Tauri sidecar location.
#
# Usage (run from anywhere):
#   powershell -ExecutionPolicy Bypass -File tools\build_backend.ps1
#
# First run takes 5-10 min. Incremental builds 1-2 min.
# All output kept in ASCII to avoid PowerShell 5.1 encoding issues.

$ErrorActionPreference = "Stop"

# Resolve project paths regardless of cwd. Script lives in tools/, project root is one level up.
$ToolsDir = Split-Path -Parent $PSCommandPath
$ProjectRoot = Split-Path -Parent $ToolsDir
$BackendRoot = Join-Path $ProjectRoot "backend"
$FrontendRoot = Join-Path $ProjectRoot "frontend"

$VenvPython = Join-Path $BackendRoot ".venv\Scripts\python.exe"
$VenvPyInstaller = Join-Path $BackendRoot ".venv\Scripts\pyinstaller.exe"
$SpecFile = Join-Path $BackendRoot "corphia-server.spec"

$DistDir = Join-Path $BackendRoot "dist\corphia-server"
$ExeFile = Join-Path $DistDir "corphia-server.exe"

$TauriBinariesDir = Join-Path $FrontendRoot "src-tauri\binaries"
$TauriTargetDir = Join-Path $TauriBinariesDir "corphia-server"
$TauriExeName = "corphia-server-x86_64-pc-windows-msvc.exe"
$TauriExe = Join-Path $TauriBinariesDir $TauriExeName

Write-Host "============================================" -ForegroundColor Cyan
Write-Host " Corphia AI Backend - PyInstaller Build" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Verify venv
if (-not (Test-Path $VenvPython)) {
    Write-Host "ERROR: venv Python not found at $VenvPython" -ForegroundColor Red
    Write-Host "Make sure backend\.venv\ exists" -ForegroundColor Yellow
    exit 1
}
Write-Host "OK   venv Python: $VenvPython" -ForegroundColor Green

# Step 2: Install PyInstaller if not present
if (-not (Test-Path $VenvPyInstaller)) {
    Write-Host "..   Installing PyInstaller into venv..." -ForegroundColor Yellow
    & $VenvPython -m pip install pyinstaller
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: PyInstaller install failed" -ForegroundColor Red
        exit 1
    }
}
Write-Host "OK   PyInstaller: $VenvPyInstaller" -ForegroundColor Green
Write-Host ""

# Step 3: Clean old build artifacts
Write-Host "..   Cleaning old build/dist..." -ForegroundColor Yellow
$BuildDir = Join-Path $BackendRoot "build"
$RootDistDir = Join-Path $BackendRoot "dist"
if (Test-Path $BuildDir) { Remove-Item $BuildDir -Recurse -Force }
if (Test-Path $RootDistDir) { Remove-Item $RootDistDir -Recurse -Force }
Write-Host "OK   Cleaned" -ForegroundColor Green
Write-Host ""

# Step 4: Run PyInstaller
Write-Host "..   Running PyInstaller (first time: 5-10 min)..." -ForegroundColor Yellow
Write-Host "     spec: $SpecFile" -ForegroundColor Gray
Write-Host ""

Push-Location $BackendRoot
try {
    & $VenvPyInstaller $SpecFile --noconfirm --clean
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "ERROR: PyInstaller build failed" -ForegroundColor Red
        Write-Host "Common fixes:" -ForegroundColor Yellow
        Write-Host "  1. Missing hidden import - add to corphia-server.spec hiddenimports list" -ForegroundColor Yellow
        Write-Host "  2. Missing DLL - add collect_dynamic_libs(...) to spec binaries" -ForegroundColor Yellow
        Write-Host "  3. Missing data file - add to spec datas list" -ForegroundColor Yellow
        exit 1
    }
}
finally {
    Pop-Location
}

if (-not (Test-Path $ExeFile)) {
    Write-Host "ERROR: Build completed but exe not found at $ExeFile" -ForegroundColor Red
    exit 1
}

$ExeSize = (Get-Item $ExeFile).Length / 1MB
Write-Host ""
Write-Host ("OK   Built: {0} ({1:N1} MB)" -f $ExeFile, $ExeSize) -ForegroundColor Green
Write-Host ""

# Step 5: Copy to Tauri sidecar location
Write-Host "..   Copying to Tauri sidecar location..." -ForegroundColor Yellow

# Kill any running corphia-server.exe so file handles release
$running = Get-Process corphia-server -ErrorAction SilentlyContinue
if ($running) {
    Write-Host "..   Stopping running corphia-server.exe ($(($running | Measure-Object).Count) instance)..." -ForegroundColor Yellow
    $running | Stop-Process -Force
    Start-Sleep -Seconds 1
}

if (-not (Test-Path $TauriBinariesDir)) {
    New-Item -ItemType Directory -Path $TauriBinariesDir | Out-Null
}

# Robust delete with retry (Windows file locking can be sticky)
if (Test-Path $TauriTargetDir) {
    $tries = 0
    while (Test-Path $TauriTargetDir) {
        $tries++
        try {
            Remove-Item $TauriTargetDir -Recurse -Force -ErrorAction Stop
        }
        catch {
            if ($tries -ge 5) {
                Write-Host "ERROR: Cannot remove $TauriTargetDir after 5 tries." -ForegroundColor Red
                Write-Host "Likely a process still holds files. Close all Corphia AI windows and try again." -ForegroundColor Yellow
                throw
            }
            Write-Host "..   Retry $tries delete (locked files)..." -ForegroundColor Yellow
            Start-Sleep -Seconds 2
        }
    }
}
Copy-Item -Path $DistDir -Destination $TauriTargetDir -Recurse

# Tauri sees the main exe via target-triple naming convention
$SourceExe = Join-Path $TauriTargetDir "corphia-server.exe"
if (Test-Path $TauriExe) { Remove-Item $TauriExe -Force }
Copy-Item -Path $SourceExe -Destination $TauriExe

Write-Host "OK   Tauri sidecar ready: $TauriExe" -ForegroundColor Green
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " Done!" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. tools\build_installer.ps1     -- pack into NSIS/MSI installer"
Write-Host "  2. tools\build_launcher.ps1      -- pack PySide6 launcher"
Write-Host "  3. cd frontend; npx tauri dev    -- dev with sidecar (no manual uvicorn)"
Write-Host ""
