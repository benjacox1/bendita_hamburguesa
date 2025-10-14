@echo off
echo ====================================
echo   SETUP AUTOMATICO GITHUB + NETLIFY
echo ====================================
echo.

echo [1/6] Descargando Git...
echo Visitando: https://git-scm.com/download/win
start https://git-scm.com/download/win
echo.
echo INSTRUCCIONES:
echo 1. Descarga Git desde la pagina que se abrio
echo 2. Instalalo con configuracion por defecto
echo 3. Reinicia PowerShell despues de instalar
echo 4. Ejecuta: setup-github.bat
echo.
pause

echo [2/6] Verificando instalacion de Git...
git --version
if %errorlevel% neq 0 (
    echo ERROR: Git no esta instalado correctamente
    echo Instala Git primero y ejecuta este script nuevamente
    pause
    exit /b 1
)

echo [3/6] Configurando Git...
set /p nombre="Ingresa tu nombre: "
set /p email="Ingresa tu email de GitHub: "
git config --global user.name "%nombre%"
git config --global user.email "%email%"

echo [4/6] Inicializando repositorio...
git init
git add .
git commit -m "Initial commit: Bendita Hamburguesa App completa"

echo [5/6] Configurando repositorio remoto...
set /p usuario="Ingresa tu usuario de GitHub: "
set repo_url=https://github.com/%usuario%/bendita-hamburguesa.git
git remote add origin %repo_url%
git branch -M main

echo [6/6] Subiendo codigo a GitHub...
echo NOTA: Te pedira tu usuario y password de GitHub
git push -u origin main

echo.
echo ====================================
echo   SETUP COMPLETADO!
echo ====================================
echo.
echo Tu codigo esta en: %repo_url%
echo.
echo PROXIMOS PASOS:
echo 1. Ve a netlify.com
echo 2. Conecta tu repositorio de GitHub
echo 3. Configura: Build directory = frontend
echo 4. Deploy automatico!
echo.
echo Tu pagina estara en: https://tu-nombre.netlify.app
echo.
pause