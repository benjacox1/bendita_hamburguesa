# Migración a `detalle-productos/`

Se reemplazó la carpeta original `detalle de los productos/` por `detalle-productos/` para evitar problemas con espacios en rutas y enlaces.

## Qué se cambió
- Nuevos archivos en `InicioInterfaz/detalle-productos/`: `producto.html`, `producto.js`, `producto.css`, `productos.json`.
- `main.js` ahora genera enlaces a `detalle-productos/producto.html?id=...`.
- `carrito.js` actualiza la ruta de imágenes.
- `server.js` sirve imágenes desde la nueva carpeta y mantiene fallback a la antigua mientras dure la migración.
- Se añadieron fallbacks `onerror` en imágenes para intentar la ruta vieja si no se movieron aún los archivos.

## Estado
Migración finalizada. Código limpiado: ya no existen fallbacks a la ruta con espacios.

## Pendiente manual (si aún no lo hiciste)
1. Verifica que la carpeta antigua haya sido eliminada.
2. Revisa que ninguna documentación externa (fuera del repo) use la ruta vieja.

## Limpieza aplicada
- Eliminados fallbacks `onerror`.
- Middleware `/imagenes` simplificado a una sola ubicación.

## Verificación rápida
- Home: tarjetas abren detalle sin 404.
- Detalle: muestra imagen y permite agregar al carrito.
- Carrito: miniaturas se ven correctamente.

Si algo falla, revisar consola (F12) y buscar mensajes `[CATALOGO]` o `[DETALLE]`.
