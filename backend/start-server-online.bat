@echo off
REM Script para iniciar automáticamente el servidor con Cloudflare tunnel
REM Autor: GitHub Copilot
REM Uso: Doble clic en este archivo

echo.
echo === Iniciando Servidor con Cloudflare Tunnel ===
echo.

cd /d "%~dp0"

echo Verificando Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js no encontrado. Instalando...
    winget install --accept-source-agreements --accept-package-agreements OpenJS.NodeJS
    echo Reinicia este script después de la instalación.
    pause
    exit /b 1
)

echo Node.js encontrado
echo.

if not exist "node_modules" (
    echo Instalando dependencias npm...
    npm install
)

echo.
echo Iniciando servidor con tunnel de Cloudflare...
echo El servidor se iniciará automáticamente en línea con una URL pública
echo Presiona Ctrl+C para detener el servidor
echo.

node tunnel-cloudflared.mjs
pause