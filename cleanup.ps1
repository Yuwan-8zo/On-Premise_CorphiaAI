# Corphia AI - Comprehensive cleanup
# ======================================================================
# Sweeps caches, logs, build artifacts, orphan folders, and one-off
# scripts that have outlived their usefulness. Then archives noisy
# root-level docs into docs/archive/.
#
# Safe to re-run: every action is a "remove if exists" / "move if not
# already moved", so multiple runs converge to the same state.
#
# Usage (from project root):
#   powershell -ExecutionPolicy Bypass -File cleanup.ps1
#   powershell -ExecutionPolicy Bypass -File cleanup.ps1 -DryRun
#
# WARNING: This deletes files for real. Run -DryRun first if unsure.
#
# What is preserved:
#   .runtime/dev-secret.key   - JWT signing key (deleting kicks all users)
#   .runtime/ngrok.json       - ngrok runtime state
#   .runtime/ngrok.env        - ngrok runtime config
#   backend/.venv/            - Python venv (huge, but you need it)
#   frontend/node_modules/    - npm deps (huge, but you need it)
#   ai_model/*.gguf           - the actual LLM weights
# ======================================================================

[CmdletBinding()]
param(
    [switch]$DryRun
)

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Corphia AI cleanup" -ForegroundColor Cyan
Write-Host "  Root:    $root"
if ($DryRun) {
    Write-Host "  Mode:    DRY RUN (no files will be deleted)" -ForegroundColor Yellow
} else {
    Write-Host "  Mode:    LIVE (files will be deleted)" -ForegroundColor Magenta
}
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$stats = @{
    Deleted   = 0
    Moved     = 0
    Skipped   = 0
    Errors    = 0
    BytesFreed = 0L
}

function Get-PathSize {
    param([string]$Path)
    try {
        if (-not (Test-Path -LiteralPath $Path)) { return 0L }
        $item = Get-Item -LiteralPath $Path -Force -ErrorAction Stop
        if ($item.PSIsContainer) {
            return (Get-ChildItem -LiteralPath $Path -Recurse -Force -ErrorAction SilentlyContinue |
                    Measure-Object -Property Length -Sum -ErrorAction SilentlyContinue).Sum
        }
        return $item.Length
    } catch {
        return 0L
    }
}

