# One-click: import selection -> hydrate images -> optional local unify -> git push
param(
  [int]$Top = 10,
  [switch]$SkipImages,
  [switch]$SkipPush
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot | Split-Path -Parent
$bridge = Join-Path $env:USERPROFILE ".openclaw\scripts\bridge-selection-to-lhasa.ps1"
$sel = Join-Path $env:USERPROFILE ".openclaw\workspace\data\pet-selection\selection.json"

Set-Location $root

if (Test-Path $bridge) {
  if ($SkipImages) {
    & powershell -NoProfile -ExecutionPolicy Bypass -File $bridge -Top $Top
  } else {
    & powershell -NoProfile -ExecutionPolicy Bypass -File $bridge -Top $Top -RunImagePipeline
  }
} elseif (Test-Path $sel) {
  python ".\scripts\selection_json_to_products.py" --selection $sel --top $Top
} else {
  throw "No selection source; run pet selection daily first"
}

Write-Host "[publish] hydrating images from product pages..."
python ".\scripts\hydrate_product_images_from_pages.py"
if ($LASTEXITCODE -ne 0) { Write-Warning "hydrate skipped or partial" }

if (-not $SkipPush) {
  git add data/products.json js css scripts
  $msg = "feat: publish pet catalog ($Top SKUs)"
  git commit -m $msg 2>$null
  if ($LASTEXITCODE -eq 0) {
    git push
    Write-Host "[OK] Pushed to remote; Vercel will deploy if connected."
  } else {
    Write-Host "[INFO] Nothing to commit or commit failed; check git status"
    git status -sb
  }
}

Write-Host "[DONE] Local preview: npx --yes serve . -l 3456  then open http://localhost:3456/shop/"
