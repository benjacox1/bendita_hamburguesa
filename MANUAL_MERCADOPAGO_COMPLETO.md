# 🍔 Manual Completo: Integración Automática de MercadoPago

## 🎉 ¡Configuración Completada con Éxito!

Tu aplicación de hamburguesas ahora tiene integración **COMPLETA Y AUTOMÁTICA** con MercadoPago. El sistema se encarga de todo automáticamente.

---

## 🚀 Cómo Iniciar Tu Servidor Online

### Opción 1: Script Automático (Recomendado)
```powershell
cd backend
.\start-server-online.ps1
```

### Opción 2: Comando Directo
```powershell
cd backend
node tunnel-cloudflared.mjs
```

### Opción 3: Archivo Batch (Más Fácil)
- Doble clic en `start-server-online.bat` en la carpeta backend

---

## ⚡ Lo Que Hace El Sistema Automáticamente

### 🔧 **Al Iniciar:**
- ✅ Instala Node.js automáticamente si no existe
- ✅ Descarga cloudflared automáticamente
- ✅ Crea túnel público de Cloudflare
- ✅ Configura webhook de MercadoPago automáticamente
- ✅ Actualiza el archivo `.env` con la URL pública

### 💰 **Durante el Proceso de Pago:**
1. **Validación Automática del Carrito**
   - Verifica stock disponible
   - Calcula totales exactos
   - Valida productos existentes

2. **Creación de Pedido**
   - Descuenta stock automáticamente
   - Asigna ID único al pedido
   - Calcula importe total preciso

3. **Generación de Pago**
   - Crea preferencia de MercadoPago automáticamente
   - Incluye todos los items con precios correctos
   - Configura URLs de retorno automáticamente

4. **Procesamiento Automático**
   - Recibe webhooks de MercadoPago
   - Actualiza estado del pedido automáticamente
   - Cambia estado a "preparando" cuando se aprueba el pago
   - Repone stock si el pago es rechazado

---

## 🎯 Flujo Completo de Usuario

### Para el Cliente:
1. **Navega** a tu URL pública (ej: `https://tu-url.trycloudflare.com`)
2. **Explora** el catálogo de productos
3. **Agrega** productos al carrito
4. **Procede** al checkout
5. **Paga** con MercadoPago (tarjeta, efectivo, etc.)
6. **Recibe** confirmación automática

### Para el Administrador:
1. **Ve** pedidos en tiempo real en `/PanelAdmin`
2. **Cambia** estados de pedidos
3. **Monitorea** ventas y stock
4. **Recibe** pagos automáticamente

---

## 💳 Configuración de MercadoPago

### Credenciales Actuales (Ya Configuradas):
- **Access Token**: `APP_USR-REDACTED` (nunca publiques tu token real; usa variables de entorno)
- **Modo**: TEST (para pruebas)
- **Webhook**: Se configura automáticamente

### Para Usar en Producción:
1. Ve a [MercadoPago Developers](https://www.mercadopago.com.ar/developers)
2. Obtén tu Access Token de **PRODUCCIÓN**
3. Reemplaza `MP_ACCESS_TOKEN` en el archivo `.env`

---

## 🧪 Cómo Probar el Sistema

### Prueba Automática:
```powershell
cd backend
node test-integration.mjs https://tu-url.trycloudflare.com
```

### Prueba Manual:
1. **Ve** a tu URL pública
2. **Agrega** productos al carrito
3. **Haz** checkout
4. **Usa** tarjeta de prueba: `4509 9535 6623 3704`
5. **Verifica** que el pedido cambie a "preparando"

### Probar Webhook Manualmente:
```powershell
$body = @{
    external_reference = "ref_TEST_123"
    status = "approved"
    transaction_amount = 1500
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "https://tu-url.trycloudflare.com/webhooks/mercadopago" -ContentType "application/json" -Body $body
```

---

## 📱 URLs Importantes

### Frontend (Clientes):
- **Inicio**: `https://tu-url.trycloudflare.com/`
- **Catálogo**: `https://tu-url.trycloudflare.com/detalle-productos/`
- **Carrito**: `https://tu-url.trycloudflare.com/Carrito%20de%20compras/`

### Backend (Admin):
- **Panel Admin**: `https://tu-url.trycloudflare.com/PanelAdmin/`
- **API Health**: `https://tu-url.trycloudflare.com/api/health`
- **Config Pagos**: `https://tu-url.trycloudflare.com/api/payments/config`

### Webhooks:
- **MercadoPago**: `https://tu-url.trycloudflare.com/webhooks/mercadopago`

---

## 🔍 Monitoreo y Logs

### Ver Logs en Tiempo Real:
Los logs se muestran directamente en la consola donde ejecutaste el script.

### Información de Debug:
- `[backend]`: Mensajes del servidor
- `[tunnel]`: Mensajes del túnel de Cloudflare  
- `[cloudflared]`: Mensajes de cloudflared
- `[webhook]`: Mensajes de webhooks recibidos

### Archivo de Logs:
```
backend/logs/app.log
```

---

## 🛠️ Solución de Problemas

### Error: "Puerto en uso"
```powershell
# Usa un puerto diferente
PORT=4001 node tunnel-cloudflared.mjs
```

### Error: "No se encuentra node"
```powershell
# Reinicia PowerShell después de instalar Node.js
winget install OpenJS.NodeJS
```

### Error: "Script no ejecutable"
```powershell
# Ajusta política de ejecución
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Error: "Webhook no funciona"
1. Verifica que la URL pública esté actualizada en `.env`
2. Prueba el webhook manualmente con el script de arriba
3. Revisa los logs para ver si llegan las notificaciones

---

## 📋 Funciones Implementadas

### ✅ **Sistema de Pagos Completo**
- Integración real con MercadoPago
- Cálculo automático de totales
- Validación de stock en tiempo real
- Procesamiento automático de webhooks
- Manejo de estados de pago (aprobado/rechazado/pendiente)

### ✅ **Gestión de Inventario**
- Descuento automático de stock al crear pedido
- Reposición automática si se rechaza el pago
- Validación de disponibilidad antes del checkout

### ✅ **Experiencia de Usuario**
- Carrito persistente en localStorage
- Validación en tiempo real
- Mensajes claros de estado
- Redirección automática después del pago
- Limpieza automática del carrito tras pago exitoso

### ✅ **Panel de Administración**
- Vista de pedidos en tiempo real
- Cambio de estados de pedido
- Estadísticas de ventas
- Gestión de productos

### ✅ **Infraestructura Robusta**
- Túnel automático de Cloudflare
- URLs públicas dinámicas
- Configuración automática de webhooks
- Logs detallados para debugging

---

## 🚨 Importante para Producción

### Antes de Usar en Vivo:
1. **Cambia** las credenciales de MercadoPago a PRODUCCIÓN
2. **Configura** un dominio personalizado (opcional)
3. **Hace** backup de los datos (`backend/data/`)
4. **Prueba** todo el flujo con pagos reales pequeños

### Seguridad:
- ✅ Validación de totales automática
- ✅ Verificación de stock automática  
- ✅ Logs de todas las transacciones
- ✅ Manejo de errores robusto

---

## 🎉 ¡Listo para Vender!

Tu sistema está **100% FUNCIONAL** y listo para recibir pedidos reales. 

**¡Que tengas muchas ventas! 🍔💰**

---

*Desarrollado con ❤️ por GitHub Copilot*