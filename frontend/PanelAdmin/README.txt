Panel Admin - Bendita Hamburguesa (Versión Local / Prototipo)
============================================================

Descripción General
-------------------
Este panel permite a Bendita Hamburguesa:
1. Gestionar pedidos con estados secuenciales: En Espera -> Preparándose -> Listo para Retirar -> Retirado.
2. Gestionar stock de productos con control visual de nivel: OK, Bajo, Sin stock.

Tecnologías: HTML, CSS, JavaScript plano y localStorage (persistencia local en el navegador).
No existe todavía backend ni autenticación.

Estructura de Archivos
----------------------
index.html   - Estructura principal con pestañas Pedidos y Stock.
admin.css    - Estilos y diseño responsive básico.
orders.js    - Lógica CRUD y estados para pedidos.
stock.js     - Lógica CRUD y ajustes de stock de productos.
tabs.js      - Cambio de pestañas.

Claves de localStorage
----------------------
admin_pedidos_v1
admin_stock_v1

Ideas Futuras / Próximos Pasos
------------------------------
1. Backend (API REST o GraphQL):
   - Endpoints: /auth/login, /pedidos, /productos, /productos/{id}/stock.
2. Autenticación y roles (admin, empleado, solo lectura).
3. Notificaciones en tiempo real (WebSocket) para actualizar estados a clientes.
4. Integración con pantalla pública de "Pedidos Listos".
5. Exportación de reportes (CSV / PDF) de ventas y consumo.
6. Módulo de categorías y combos.
7. Control de costos y margen por producto.
8. Auditoría (historial de cambios de stock y estados de pedidos).
9. Registro de tiempo en cada estado (métricas de preparación).
10. Modo oscuro y accesibilidad (teclado / lector pantalla).

Notas Técnicas
--------------
- Validaciones básicas aplicadas solo en frontend.
- Los IDs se generan con Date.now(); para producción usar UUID o generación desde base de datos.
- Sin sanitización profunda: asegurar en backend contra XSS / inyección.

Migración a Backend (Esquema Breve)
-----------------------------------
Pedido:
  id, cliente, detalle, tipo, importe, estado, creado_at, actualizado_at
Producto:
  id, nombre, categoria, precio, stock_actual, stock_min, creado_at, actualizado_at
MovimientoStock:
  id, producto_id, delta, motivo, usuario_id, creado_at

Licencia / Uso
--------------
Libre para modificar dentro del proyecto. No usar en producción sin agregar seguridad.

Fin. Marca: Bendita Hamburguesa.
