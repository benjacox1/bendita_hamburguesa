Detalle de Productos Dinámico
=============================

Uso:
- Plantilla única: producto.html
- Parámetro requerido: ?id=<id del producto>
- Datos base en: productos.json

Ejemplos de URL (ajusta la ruta según tu estructura principal):
  detalle de los productos/producto.html?id=hamburguesa-simple
  detalle de los productos/producto.html?id=hamburguesa-doble
  detalle de los productos/producto.html?id=lata-pepsi

IDs disponibles:
- hamburguesa-simple
- hamburguesa-doble
- lata-pepsi
- combo-simple-pepsi
- combo-doble-pepsi
- pack-2-simples
- pack-2-dobles
- pack-2-pepsi

Agregar un nuevo producto:
1. Copiar imagen en carpeta IMAGENES COMIDA.
2. Agregar objeto al array de productos.json con campos:
   id (único, sin espacios, usar guiones),
   nombre,
   descripcion,
   precio (número),
   categoria (comida, bebida, combo, promo, etc),
   imagen (ruta relativa).
3. Enlazar desde página principal: <a href="detalle de los productos/producto.html?id=ID-AQUI">Ver</a>

Integración con Pedidos:
- Al enviar el formulario se inserta el pedido en el localStorage (misma clave del Panel Admin).
- Luego se gestiona desde PanelAdmin.

Notas técnicas:
- producto.js hace fetch a productos.json (evita caché con query _=timestamp).
- Si falta ?id o no existe, muestra mensaje de error.
- Sin backend aún: para producción reemplazar por API.

Fin.
