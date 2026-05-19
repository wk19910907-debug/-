# POST sample order to /api/order-notify (vercel dev or deployed site).
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\test-order-notify.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\test-order-notify.ps1 -BaseUrl "https://www.lhasasa-tashidelek.com"
#   powershell ... -JsonPath ".\scripts\sample-order-notify-paid-success.json"
param(
    [string]$BaseUrl = 'http://localhost:3000',
    [string]$JsonPath = '',
    [switch]$FreshId
)

$ErrorActionPreference = 'Stop'
if (-not $JsonPath) { $JsonPath = Join-Path $PSScriptRoot 'sample-order-notify.json' }
if (-not (Test-Path $JsonPath)) { throw "JSON not found: $JsonPath" }

$utf8 = [System.Text.UTF8Encoding]::new($false)
$raw = [System.IO.File]::ReadAllText((Resolve-Path $JsonPath).Path, $utf8)
$newOid = $null
if ($FreshId) {
    $newOid = 'TEST-' + [DateTime]::UtcNow.ToString('yyyyMMddHHmmss')
    $raw = [regex]::Replace($raw, '"order_id"\s*:\s*"[^"]*"', ('"order_id": "' + $newOid + '"'), 1)
}
$bodyBytes = $utf8.GetBytes($raw)
$uri = $BaseUrl.TrimEnd('/') + '/api/order-notify'

Write-Host '[POST]' $uri
if ($newOid) { Write-Host '[FreshId]' $newOid }
$r = Invoke-WebRequest -Uri $uri -Method POST -Body $bodyBytes -ContentType 'application/json; charset=utf-8' -UseBasicParsing
Write-Host 'Status:' $r.StatusCode
Write-Host $r.Content
