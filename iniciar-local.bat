@echo off
setlocal
title Bendita Hamburguesa - Inicio local
cd /d "%~dp0"

REM Verificar dependencias del backend
if not exist "backend\node_modules" (
  echo Instalando dependencias del backend...
  pushd backend
  call npm install
  popd
)

REM Iniciar backend en una nueva ventana de consola
start "Backend BH" cmd /k "cd /d \"%~dp0backend\" && npm run dev"

REM Pequeña espera para que levante el servidor
timeout /t 2 /nobreak >nul

REM Abrir el sitio en el navegador
start "" "http://localhost:4000/"

echo Listo: backend iniciado y navegador abierto.
endlocal
exit /b 0
