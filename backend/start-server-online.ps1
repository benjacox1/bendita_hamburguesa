# Script para iniciar automáticamente el servidor con Cloudflare tunnel
# Autor: GitHub Copilot
# Uso: .\start-server-online.ps1

Write-Host "=== Iniciando Servidor con Cloudflare Tunnel ===" -ForegroundColor Cyan
Write-Host ""

# Cambiar a la carpeta del backend
Set-Location -Path $PSScriptRoot

# Verificar que Node.js está disponible
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js encontrado: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js no encontrado. Instalando..." -ForegroundColor Red
    winget install --accept-source-agreements --accept-package-agreements OpenJS.NodeJS
    # Refrescar PATH
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")
    $nodeVersion = node --version
    Write-Host "✓ Node.js instalado: $nodeVersion" -ForegroundColor Green
}

# Verificar dependencias npm
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Instalando dependencias npm..." -ForegroundColor Yellow
    npm install
    Write-Host "✓ Dependencias instaladas" -ForegroundColor Green
} else {
    Write-Host "✓ Dependencias npm encontradas" -ForegroundColor Green
}

Write-Host ""
Write-Host "🚀 Iniciando servidor con tunnel de Cloudflare..." -ForegroundColor Cyan
Write-Host "   El servidor se iniciará automáticamente en línea con una URL pública" -ForegroundColor Gray
Write-Host "   Presiona Ctrl+C para detener el servidor" -ForegroundColor Gray
Write-Host ""

# Ejecutar el tunnel script que maneja todo automáticamente
node tunnel-cloudflared.mjs