function Remove-Target {
    param(
        [string]$Path,
        [string]$Reason
    )
    if (-not (Test-Path -LiteralPath $Path)) {
        $script:stats.Skipped++
        Write-Host "  [skip]    $Path  (does not exist)" -ForegroundColor DarkGray
        return
    }
    $size = Get-PathSize -Path $Path
    if ($null -eq $size) { $size = 0L }
    if ($DryRun) {
        Write-Host "  [DRY]     $Path  ($([math]::Round($size/1MB,2)) MB)  - $Reason" -ForegroundColor Yellow
        return
    }
    try {
        Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
        $script:stats.Deleted++
        $script:stats.BytesFreed += $size
        Write-Host "  [DEL]     $Path  ($([math]::Round($size/1MB,2)) MB)" -ForegroundColor Red
    } catch {
        $script:stats.Errors++
        Write-Host "  [ERR]     $Path  - $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Remove-Glob {
    param(
        [string]$BasePath,
        [string]$Pattern,
        [switch]$Recurse,
        [string]$Reason = 'pattern match'
    )
    if (-not (Test-Path -LiteralPath $BasePath)) {
        return
    }
    $params = @{
        Path        = $BasePath
        Filter      = $Pattern
        Force       = $true
        ErrorAction = 'SilentlyContinue'
    }
    if ($Recurse) { $params['Recurse'] = $true }
    $matches = Get-ChildItem @params
    foreach ($m in $matches) {
        Remove-Target -Path $m.FullName -Reason $Reason
    }
}

function Move-Target {
    param(
        [string]$From,
        [string]$To,
        [string]$Reason
    )
    if (-not (Test-Path -LiteralPath $From)) {
        $script:stats.Skipped++
        Write-Host "  [skip]    $From  (does not exist)" -ForegroundColor DarkGray
        return
    }
    if (Test-Path -LiteralPath $To) {
        $script:stats.Skipped++
        Write-Host "  [skip]    $To  (already exists; remove manually if desired)" -ForegroundColor DarkGray
        return
    }
    if ($DryRun) {
        Write-Host "  [DRY MV]  $From -> $To  - $Reason" -ForegroundColor Yellow
        return
    }
    try {
        $destDir = Split-Path -Parent $To
        if (-not (Test-Path -LiteralPath $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }
        Move-Item -LiteralPath $From -Destination $To -Force -ErrorAction Stop
        $script:stats.Moved++
        Write-Host "  [MOVE]    $From -> $To" -ForegroundColor Green
    } catch {
        $script:stats.Errors++
        Write-Host "  [ERR]     $From -> $To  - $($_.Exception.Message)" -ForegroundColor Red
    }
}

# ----------------------------------------------------------------------
# Phase 1: Python caches everywhere
# ----------------------------------------------------------------------
Write-Host "== Phase 1: Python caches ==" -ForegroundColor Cyan
$pycacheDirs = Get-ChildItem -Path $root -Recurse -Force -Directory `
    -Include '__pycache__','.pytest_cache','.mypy_cache','.ruff_cache' `
    -ErrorAction SilentlyContinue |
    Where-Object {
        $_.FullName -notmatch '\\\.venv\\' -and
        $_.FullName -notmatch '\\node_modules\\' -and
        $_.FullName -notmatch '\\\.git\\'
    }
foreach ($d in $pycacheDirs) {
    Remove-Target -Path $d.FullName -Reason 'python cache'
}

$pycFiles = Get-ChildItem -Path $root -Recurse -Force -File -Filter '*.pyc' -ErrorAction SilentlyContinue |
    Where-Object {
        $_.FullName -notmatch '\\\.venv\\' -and
        $_.FullName -notmatch '\\node_modules\\' -and
        $_.FullName -notmatch '\\\.git\\'
    }
foreach ($f in $pycFiles) {
    Remove-Target -Path $f.FullName -Reason 'orphan .pyc'
}

# ----------------------------------------------------------------------
# Phase 2: Logs and crash dumps
# ----------------------------------------------------------------------
Write-Host ""
Write-Host "== Phase 2: Logs and crash dumps ==" -ForegroundColor Cyan
Remove-Target -Path (Join-Path $root 'backend\crash.log')                  -Reason 'crash log'
Remove-Target -Path (Join-Path $root 'backend\logs')                       -Reason 'rotated app logs'
Remove-Target -Path (Join-Path $root '.runtime\backend.log')               -Reason 'boot log'
Remove-Target -Path (Join-Path $root '.runtime\backend.out.log')           -Reason 'boot log'
Remove-Target -Path (Join-Path $root '.runtime\backend.err.log')           -Reason 'boot log'
Remove-Target -Path (Join-Path $root '.runtime\frontend.log')              -Reason 'boot log'
Remove-Target -Path (Join-Path $root '.runtime\frontend.out.log')          -Reason 'boot log'
Remove-Target -Path (Join-Path $root '.runtime\frontend.err.log')          -Reason 'boot log'
Remove-Target -Path (Join-Path $root '.runtime\frontend-vite.log')         -Reason 'boot log'
Remove-Target -Path (Join-Path $root '.runtime\vite-dev.log')              -Reason 'boot log'
Remove-Target -Path (Join-Path $root '.runtime\init-db.log')               -Reason 'boot log'
Remove-Target -Path (Join-Path $root '.runtime\start-test.out')            -Reason 'old test output'
Remove-Target -Path (Join-Path $root '.runtime\start-test.err')            -Reason 'old test output'
Remove-Target -Path (Join-Path $root '.runtime\screenshots')               -Reason 'design iteration screenshots'
Remove-Target -Path (Join-Path $root '.runtime\login-desktop.png')         -Reason 'design screenshot'
Remove-Target -Path (Join-Path $root '.runtime\login-mobile.png')          -Reason 'design screenshot'

# ----------------------------------------------------------------------
# Phase 3: Build artifacts
# ----------------------------------------------------------------------
Write-Host ""
Write-Host "== Phase 3: Build artifacts ==" -ForegroundColor Cyan
Remove-Target -Path (Join-Path $root 'frontend\dist')                      -Reason 'vite build output'
Remove-Target -Path (Join-Path $root 'frontend\tsconfig.node.tsbuildinfo') -Reason 'incremental build cache'
Remove-Glob   -BasePath (Join-Path $root 'frontend') -Pattern 'build_err*.txt' -Reason 'old build error logs'
Remove-Target -Path (Join-Path $root 'backend\corphia.db')                 -Reason 'orphan SQLite (project uses Postgres)'
Remove-Target -Path (Join-Path $root 'backend\screenshots')                -Reason 'one-off test screenshot'
Remove-Target -Path (Join-Path $root 'backend\.pytest_cache')              -Reason 'pytest cache'

# ----------------------------------------------------------------------
# Phase 4: Stale Claude worktrees
# ----------------------------------------------------------------------
Write-Host ""
Write-Host "== Phase 4: Stale Claude worktrees ==" -ForegroundColor Cyan
Remove-Target -Path (Join-Path $root '.claude\worktrees\interesting-murdock-952bd9') `
              -Reason 'old DLI worktree'
# also kill any older worktrees just in case
$worktreesRoot = Join-Path $root '.claude\worktrees'
if (Test-Path -LiteralPath $worktreesRoot) {
    Get-ChildItem -LiteralPath $worktreesRoot -Directory -Force -ErrorAction SilentlyContinue |
        ForEach-Object {
            Remove-Target -Path $_.FullName -Reason 'stale worktree'
        }
}

# ----------------------------------------------------------------------
# Phase 5: Orphan / one-off folders & scripts at root
# ----------------------------------------------------------------------
Write-Host ""
Write-Host "== Phase 5: Orphan folders and one-off scripts ==" -ForegroundColor Cyan
Remove-Target -Path (Join-Path $root 'archive_scripts')                    -Reason 'pre-archived junk'
Remove-Target -Path (Join-Path $root 'exports\corphiaai-intro-video')      -Reason 'orphan demo asset (parent exports/ kept - has design backgrounds)'
Remove-Target -Path (Join-Path $root 'extract_report.py')                  -Reason 'one-off base64 decoder'
Remove-Target -Path (Join-Path $root 'CLAUDE_TEST_MARKER.txt')             -Reason 'test marker'

# Frontend one-off color migration scripts (their job is done)
$frontendScripts = Join-Path $root 'frontend\scripts'
Remove-Target -Path (Join-Path $frontendScripts 'cleanup_blind.py')        -Reason 'one-off color migration'
Remove-Target -Path (Join-Path $frontendScripts 'cleanup_colors.py')       -Reason 'one-off color migration'
Remove-Target -Path (Join-Path $frontendScripts 'cleanup_hex.py')          -Reason 'one-off color migration'
Remove-Target -Path (Join-Path $frontendScripts 'cleanup_hex_2.py')        -Reason 'one-off color migration'
Remove-Target -Path (Join-Path $frontendScripts 'cleanup_hex_3.py')        -Reason 'one-off color migration'
Remove-Target -Path (Join-Path $frontendScripts 'cleanup_ios_blue.py')     -Reason 'one-off color migration'
Remove-Target -Path (Join-Path $frontendScripts 'migrate_colors.py')       -Reason 'one-off color migration'
Remove-Target -Path (Join-Path $frontendScripts 'safe_migrate.py')         -Reason 'one-off color migration'

# scratch_puppeteer is a node_modules-bloated experiment; nuke it
Remove-Target -Path (Join-Path $root 'frontend\scratch_puppeteer')         -Reason 'orphan puppeteer scratchpad'

# ----------------------------------------------------------------------
# Phase 6: Unused frontend component
# ----------------------------------------------------------------------
Write-Host ""
Write-Host "== Phase 6: Unused frontend code ==" -ForegroundColor Cyan
Remove-Target -Path (Join-Path $root 'frontend\src\features\auth\components\QrAccessModal.tsx') `
              -Reason 'unused (export already removed from index.ts)'

# ----------------------------------------------------------------------
# Phase 7: Move noisy root docs into docs/archive/
# ----------------------------------------------------------------------
Write-Host ""
Write-Host "== Phase 7: Archive root-level design docs ==" -ForegroundColor Cyan
$archiveDir = Join-Path $root 'docs\archive'
$reportsDir = Join-Path $root 'docs\reports'

Move-Target -From (Join-Path $root 'design-changelog.md') `
            -To   (Join-Path $archiveDir 'design-changelog.md') `
            -Reason 'session design notes'
Move-Target -From (Join-Path $root 'design-scorecard.md') `
            -To   (Join-Path $archiveDir 'design-scorecard.md') `
            -Reason 'session design notes'
Move-Target -From (Join-Path $root 'design-review.md') `
            -To   (Join-Path $archiveDir 'design-review.md') `
            -Reason 'session design notes'
Move-Target -From (Join-Path $root 'CHANGELOG_session.md') `
            -To   (Join-Path $archiveDir 'CHANGELOG_session.md') `
            -Reason 'session changelog'
Move-Target -From (Join-Path $root 'frontend\implementation_plan.md') `
            -To   (Join-Path $archiveDir 'frontend-implementation_plan.md') `
            -Reason 'old planning doc'
Move-Target -From (Join-Path $root 'Corphia_AI_前端壓測報告.html') `
            -To   (Join-Path $reportsDir 'Corphia_AI_前端壓測報告.html') `
            -Reason 'test report'

# ----------------------------------------------------------------------
# Phase 8: Move utility scripts at root into scripts/
# ----------------------------------------------------------------------
Write-Host ""
Write-Host "== Phase 8: Tidy utility scripts ==" -ForegroundColor Cyan
$scriptsDir = Join-Path $root 'scripts'
Move-Target -From (Join-Path $root 'ngrok_reset.py') `
            -To   (Join-Path $scriptsDir 'ngrok_reset.py') `
            -Reason 'utility script belongs in scripts/'

# ----------------------------------------------------------------------
# Phase 9: Duplicate build scripts (canonical lives in tools/)
# ----------------------------------------------------------------------
# tools/build_*.ps1 are the canonical / more evolved versions (they
# resolve project paths, mirror to releases/, etc). The copies that
# accumulated at root / backend/ / launcher/ during dev are obsolete.
Write-Host ""
Write-Host "== Phase 9: Duplicate build scripts (tools/ is canonical) ==" -ForegroundColor Cyan
Remove-Target -Path (Join-Path $root 'build_installer.ps1') `
              -Reason 'duplicate - use tools\build_installer.ps1'
Remove-Target -Path (Join-Path $root 'backend\build_backend.ps1') `
              -Reason 'duplicate - use tools\build_backend.ps1'
Remove-Target -Path (Join-Path $root 'launcher\build_launcher.ps1') `
              -Reason 'duplicate - use tools\build_launcher.ps1'

# ----------------------------------------------------------------------
# Phase 10: One-off icon generation scripts (their job is done)
# ----------------------------------------------------------------------
# These were used once to convert the rectangular Corphia logo into a
# square branded .ico for Tauri. The output (Corphia_Icon_Branded.png)
# is what we keep; the recipes themselves can go.
Write-Host ""
Write-Host "== Phase 10: One-off icon generation scripts ==" -ForegroundColor Cyan
Remove-Target -Path (Join-Path $root 'frontend\src-tauri\make-square-icon.ps1') `
              -Reason 'one-off - padded Light icon to square (done)'
Remove-Target -Path (Join-Path $root 'frontend\src-tauri\make-branded-icon.ps1') `
              -Reason 'one-off - composited bronze-bg branded icon (done)'

# ----------------------------------------------------------------------
# Phase 11: Intermediate icon files
# ----------------------------------------------------------------------
# These are intermediate PNGs produced by the make-*-icon scripts.
# Only Corphia_Icon_Branded.png needs to stick around (so the Tauri
# `icon` CLI can be re-run); the square paddings can be regenerated
# from Corphia_Icon_Light.png / Corphia_Icon_Dark.png if ever needed.
Write-Host ""
Write-Host "== Phase 11: Intermediate icon PNGs ==" -ForegroundColor Cyan
Remove-Target -Path (Join-Path $root 'frontend\src\assets\Corphia_Icon_Square.png') `
              -Reason 'intermediate (regen from Light + make-square-icon)'
Remove-Target -Path (Join-Path $root 'frontend\src\assets\Corphia_Icon_Dark_Square.png') `
              -Reason 'intermediate (regen from Dark + make-square-icon)'

# ----------------------------------------------------------------------
# Phase 12: Lottie animation infrastructure (cancelled)
# ----------------------------------------------------------------------
# We started building a LottieIcon wrapper for animated UI icons but the
# direction was abandoned (decided against full-on Lottie integration to
# keep bundle small). Stub file + planning README go.
Write-Host ""
Write-Host "== Phase 12: Cancelled Lottie integration ==" -ForegroundColor Cyan
Remove-Target -Path (Join-Path $root 'frontend\src\components\icons\LottieIcon.tsx') `
              -Reason 'stub - lottie integration cancelled'
Remove-Target -Path (Join-Path $root 'frontend\src\assets\lottie') `
              -Reason 'cancelled lottie asset folder (only had README)'

# ----------------------------------------------------------------------
# Phase 13: Old launchers superseded by PySide6 launcher
# ----------------------------------------------------------------------
# Corphia AI.bat was a quick-and-dirty double-click starter while we
# were still figuring out distribution. Replaced by launcher/ +
# tools/build_launcher.ps1 producing a real PySide6 GUI exe.
Write-Host ""
Write-Host "== Phase 13: Superseded launchers ==" -ForegroundColor Cyan
Remove-Target -Path (Join-Path $root 'Corphia AI.bat') `
              -Reason 'superseded by launcher/corphia_launcher.py + PySide6 build'

# ----------------------------------------------------------------------
# Summary
# ----------------------------------------------------------------------
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Cleanup summary" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ("  Deleted:    {0} items" -f $stats.Deleted)
Write-Host ("  Moved:      {0} items" -f $stats.Moved)
Write-Host ("  Skipped:    {0} items (already gone or already moved)" -f $stats.Skipped)
Write-Host ("  Errors:     {0}" -f $stats.Errors)
Write-Host ("  Freed:      ~{0} MB" -f [math]::Round($stats.BytesFreed / 1MB, 2))
Write-Host ""
if ($DryRun) {
    Write-Host "  This was a DRY RUN - re-run without -DryRun to apply." -ForegroundColor Yellow
} else {
    Write-Host "  Done. Run 'git status' to review changes before committing." -ForegroundColor Green
}
Write-Host ""
