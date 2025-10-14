# Backend Bendita Hamburguesa

Backend minimalista con Node.js + Express que reemplaza el uso de localStorage para productos y pedidos.

## Requisitos
- Node.js 18+ instalado.

## Instalación
Dentro de la carpeta `backend` ejecutar (primera vez):

```bash
npm install
```

## Ejecutar servidor

Desarrollo con autoreload (Node 18+):
```bash
npm run dev
```

Producción/simple:
```bash
npm start
```

### Desarrollo con túnel Cloudflared automático (webhook listo)
Script que inicia el backend y lanza un quick tunnel de Cloudflared, detecta la URL pública y actualiza `MP_WEBHOOK` en `.env`.

```bash
npm run dev:tunnel
```
### Túnel Cloudflared automático (desarrollo)

Para exponer tu backend local (puerto 4000) a Internet y recibir webhooks sin pagar servicios:

1. Coloca `cloudflared.exe` en la raíz del proyecto o dentro de `backend/`.
2. Ejecuta:
  ```bash
  npm run dev:tunnel
  ```
3. El script `tunnel-cloudflared.mjs`:
  - Arranca el backend con `node --watch server.js`.
  - Lanza `cloudflared tunnel --url http://localhost:4000`.
  - Detecta la URL pública `https://xxxx.trycloudflare.com`.
  - Escribe / actualiza `MP_WEBHOOK=<URL>/webhooks/mercadopago` en `.env`.
4. Revisa la salida: te mostrará un comando de prueba PowerShell para simular un webhook.
5. Verifica `http://localhost:4000/api/payments/config` para confirmar el campo `webhook`.

Si no aparece la URL en ~25s, revisa tu conexión o actualiza el binario de cloudflared.

Nota: Si no tienes `cloudflared.exe`, el script intentará descargar automáticamente la última versión para Windows (amd64) desde GitHub Releases y colocarla en la raíz del proyecto.

Resultados:
1. Arranca `server.js` con `--watch`.
2. Ejecuta `cloudflared tunnel --url http://localhost:4000`.
3. Captura la primera URL `https://.....trycloudflare.com`.
4. Escribe / reemplaza `MP_WEBHOOK=<URL>/webhooks/mercadopago` en `.env`.
5. Muestra comando de prueba `curl` para simular notificación.

Requisitos previos: colocar el binario `cloudflared.exe` en la raíz del proyecto (una carpeta arriba de `backend/`).

Por defecto escucha en: `http://localhost:4000` (configurable con la variable de entorno `PORT`).

## Estructura
```
backend/
  server.js        # Servidor Express
  data/
    products.json  # Productos con stock
    orders.json    # Pedidos
```

## Modelo de Datos
### Producto
```json
{
  "id": "hamburguesa-simple",
  "nombre": "Hamburguesa Simple",
  "descripcion": "...",
  "precio": 2500,
  "categoria": "comida",
  "imagen": "IMAGENES COMIDA/2 HAMBURGUESAS DOBLES.png",
  "stock": 20
}
```
### Pedido
```json
{
  "id": "a1B2c3D4",
  "fechaCreacion": 1717440000000,
  "estado": "espera", // espera | preparando | listo | retirado
  "cliente": "Juan",
  "items": [
    {
      "productId": "hamburguesa-simple",
      "nombre": "Hamburguesa Simple",
      "precioUnitario": 2500,
      "cantidad": 2,
      "subtotal": 5000
    }
  ],
  "importe": 5000
}
```

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/products | Lista productos |
| POST | /api/products | Crea producto |
| PUT | /api/products/:id | Actualiza producto |
| DELETE | /api/products/:id | Borra producto |
| GET | /api/orders | Lista pedidos |
| GET | /api/orders/:id | Obtiene un pedido individual |
| POST | /api/orders | Crea pedido (descuenta stock y calcula importe) |
| PATCH | /api/orders/:id/state | Cambia estado de pedido |
| DELETE | /api/orders/:id | Elimina un pedido |
| POST | /api/payments/preference | Crea preferencia (real si MP_ACCESS_TOKEN, caso contrario simulada) |
| POST | /webhooks/mercadopago | Webhook Mercado Pago (simulado) |
| GET | /api/stats | Resumen simple de pedidos |

### Crear pedido (ejemplo request)
```json
POST /api/orders
{
  "cliente": "Juan",
  "items": [
    { "productId": "hamburguesa-simple", "cantidad": 1 },
    { "productId": "lata-pepsi", "cantidad": 1 }
  ]
}
```

