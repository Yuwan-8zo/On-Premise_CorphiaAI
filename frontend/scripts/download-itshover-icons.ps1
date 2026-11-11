# 在有網路時執行，將 Its Hover registry JSON 下載到 scripts/itshover-registry/
# 地端建置請改跑: node scripts/extract-itshover-icons.mjs
param(
    [string[]] $Icons = @(
        'globe-icon',
        'copy-icon',
        'lock-icon',
        'shield-check',
        'triangle-alert-icon',
        'file-description-icon'
    )
)

$ErrorActionPreference = 'Stop'
$registryDir = Join-Path $PSScriptRoot 'itshover-registry'
New-Item -ItemType Directory -Force -Path $registryDir | Out-Null

foreach ($name in $Icons) {
    $url = "https://itshover.com/r/$name.json"
    $out = Join-Path $registryDir "$name.json"
    Write-Host "Downloading $name ..."
    Invoke-WebRequest -Uri $url -OutFile $out -TimeoutSec 60
}

Write-Host "Done. Run: npm run icons:extract"
