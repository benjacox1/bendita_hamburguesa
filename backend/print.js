import { Router } from 'express';

export default function printRoutes({ readJSON, writeJSON, ORDERS_FILE, logApp, requireAdmin }) {
  const router = Router();
  const PRINT_API_KEY = process.env.PRINT_API_KEY;

  function requirePrint(req, res, next) {
    if (PRINT_API_KEY && req.headers['x-api-key'] === PRINT_API_KEY) return next();
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Agente de impresión: pedidos pendientes (máx. 6 h de antigüedad)
  router.get('/api/print/pending', requirePrint, async (req, res) => {
    try {
      const limite = Date.now() - 6 * 60 * 60 * 1000;
      const orders = await readJSON(ORDERS_FILE);
      res.json(
        orders
          .filter(o => o.impreso === false && o.fechaCreacion > limite)
          .sort((a, b) => a.fechaCreacion - b.fechaCreacion)
      );
    } catch (e) {
      res.status(500).json({ error: 'Error leyendo pendientes', detail: e.message });
    }
  });

  // Agente de impresión: marcar como impreso
  router.post('/api/print/:id/done', requirePrint, async (req, res) => {
    try {
      const orders = await readJSON(ORDERS_FILE);
      const o = orders.find(x => x.id === req.params.id);
      if (!o) return res.status(404).json({ error: 'Pedido no encontrado' });
      o.impreso = true;
      o.fechaImpresion = Date.now();
      await writeJSON(ORDERS_FILE, orders);
      logApp('order.printed', { id: o.id });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: 'Error marcando impreso', detail: e.message });
    }
  });

  // Admin: volver a poner un pedido en la cola (reimprimir)
  router.patch('/api/orders/:id/reprint', requireAdmin, async (req, res) => {
    try {
      const orders = await readJSON(ORDERS_FILE);
      const o = orders.find(x => x.id === req.params.id);
      if (!o) return res.status(404).json({ error: 'Pedido no encontrado' });
      o.impreso = false;
      o.fechaCreacion = Date.now();
      await writeJSON(ORDERS_FILE, orders);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: 'Error reencolando', detail: e.message });
    }
  });

  return router;
}