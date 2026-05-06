# Corphia icon 補正方形腳本
# Tauri icon CLI 要求 source 必須是正方形 PNG
# 這個腳本會把原本 1437x1325 的 Corphia_Icon_Light.png
# 用透明 padding 補成 1437x1437，存成 Corphia_Icon_Square.png

Add-Type -AssemblyName System.Drawing

$srcPath = "D:\Antigravity\on-premise_CorphiaAI\frontend\src\assets\Corphia_Icon_Light.png"
$dstPath = "D:\Antigravity\on-premise_CorphiaAI\frontend\src\assets\Corphia_Icon_Square.png"

if (-not (Test-Path $srcPath)) {
    Write-Host "❌ 來源檔案不存在: $srcPath" -ForegroundColor Red
    exit 1
}

$img = [System.Drawing.Image]::FromFile($srcPath)
Write-Host "📐 原圖尺寸: $($img.Width) x $($img.Height)"

$size = [Math]::Max($img.Width, $img.Height)
Write-Host "📐 輸出尺寸: $size x $size (正方形)"

$bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.Clear([System.Drawing.Color]::Transparent)

$x = [int](($size - $img.Width) / 2)
$y = [int](($size - $img.Height) / 2)
$g.DrawImage($img, $x, $y, $img.Width, $img.Height)

$bmp.Save($dstPath, [System.Drawing.Imaging.ImageFormat]::Png)

$g.Dispose()
$bmp.Dispose()
$img.Dispose()

Write-Host "✅ 已輸出: $dstPath" -ForegroundColor Green