### Cambiar estado
```json
PATCH /api/orders/abc123/state
{ "estado": "preparando" }
```

## Integración con el Frontend Existente

Actualmente el frontend usa `localStorage`:
- clave `admin_pedidos_v1`
- clave `admin_stock_v1`

Para migrar:
1. Reemplazar cargas iniciales por `fetch('http://localhost:3000/api/products')` y `fetch('http://localhost:3000/api/orders')`.
2. Al crear pedido desde detalle de producto, enviar POST `/api/orders` con items.
3. Al cambiar estado de un pedido, usar PATCH `/api/orders/:id/state`.
4. Para ajustar stock manual (si mantienes UI), hacer PUT `/api/products/:id` con campo `stock` nuevo.

### Ejemplo reemplazo en `orders.js`
```js
async function cargarPedidos() {
  const r = await fetch('http://localhost:3000/api/orders');
  pedidos = await r.json();
}
async function cambiarEstado(id, nuevo) {
  const r = await fetch(`http://localhost:3000/api/orders/${id}/state`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ estado: nuevo })
  });
  if (!r.ok) alert('Error cambiando estado');
  await cargarPedidos();
  renderPedidos();
}
```

### Ejemplo creación de pedido (detalle producto)
```js
async function crearPedido(productId, cantidad) {
  const r = await fetch('http://localhost:3000/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ productId, cantidad }] })
  });
  if (!r.ok) {
    const err = await r.json();
    alert('Error: ' + err.error);
    return;
  }
  alert('Pedido creado');
}
```

### Ejemplo actualizar stock
```js
async function actualizarStock(id, nuevoStock) {
  const r = await fetch(`http://localhost:3000/api/products/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stock: nuevoStock })
  });
  if (!r.ok) alert('Error actualizando stock');
}
```

## Flujo Operativo (Uso Diario)
1. Iniciar backend: `npm run dev`.
2. Abrir página principal (catálogo) que ahora leerá productos desde `/api/products`.
3. Cuando un cliente hace pedido (vista detalle), se envía POST `/api/orders` y el stock se descuenta automáticamente.
4. En Panel Admin:
   - Ver pedidos y avanzar estados (llamando PATCH de estado).
   - Ajustar stock puntual con PUT producto.
5. Consultar `/api/stats` para ver totales (puede integrarse a un dashboard).
6. (Pagos) Crear preferencia con POST `/api/payments/preference` y redirigir a `init_point`. El webhook marcará `paymentStatus`.

## Pagos (Integración Mercado Pago - Real / Simulada)

Campos añadidos al pedido:
```json
{
  "paymentStatus": "pending | approved | rejected | cancelled",
  "externalReference": "ref_<idPedido>"
}
```

### Flujo básico (ambos modos)
1. Creas el pedido (`paymentStatus = pending`).
2. POST `/api/payments/preference { "orderId": "<id>" }`.
3. Si existe token `MP_ACCESS_TOKEN` el backend crea preferencia real vía SDK; si no, responde con URL simulada.
4. Rediriges/abres `init_point`.
5. (Real) Mercado Pago llama al webhook `/webhooks/mercadopago`.
6. Backend actualiza `paymentStatus` y puede pasar a `preparando` si aprobado.

### Variables de entorno
| Variable | Ejemplo | Descripción |
|----------|---------|-------------|
| `MP_ACCESS_TOKEN` | `TEST-123...` | Token de acceso (modo real). Si falta → simulación. |
| `MP_BACK_SUCCESS` | `http://localhost:4000/?pago=success` | URL retorno pagos aprobados. |
| `MP_BACK_FAILURE` | `http://localhost:4000/?pago=failure` | URL retorno pagos fallidos. |
| `MP_BACK_PENDING` | `http://localhost:4000/?pago=pending` | URL retorno pagos pendientes. |
| `MP_WEBHOOK` | `http://localhost:4000/webhooks/mercadopago` | URL webhook público. |

### Ejemplo request preferencia (real o simulado)
```json
POST /api/payments/preference
{ "orderId": "ABC123XY" }
```
Respuesta simulada (sin token):
```json
{
  "init_point": "https://sandbox.mercadopago.com/checkout?pref_id=ABC123XY",
  "external_reference": "ref_ABC123XY",
  "simulated": true
}
```
Respuesta real (con token):
```json
{
  "init_point": "https://www.mercadopago.com/mla/checkout/start?pref_id=XYZ...",
  "external_reference": "ref_ABC123XY",
  "simulated": false
}
```

### Webhook (simulado) ejemplo
```json
POST /webhooks/mercadopago
{
  "external_reference": "ref_ABC123XY",
  "status": "approved"
}
```

### Producción real (resumen)
1. Definir `MP_ACCESS_TOKEN` (TEST o PROD).
2. Configurar `MP_WEBHOOK` accesible públicamente (ngrok / deploy).
3. Usar respuesta `init_point` para redirigir a pago.
4. Validar notificaciones: opcionalmente consultar Payment API antes de confirmar.
5. Guardar logs y monitorear estados inesperados.

### Seguridad
- Limitar origen del webhook (IP allowlist o verificación de firma).
- No fiarse sólo de `status` recibido: cruzar contra la API oficial.
- Registrar un log (archivo o base de datos) de cada notificación.

### Auto avance de estado
Si `paymentStatus` pasa a `approved` y el estado era `espera`, el backend lo mueve a `preparando` (puedes ajustar esta lógica).

## Logging
Se generan archivos en `backend/logs/` automáticamente:

| Archivo | Contenido |
|---------|-----------|
| `app.log` | Eventos generales: creación de pedidos, cambios de estado, creación de preferencia, errores de negocio. |
| `webhooks.log` | Notificaciones recibidas en `/webhooks/mercadopago` y errores asociados. |

Formato de línea:
```
[ISO_DATE] evento {jsonOpcional}
```

Eventos principales:
- `order.created` { id, importe, items }
- `order.state.changed` { id, estado }
- `order.deleted` { id }
- `payment.preference.created` { orderId, externalReference }
- `webhook.mercadopago` { external_reference, status, orderId, paymentStatus }
- Prefijo `error.*` para errores (create/state/delete/payment.preference/webhook)

Puedes rotar logs manualmente vaciando los archivos o moviéndolos. Para producción considerar un sistema de rotación (ej. `pino`, `winston` o `logrotate`).


## Manejo de Concurrencia y Consistencia
- Escrituras son secuenciales porque usamos lecturas/escrituras directas al archivo (no ideal en alta concurrencia, suficiente para prototipo).
- Si dos pedidos simultáneos intentan consumir el mismo stock puede darse condición de carrera; para producción usar DB transaccional.

## Seguridad / Limitaciones
- No hay autenticación.
- Cualquiera con acceso a la URL puede modificar datos.
- Archivos JSON pueden corromperse si el proceso se interrumpe durante escritura (poco probable). Copias de seguridad recomendadas.

## Próximos Pasos Recomendados
1. Autenticación (token simple o Basic Auth).
2. WebSockets (socket.io) para actualizar pedidos en tiempo real.
3. Migrar a una base de datos (SQLite/PostgreSQL).
4. Añadir historial de cambios de estado.
5. Validaciones más estrictas (precio >= 0, stock >= 0).

---
Cualquier duda sobre cómo adaptar un archivo específico del frontend, pide un ejemplo concreto y lo detallamos.

## Verificación automática rápida

Se añadió el script `check.mjs` que realiza una verificación integral mínima del backend.

Ejecutar:
```bash
npm run check
```
Variables opcionales:
```bash
BASE=http://localhost:4000/api npm run check
```
Pruebas incluidas:
- Health `/api/health`
- Listado de productos `/api/products`
- Producto individual `/api/products/:id`
- Creación de pedido `/api/orders`
- Creación de preferencia de pago `/api/payments/preference`

El script finaliza con código 0 si todo pasa; distinto de 0 si hay fallos.

## Optimización de Imágenes, WebP y Cache Busting

Se implementó un flujo para servir imágenes con alto rendimiento:

### 1. Generación de versiones WebP
Ejecuta:
```bash
npm run optimize-images
```
Esto:
- Recorre la carpeta `InicioInterfaz/detalle-productos/IMAGENES COMIDA`
- Para cada `.png` / `.jpg` genera (o actualiza si el original cambió) un `<nombre>.webp` redimensionado (máx 1000px ancho) y calidad 82.
- No elimina los archivos originales.

### 2. Servidor de imágenes `/imagenes/:file`
La ruta ahora:
- Sirve el archivo solicitado si existe.
- Si el cliente (browser) envía `Accept: image/webp` y existe una versión `.webp` del archivo solicitado (mismo nombre base) se devuelve la versión WebP automáticamente (negociación transparente) salvo que ya se pida explícitamente `.webp`.
- Restringe extensiones a: `.png`, `.jpg`, `.jpeg`, `.webp`.
- Añade cabeceras de caché agresivas: `Cache-Control: public, max-age=31536000, immutable` (1 año).

### 3. Cache busting con `?v=`
En `config.js` se definió `ASSET_VERSION`. El frontend agrega `?v=<n>` a cada URL de imagen. Para forzar a los navegadores a descargar nuevas imágenes:
1. Incrementa el valor `ASSET_VERSION` en `InicioInterfaz/config.js`.
2. Opcional: vuelve a ejecutar `npm run optimize-images` si cambiaste los originales.
3. Sube despliegue; las URLs ahora cambiarán y el navegador no usará la versión cacheada anterior.

### 4. Buenas prácticas adicionales (opcional)
| Mejora | Descripción |
|--------|-------------|
| Pre-carga crítica | Usar `<link rel="preload" as="image" href="...">` para hero o producto principal. |
| Lazy loading | Añadir `loading="lazy"` a imágenes del catálogo (aún se puede incorporar). |
| Placeholders | Generar versiones muy pequeñas blur para `src` inicial y cambiar al cargar (técnica LQIP). |
| Compresión adicional | Ajustar calidad WebP o usar AVIF (necesitarías soporte y librería). |

### 5. Flujo recomendado al añadir/actualizar imágenes
1. Copia la nueva imagen PNG/JPG a `IMAGENES COMIDA`.
2. Ejecuta `npm run optimize-images` (genera/actualiza la versión `.webp`).
3. Incrementa `ASSET_VERSION` si quieres invalidar caché inmediatamente para todos los clientes.
4. Despliega.

### 6. Cómo verificar negociación WebP
1. En Chrome/Edge abre DevTools > Network > recarga con Disable cache.
2. Click en una imagen: debe mostrar `Content-Type: image/webp` si existe variante y el archivo original era PNG/JPG.
3. Si fuerzas la URL terminando en `.png` y no existe `.webp` correspondiente verás `Content-Type: image/png`.

### 7. Rollback rápido
Si algo falla puedes volver temporalmente a `express.static` reemplazando el bloque custom en `server.js` por:
```js
app.use('/imagenes', express.static(path.join(__dirname, '..', 'InicioInterfaz', 'detalle-productos', 'IMAGENES COMIDA')));
```
Pero perderías negociación y cabeceras de caché avanzadas.

---

## Extensión: AVIF, Placeholders Blur y Validación

Se añadieron mejoras adicionales de performance visual.

### AVIF
- El script `optimize-images` ahora genera también `.avif` (calidad 50) para cada imagen.
- El servidor negocia: si el navegador acepta `image/avif` se sirve primero `.avif`; si no, intenta `.webp`; si no, original.

### Placeholders Blur (Blur-up)
- Durante la optimización se genera `placeholders.json` con versiones muy pequeñas (32px, WebP base64) de cada imagen.
- El frontend carga esta lista una sola vez (`/imagenes/placeholders.json`) y aplica un efecto blur sobre la imagen final.
- Al cargarse la imagen grande se quita el blur y se elimina el background placeholder.

### Scripts disponibles
| Script | Descripción |
|--------|-------------|
| `npm run optimize-images` | Genera `.webp`, `.avif` y `placeholders.json`. |
| `npm run validate-images` | Verifica que existan originales, variantes y placeholders. |

### Flujo sugerido completo
1. Añadir/editar PNG/JPG.
2. `npm run optimize-images`.
3. (Opcional) `npm run validate-images` para asegurarte que no falta nada.
4. Incrementar `ASSET_VERSION` para cache busting.
5. Deploy.

### Errores comunes
- Falta AVIF: volver a ejecutar `optimize-images` (quizá falló por dependencia temporal).
- Falta placeholder: verificar permisos de escritura en carpeta, re-ejecutar.
- Navegador no muestra AVIF/WebP: comprobar cabecera Accept en pestaña Network.

### Desactivar temporalmente placeholders
Quitar la clase `blur-up` y el bloque que asigna `backgroundImage` en `main.js` y `producto.js`.

### Métricas esperadas (orientativo)
- Primer render: placeholders (muy ligeros) casi instantáneos.
- TTFB imágenes optimizadas: igual que antes; peso reducido (AVIF suele 20-35% menor que WebP a igual percepción).

---
