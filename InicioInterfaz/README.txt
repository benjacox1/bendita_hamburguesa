Página Principal - Bendita Hamburguesa
======================================

Estructura:
- index.html: Página principal con hero, filtros y grilla de productos.
- main.css: Estilos de la página principal.
- main.js: Lógica de carga, filtrado y orden.
- detalle de los productos/: Directorio con producto.html y productos.json.
- PanelAdmin/: Panel para gestión de pedidos y stock.

Flujo de navegación (Bendita Hamburguesa):
1. index.html muestra todos los productos desde productos.json.
2. Al hacer clic en Ver, abre: detalle de los productos/producto.html?id=ID
3. En detalle se puede generar un pedido que aparecerá en PanelAdmin.

Cómo agregar un producto nuevo:
1. Copia la imagen en la carpeta: detalle de los productos/IMAGENES COMIDA
2. Edita productos.json y agrega un objeto:
   {
     "id": "nuevo-id",
     "nombre": "Nombre del Producto",
     "descripcion": "Descripción corta y clara.",
     "precio": 1234,
     "categoria": "comida", // o bebida, combo, promo
     "imagen": "IMAGENES COMIDA/NOMBRE.png"
   }
3. Guardar y recargar index.html (sin caché: Ctrl+F5 si es necesario).

Filtros disponibles:
- Buscador texto (nombre)
- Categoría (select dinámico)
- Orden: precio asc/desc, nombre A-Z/Z-A.

Notas técnicas:
- main.js hace fetch con parámetro anti-caché _=timestamp.
- Si se agrega un backend futuro: reemplazar fetch a productos.json por una API /productos.
- Se podría agregar paginación si la lista crece mucho.

Próximas mejoras sugeridas:
- Indicador de stock en la card (usando localStorage de stock si coincide nombre/id).
- Botón rápido “Agregar” sin abrir detalle.
- Paginación / lazy loading de imágenes.
- Modo oscuro.

Fin. Marca: Bendita Hamburguesa.
