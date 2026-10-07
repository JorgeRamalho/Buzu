# Compara producao (buzzu.vercel.app) com a branch main do GitHub.
$ErrorActionPreference = 'Stop'
$prodUrl = 'https://buzzu.vercel.app'
$checks = @(
  @{ Name = 'route-street-modal'; Pattern = 'route-street-modal' },
  @{ Name = 'leaflet'; Pattern = 'leaflet@1.9.4' },
  @{ Name = 'routePlanningSeed'; Pattern = 'routePlanningSeed' },
  @{ Name = 'build-meta'; Pattern = 'street-map-osrm-sync' }
)

Write-Host '=== Buzzu: paridade producao vs GitHub main ===' -ForegroundColor Cyan
$html = (Invoke-WebRequest -Uri $prodUrl -UseBasicParsing).Content
foreach ($c in $checks) {
  $ok = $html -match $c.Pattern
  $color = if ($ok) { 'Green' } else { 'Red' }
  $label = if ($ok) { 'OK' } else { 'FALTA' }
  Write-Host "$label $($c.Name)" -ForegroundColor $color
}

try {
  $health = (Invoke-WebRequest -Uri "$prodUrl/api/health" -UseBasicParsing).Content | ConvertFrom-Json
  if ($health.commit) {
    Write-Host "OK API health commit: $($health.commit)" -ForegroundColor Green
  } else {
    Write-Host 'AVISO API sem campo commit — deploy antigo na Vercel' -ForegroundColor Yellow
  }
} catch {
  Write-Host 'ERRO /api/health indisponivel' -ForegroundColor Red
}

try {
  $maps = Invoke-WebRequest -Uri "$prodUrl/api/maps/config" -UseBasicParsing
  Write-Host "OK /api/maps/config status $($maps.StatusCode)" -ForegroundColor Green
} catch {
  Write-Host 'FALTA /api/maps/config — commit com mapa de ruas nao publicado' -ForegroundColor Red
}

Write-Host ''
Write-Host 'Se houver FALTA: Vercel Deployments -> Redeploy do ultimo commit da main ou reconecte o Git.' -ForegroundColor Gray
