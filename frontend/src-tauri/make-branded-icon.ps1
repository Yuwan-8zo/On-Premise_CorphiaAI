# Corphia branded icon generator
# ===============================
# Composites a 1024x1024 icon with:
#   - Bronze rounded-square background (#B49466 — Corphia accent color)
#   - White Corphia C+star foreground (from Corphia_Icon_Dark.png), centered, ~70% size
#
# This produces a "filled" icon that stays visible at 16x16 (file explorer thumbs),
# unlike the previous "transparent C" version which disappeared at small sizes.
#
# Output: src/assets/Corphia_Icon_Branded.png
# Usage:  powershell -ExecutionPolicy Bypass -File make-branded-icon.ps1

Add-Type -AssemblyName System.Drawing

$srcPath = "D:\Antigravity\on-premise_CorphiaAI\frontend\src\assets\Corphia_Icon_Dark.png"
$dstPath = "D:\Antigravity\on-premise_CorphiaAI\frontend\src\assets\Corphia_Icon_Branded.png"

if (-not (Test-Path $srcPath)) {
    Write-Host "ERROR: Source icon not found: $srcPath" -ForegroundColor Red
    exit 1
}

# ── Canvas / background ─────────────────────────────────
$size = 1024
$cornerRadius = 220   # ~22% radius — modern app-icon look (similar to macOS/iOS)

$bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

# Transparent base
$g.Clear([System.Drawing.Color]::Transparent)

# Bronze background: corphia accent #B49466
$bronze = [System.Drawing.Color]::FromArgb(255, 180, 148, 102)
$bgBrush = New-Object System.Drawing.SolidBrush($bronze)

# Rounded-square path
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$d = $cornerRadius * 2
$path.AddArc(0, 0, $d, $d, 180, 90)
$path.AddArc($size - $d, 0, $d, $d, 270, 90)
$path.AddArc($size - $d, $size - $d, $d, $d, 0, 90)
$path.AddArc(0, $size - $d, $d, $d, 90, 90)
$path.CloseFigure()
$g.FillPath($bgBrush, $path)

# ── Foreground: paste Corphia_Icon_Dark.png ─────────────
$fg = [System.Drawing.Image]::FromFile($srcPath)
# Scale foreground to ~70% of canvas, preserving aspect ratio
$fgScale = 0.70
$fgMaxSide = [int]($size * $fgScale)

# Compute target size keeping aspect ratio
$ratio = [Math]::Min($fgMaxSide / $fg.Width, $fgMaxSide / $fg.Height)
$fgW = [int]($fg.Width * $ratio)
$fgH = [int]($fg.Height * $ratio)
$fgX = [int](($size - $fgW) / 2)
$fgY = [int](($size - $fgH) / 2)

$g.DrawImage($fg, $fgX, $fgY, $fgW, $fgH)

# Save
$bmp.Save($dstPath, [System.Drawing.Imaging.ImageFormat]::Png)

# Cleanup
$g.Dispose()
$bgBrush.Dispose()
$path.Dispose()
$fg.Dispose()
$bmp.Dispose()

Write-Host "OK   Branded icon saved to: $dstPath" -ForegroundColor Green
Write-Host "     Size: ${size}x${size}, bronze bg + Corphia C centered" -ForegroundColor Gray
Write-Host ""
Write-Host "Next: regenerate Tauri icon set:" -ForegroundColor Yellow
Write-Host "  cd D:\Antigravity\on-premise_CorphiaAI\frontend"
Write-Host "  npx @tauri-apps/cli icon src/assets/Corphia_Icon_Branded.png"
Write-Host ""
