Param(
  [int]$Port = 4000,
  [switch]$NoVerify,
  [switch]$FlowTest
)

# Colocar ubicación en la carpeta del script
Set-Location -Path $PSScriptRoot

Write-Host "[run-backend] Iniciando backend en puerto $Port ..." -ForegroundColor Cyan

# Lanzar servidor en una nueva ventana de PowerShell para que quede vivo
# (Usa -NoExit para que puedas ver logs)
$serverCmd = "cd `"$PSScriptRoot`"; node server.js $Port"
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoLogo -NoProfile -NoExit -Command $serverCmd" | Out-Null

# Esperar a que levante health (hasta 25 intentos * 200ms = 5s)
$base = "http://localhost:$Port"
$ok = $false
for($i=0; $i -lt 25; $i++){
  try {
    $resp = Invoke-RestMethod -Uri "$base/api/health" -TimeoutSec 2 -Method GET -ErrorAction Stop
    if($resp.ok){ $ok = $true; break }
  } catch { Start-Sleep -Milliseconds 200 }
}

if(-not $ok){
  Write-Host "[run-backend] No respondió health en $base" -ForegroundColor Yellow
} else {
  Write-Host "[run-backend] Health OK en $base" -ForegroundColor Green
}

# Mostrar versión
try {
  $version = Invoke-RestMethod -Uri "$base/api/version" -TimeoutSec 2 -Method GET
  Write-Host "[run-backend] Version: pid=$($version.pid) mpNewApi=$($version.mpNewApi) node=$($version.node)" -ForegroundColor Gray
} catch {
  Write-Host "[run-backend] No se pudo obtener /api/version" -ForegroundColor DarkYellow
}

if($NoVerify){
  Write-Host "[run-backend] Omitiendo tests por --NoVerify" -ForegroundColor DarkCyan
  return
}

# Test rápido de credencial (si existe token)
if(Test-Path "$PSScriptRoot/.env"){
  $envLines = Get-Content "$PSScriptRoot/.env"
  if($envLines -match '^MP_ACCESS_TOKEN='){ 
    Write-Host "[run-backend] Ejecutando payment-check.mjs" -ForegroundColor Cyan
    try { node payment-check.mjs } catch { Write-Host "[run-backend] payment-check.mjs fallo: $($_.Exception.Message)" -ForegroundColor Red }
  } else {
    Write-Host "[run-backend] MP_ACCESS_TOKEN no está definido en .env (modo simulado)" -ForegroundColor Yellow
  }
}

if($FlowTest){
  Write-Host "[run-backend] Ejecutando flujo completo payment-flow-verify.mjs" -ForegroundColor Cyan
  try { node payment-flow-verify.mjs } catch { Write-Host "[run-backend] flow verify fallo: $($_.Exception.Message)" -ForegroundColor Red }
}

Write-Host "[run-backend] Listo. Usa Ctrl+C en la ventana del servidor para detenerlo." -ForegroundColor Cyan
