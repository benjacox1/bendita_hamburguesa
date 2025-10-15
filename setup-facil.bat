@echo off
echo ===============================================
echo   SETUP SUPER FACIL CON GITHUB DESKTOP
echo ===============================================
echo.

echo [OPCION 1] Descargando GitHub Desktop...
echo Visitando: https://desktop.github.com/
start https://desktop.github.com/
echo.
echo INSTRUCCIONES GITHUB DESKTOP:
echo 1. Descarga GitHub Desktop desde la pagina que se abrio
echo 2. Instalalo y inicia sesion con tu cuenta GitHub
echo 3. Clic en "Add an Existing Repository from your hard drive"
echo 4. Selecciona esta carpeta: E:\paginaweb
echo 5. Clic en "Publish repository"
echo 6. Nombre: bendita-hamburguesa
echo 7. Descripcion: App de hamburguesas con MercadoPago
echo 8. Asegurate que sea PUBLICO
echo 9. Clic en "Publish Repository"
echo.
pause

echo [OPCION 2] Setup con Netlify CLI...
echo Instalando Netlify CLI...
npm install -g netlify-cli
echo.
echo Ahora puedes usar:
echo netlify deploy --prod --dir=frontend
echo.
pause

echo ===============================================
echo   CONFIGURACION NETLIFY
echo ===============================================
echo.
echo Ve a: https://netlify.com
echo 1. Registrate con GitHub
echo 2. "New site from Git"
echo 3. Selecciona tu repositorio "bendita-hamburguesa"
echo 4. Build settings:
echo    - Build command: npm run build
echo    - Publish directory: frontend
echo 5. Deploy site
echo.
echo Tu pagina estara en: https://bendita-hamburguesa-[random].netlify.app
echo.
pause

echo ===============================================
echo   CONFIGURACION RAILWAY (BACKEND)
echo ===============================================
echo.
echo Ve a: https://railway.app
echo 1. Registrate con GitHub
echo 2. "Deploy from GitHub repo"
echo 3. Selecciona "bendita-hamburguesa"
echo 4. Variables de entorno:
echo    - MP_ACCESS_TOKEN = APP_USR-REDACTED
echo    - PORT = 4000
echo    - NODE_ENV = production
echo 5. Deploy automatico
echo.
echo Tu API estara en: https://tu-app.railway.app
echo.
pause

echo ===============================================
echo   RESUMEN FINAL
echo ===============================================
echo.
echo FRONTEND: https://bendita-hamburguesa-[random].netlify.app
echo BACKEND:  https://tu-app.railway.app
echo CODIGO:   https://github.com/TU-USUARIO/bendita-hamburguesa
echo.
echo CARACTERISTICAS:
echo [x] URL estable permanente
echo [x] HTTPS automatico
echo [x] Deploy automatico en cada cambio
echo [x] CDN global para velocidad
echo [x] Pagos reales con MercadoPago
echo [x] Panel de administracion
echo [x] Design responsive
echo [x] Animaciones profesionales
echo.
echo TU APLICACION ESTA LISTA PARA RECIBIR PEDIDOS REALES!
echo.
pause