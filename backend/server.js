import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';
import mercadopago, { MercadoPagoConfig, Preference } from 'mercadopago';
import { logApp, logWebhook } from './logger.js';
import { existsSync, createReadStream, mkdirSync } from 'fs';
import multer from 'multer';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

const app = express();
app.use(cors());
app.use(express.json());
// Puerto configurable (permitiendo levantar instancia alternativa si 4000 está ocupado)
// Prioridad: arg CLI > env PORT > 4000
const cliPortArg = process.argv.slice(2).find(a => /^\d+$/.test(a));
const PORT = cliPortArg ? Number(cliPortArg) : (process.env.PORT || 4000);
// Base dinámica usada como fallback cuando no se proveen variables MP_BACK_*
const dynamicBase = `http://localhost:${PORT}`;

// Admin auth: token simple para proteger endpoints sensibles
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'bh-admin-2025';
function requireAdmin(req, res, next){
  const auth = req.headers['authorization'] || '';
  if (auth === `Bearer ${ADMIN_TOKEN}`) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

// Helper lectura/escritura
async function readJSON(file) {
  const txt = await fs.readFile(file, 'utf8');
  return JSON.parse(txt);
}
async function writeJSON(file, data) {
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
}

// GET productos (incluye merging con catálogo estático si existe)
app.get('/api/products', async (req, res) => {
  try {
    const products = await readJSON(PRODUCTS_FILE).catch(()=>[]);
    // Intentar cargar catálogo estático de la interfaz (read-only) para que aparezcan en el Admin
    const STATIC_PRODUCTS_FILE = path.join(__dirname, '..', 'InicioInterfaz', 'detalle-productos', 'productos.json');
    let staticList = [];
    try {
      const txt = await fs.readFile(STATIC_PRODUCTS_FILE, 'utf8');
      staticList = JSON.parse(txt);
    } catch {}
    // Merge: backend tiene prioridad; los no existentes se agregan con stock 0
    const byId = new Map();
    for (const p of products) byId.set(p.id, p);
    for (const s of staticList) {
      if (!byId.has(s.id)) {
        byId.set(s.id, {
          id: s.id,
          nombre: s.nombre,
          descripcion: s.descripcion || '',
          precio: Number(s.precio) || 0,
          categoria: s.categoria || 'otros',
          imagen: s.imagen || '',
          stock: 0, // empezar en 0; el admin podrá ajustar stock real
          origen: 'static'
        });
      }
    }
    res.json(Array.from(byId.values()));
  } catch (e) {
    res.status(500).json({ error: 'Error leyendo productos', detail: e.message });
  }
});

// GET producto individual
app.get('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const products = await readJSON(PRODUCTS_FILE);
    const prod = products.find(p => p.id === id);
    if(!prod) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(prod);
  } catch (e) {
    res.status(500).json({ error: 'Error leyendo producto', detail: e.message });
  }
});

// POST nuevo producto
// Admin: crear producto
app.post('/api/products', requireAdmin, async (req, res) => {
  try {
    const { id, nombre, descripcion, precio, categoria, imagen, stock, stockMin } = req.body;
    if (!nombre || !precio) return res.status(400).json({ error: 'nombre y precio son obligatorios' });
    const products = await readJSON(PRODUCTS_FILE);
    const newProduct = {
      id: id || nombre.toLowerCase().replace(/\s+/g, '-'),
      nombre,
      descripcion: descripcion || '',
      precio: Number(precio) || 0,
      categoria: categoria || 'otros',
      imagen: imagen || '',
      stock: Number.isFinite(stock) ? stock : 0,
      stockMin: Number.isFinite(stockMin) ? stockMin : 5
    };
    if (products.some(p => p.id === newProduct.id)) {
      return res.status(409).json({ error: 'Ya existe un producto con ese id' });
    }
    products.push(newProduct);
    await writeJSON(PRODUCTS_FILE, products);
    res.status(201).json(newProduct);
  } catch (e) {
    res.status(500).json({ error: 'Error creando producto', detail: e.message });
  }
});

// PUT actualizar producto
// Admin: actualizar producto
app.put('/api/products/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const products = await readJSON(PRODUCTS_FILE);
    const idx = products.findIndex(p => p.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Producto no encontrado' });
    const current = products[idx];
    const updated = { ...current, ...req.body };
    if (req.body.precio !== undefined) updated.precio = Number(req.body.precio);
    if (req.body.stock !== undefined) updated.stock = Number(req.body.stock);
    if (req.body.imagen !== undefined) {
      // Normalizar ruta de imagen: sólo archivo o subruta bajo carpeta permitida
      updated.imagen = String(req.body.imagen).replace(/^\/*/, '');
    }
    products[idx] = updated;
    await writeJSON(PRODUCTS_FILE, products);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Error actualizando producto', detail: e.message });
  }
});

// DELETE producto
// Admin: eliminar producto
app.delete('/api/products/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    let products = await readJSON(PRODUCTS_FILE);
    const before = products.length;
    products = products.filter(p => p.id !== id);
    if (products.length === before) return res.status(404).json({ error: 'Producto no encontrado' });
    await writeJSON(PRODUCTS_FILE, products);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Error eliminando producto', detail: e.message });
  }
});

// GET pedidos
// Expone pedidos sin requerir token para que el panel pueda listarlos sin fricción
app.get('/api/orders', async (req, res) => {
  try {
    const orders = await readJSON(ORDERS_FILE);
    res.json(orders);
  } catch (e) {
    res.status(500).json({ error: 'Error leyendo pedidos', detail: e.message });
  }
});

// GET pedido individual
app.get('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const orders = await readJSON(ORDERS_FILE);
    const order = orders.find(o => o.id === id);
    if(!order) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json(order);
  } catch(e){
    res.status(500).json({ error: 'Error leyendo pedido', detail: e.message });
  }
});

// POST nuevo pedido
app.post('/api/orders', async (req, res) => {
  try {
    const { items, cliente } = req.body; // items: [{productId, cantidad}]
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items es requerido (array)' });
    }
    const products = await readJSON(PRODUCTS_FILE);
    const orders = await readJSON(ORDERS_FILE);

    // Validar stock
    for (const it of items) {
      const prod = products.find(p => p.id === it.productId);
      if (!prod) return res.status(400).json({ error: `Producto no existe: ${it.productId}` });
      if (prod.stock < it.cantidad) return res.status(400).json({ error: `Stock insuficiente para ${prod.nombre}` });
    }

    // Descontar stock
    for (const it of items) {
      const prod = products.find(p => p.id === it.productId);
      prod.stock -= it.cantidad;
    }

    // Calcular importe total
    const detalleItems = items.map(it => {
      const prod = products.find(p => p.id === it.productId);
      return {
        productId: it.productId,
        nombre: prod.nombre,
        precioUnitario: prod.precio,
        cantidad: it.cantidad,
        subtotal: prod.precio * it.cantidad
      };
    });
    const importe = detalleItems.reduce((acc, d) => acc + d.subtotal, 0);
    const nuevo = {
      id: nanoid(8),
      fechaCreacion: Date.now(),
      estado: 'espera',
      cliente: cliente || '',
      items: detalleItems,
      importe,
      paymentStatus: 'pending', // pending | approved | rejected | cancelled
      externalReference: null
    };
    orders.push(nuevo);

    await writeJSON(ORDERS_FILE, orders);
    await writeJSON(PRODUCTS_FILE, products);
    logApp('order.created', { id: nuevo.id, importe: nuevo.importe, items: nuevo.items.length });
    res.status(201).json(nuevo);
  } catch (e) {
    logApp('error.order.create', { message: e.message });
    res.status(500).json({ error: 'Error creando pedido', detail: e.message });
  }
});

// PATCH cambiar estado pedido
// Admin: cambiar estado de pedido
app.patch('/api/orders/:id/state', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    const allowed = ['espera', 'preparando', 'listo', 'retirado'];
    if (!allowed.includes(estado)) return res.status(400).json({ error: 'Estado inválido' });
    const orders = await readJSON(ORDERS_FILE);
    const idx = orders.findIndex(o => o.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Pedido no encontrado' });
    orders[idx].estado = estado;
    orders[idx].fechaCambio = Date.now();
    await writeJSON(ORDERS_FILE, orders);
    logApp('order.state.changed', { id, estado });
    res.json(orders[idx]);
  } catch (e) {
    logApp('error.order.state', { message: e.message });
    res.status(500).json({ error: 'Error cambiando estado', detail: e.message });
  }
});

// DELETE pedido
// Admin: eliminar pedido
app.delete('/api/orders/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    let orders = await readJSON(ORDERS_FILE);
    const before = orders.length;
    const pedido = orders.find(o => o.id === id);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    // (Opcional) No reponemos stock automáticamente para evitar inconsistencias históricas
    orders = orders.filter(o => o.id !== id);
    await writeJSON(ORDERS_FILE, orders);
    logApp('order.deleted', { id });
    res.json({ ok: true });
  } catch (e) {
    logApp('error.order.delete', { message: e.message });
    res.status(500).json({ error: 'Error eliminando pedido', detail: e.message });
  }
});

// Endpoint para calcular total del carrito antes de crear el pedido
app.post('/api/cart/calculate', async (req, res) => {
  try {
    const { items } = req.body; // items: [{productId, cantidad}]
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items es requerido (array no vacío)' });
    }
    
    const products = await readJSON(PRODUCTS_FILE);
    const calculation = {
      items: [],
      subtotal: 0,
      total: 0,
      errors: []
    };
    
    for (const item of items) {
      const product = products.find(p => p.id === item.productId);
      if (!product) {
        calculation.errors.push(`Producto no encontrado: ${item.productId}`);
        continue;
      }
      
      const cantidad = Number(item.cantidad) || 0;
      if (cantidad <= 0) {
        calculation.errors.push(`Cantidad inválida para ${product.nombre}: ${cantidad}`);
        continue;
      }
      
      if (product.stock < cantidad) {
        calculation.errors.push(`Stock insuficiente para ${product.nombre}. Disponible: ${product.stock}, solicitado: ${cantidad}`);
        continue;
      }
      
      const subtotal = product.precio * cantidad;
      calculation.items.push({
        productId: product.id,
        nombre: product.nombre,
        precio: product.precio,
        cantidad: cantidad,
        subtotal: subtotal,
        stock_disponible: product.stock
      });
      
      calculation.subtotal += subtotal;
    }
    
    calculation.total = calculation.subtotal;
    calculation.valid = calculation.errors.length === 0 && calculation.items.length > 0;
    
    res.json(calculation);
  } catch (e) {
    res.status(500).json({ error: 'Error calculando carrito', detail: e.message });
  }
});

// GET estadísticas simples
app.get('/api/stats', async (req, res) => {
  try {
    const orders = await readJSON(ORDERS_FILE);
    const total = orders.length;
    const porEstado = orders.reduce((acc, o) => { acc[o.estado] = (acc[o.estado]||0)+1; return acc; }, {});
    const porPago = orders.reduce((acc, o) => { acc[o.paymentStatus] = (acc[o.paymentStatus]||0)+1; return acc; }, {});
    const totalVentas = orders
      .filter(o => o.paymentStatus === 'approved')
      .reduce((sum, o) => sum + (o.importe || 0), 0);
    
    res.json({ total, porEstado, porPago, totalVentas });
  } catch (e) {
    res.status(500).json({ error: 'Error calculando estadísticas', detail: e.message });
  }
});

// Healthcheck simple
app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: Date.now() });
});

// Versión / diagnóstico rápido
app.get('/api/version', (req,res)=>{
  res.json({
    pid: process.pid,
    port: PORT,
    mpNewApi: true,
    node: process.version,
    time: Date.now()
  });
});

// Configuración de pagos (real vs simulado)
app.get('/api/payments/config', (req, res) => {
  const hasToken = !!process.env.MP_ACCESS_TOKEN;
  const vexorProject = process.env.NEXT_PUBLIC_VEXOR_PROJECT || process.env.VEXOR_PROJECT || null;
  const vexorPublishable = process.env.NEXT_PUBLIC_VEXOR_PUBLISHABLE_KEY || process.env.VEXOR_PUBLISHABLE_KEY || null;
  const vexorSecret = process.env.VEXOR_SECRET_KEY || null;
  const vexorApiBase = process.env.VEXOR_API_BASE || null;
  const provider = (vexorProject || vexorPublishable || vexorSecret || vexorApiBase)
    ? 'vexor'
    : (hasToken ? 'mercadopago' : 'simulated');
  res.json({
    mode: hasToken ? 'real' : 'simulated',
    provider,
    hasToken,
    back_urls: {
      success: process.env.MP_BACK_SUCCESS || `${dynamicBase}/?pago=success`,
      failure: process.env.MP_BACK_FAILURE || `${dynamicBase}/?pago=failure`,
      pending: process.env.MP_BACK_PENDING || `${dynamicBase}/?pago=pending`
    },
    webhook: process.env.MP_WEBHOOK || null,
    vexor: {
      project: vexorProject,
      publishableKeyPresent: !!vexorPublishable,
      secretPresent: !!vexorSecret,
      apiBasePresent: !!vexorApiBase
    }
  });
});

// ======= Pagos Vexor (SIMULADO/PLUMBING) =======
// Crea una "sesión" de checkout y devuelve una URL para redirigir.
// Si VEXOR_SECRET_KEY no está definido, genera una URL simulada.
app.post('/api/payments/vexor/session', async (req, res) => {
  try {
    const { orderId } = req.body || {};
    if(!orderId) return res.status(400).json({ error: 'orderId requerido' });
    const orders = await readJSON(ORDERS_FILE);
    const order = orders.find(o => o.id === orderId);
    if(!order) return res.status(404).json({ error: 'Pedido no encontrado' });
    if(!order.items?.length) return res.status(400).json({ error: 'Pedido sin items' });
    if(!order.importe || order.importe <= 0) return res.status(400).json({ error: 'Importe inválido' });

  const secret = process.env.VEXOR_SECRET_KEY;
  const apiBase = (process.env.VEXOR_API_BASE || '').replace(/\/$/, '');
  const project = process.env.NEXT_PUBLIC_VEXOR_PROJECT || process.env.VEXOR_PROJECT || 'project';

    // Simulación si no hay SECRET: usamos una pantalla local para elegir estado
    if(!secret){
      const url = `${dynamicBase}/pago/vexor/${order.id}`;
      // Marcar como processing
      order.paymentStatus = 'processing';
      order.paymentCreated = Date.now();
      await writeJSON(ORDERS_FILE, orders);
      return res.json({ checkout_url: url, simulated: true, provider: 'vexor' });
    }

    // Si hay SECRET y API_BASE, intentar crear sesión real en Vexor
    if (secret && apiBase) {
      // Asegurar externalReference
      if(!order.externalReference){
        order.externalReference = 'ref_' + order.id + '_' + Date.now();
        await writeJSON(ORDERS_FILE, orders);
      }
      const back_success = `${dynamicBase}/?pago=success&order_id=${order.id}`;
      const back_failure = `${dynamicBase}/?pago=failure&order_id=${order.id}`;
      const back_pending = `${dynamicBase}/?pago=pending&order_id=${order.id}`;

      const payload = {
        project,
        amount: Number(order.importe),
        currency: 'ARS',
        reference: order.externalReference,
        success_url: back_success,
        failure_url: back_failure,
        pending_url: back_pending,
        items: (order.items||[]).map(it => ({
          name: it.nombre,
          quantity: Number(it.cantidad||1),
          unit_price: Number(it.precioUnitario||0),
          currency: 'ARS'
        }))
      };
      try {
        const resp = await fetch(`${apiBase}/checkout/sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${secret}`
          },
          body: JSON.stringify(payload)
        });
        const data = await resp.json().catch(()=>({}));
        if(!resp.ok){
          return res.status(502).json({ error: 'Vexor API error', status: resp.status, data });
        }
        const checkoutUrl = data.checkout_url || data.url || data.redirect_url || data.link;
        if(!checkoutUrl){
          return res.status(500).json({ error: 'Respuesta Vexor sin checkout_url', data });
        }
        // Marcar processing
        order.paymentStatus = 'processing';
        order.paymentCreated = Date.now();
        await writeJSON(ORDERS_FILE, orders);
        return res.json({ checkout_url: checkoutUrl, simulated: false, provider: 'vexor', session: data });
      } catch (e) {
        return res.status(500).json({ error: 'Error llamando a Vexor', detail: e.message });
      }
    }

    // Si no hay API_BASE, indicar que falta configuración para real
    return res.status(501).json({
      error: 'Integración Vexor real no configurada',
      detail: 'Define VEXOR_API_BASE para crear sesiones reales; sin eso se usa el modo simulado.',
      provider: 'vexor'
    });
  } catch(e){
    res.status(500).json({ error: 'Error creando sesión Vexor', detail: e.message });
  }
});

// Página de checkout Vexor (simulada) para elegir resultado de pago
app.get('/pago/vexor/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const orders = await readJSON(ORDERS_FILE);
    const order = orders.find(o => o.id === orderId);
    if(!order) return res.status(404).send('Pedido no encontrado');
    const html = `<!doctype html>
    <html lang="es"><head><meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Pagar con Vexor (Simulado)</title>
    <style>body{font-family:system-ui,Segoe UI,Arial,sans-serif;background:#0f141a;color:#e6edf3;padding:32px}
    .card{max-width:640px;margin:24px auto;background:#111821;border:1px solid #1f2a36;border-radius:14px;padding:24px;box-shadow:0 10px 30px rgba(0,0,0,.35)}
    h1{font-size:20px;margin:0 0 10px}
    .mini{opacity:.8;font-size:14px}
    .total{font-size:28px;margin:14px 0;color:#8bcf9f}
    .btns{display:flex;gap:10px;flex-wrap:wrap}
    a.btn{padding:10px 14px;border-radius:10px;border:1px solid #2b3a49;text-decoration:none;color:#e6edf3}
    a.s{background:#14301f;border-color:#1f5131}
    a.f{background:#341212;border-color:#5a1f1f}
    a.p{background:#302a14;border-color:#514a1f}
    </style></head><body>
    <div class="card">
      <h1>Checkout Vexor (Simulado)</h1>
      <div class="mini">Pedido #${order.id}</div>
      <div class="total">Total: $ ${order.importe.toFixed(2)}</div>
      <p>Elige el resultado del pago para continuar:</p>
      <div class="btns">
        <a class="btn s" href="${dynamicBase}/api/payments/vexor/simulate?orderId=${order.id}&status=approved">Aprobar pago</a>
        <a class="btn f" href="${dynamicBase}/api/payments/vexor/simulate?orderId=${order.id}&status=rejected">Rechazar pago</a>
        <a class="btn p" href="${dynamicBase}/api/payments/vexor/simulate?orderId=${order.id}&status=pending">Marcar pendiente</a>
      </div>
      <p class="mini">Nota: esta pantalla existe solo para pruebas sin conectar con Vexor real.</p>
    </div>
    </body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch(e){ res.status(500).send('Error construyendo checkout'); }
});

// Callback simulador: actualiza estado y redirige al sitio con ?pago=
app.get('/api/payments/vexor/simulate', async (req, res) => {
  try {
    const { orderId, status } = req.query;
    const allowed = ['approved','rejected','pending'];
    if(!orderId || !allowed.includes(String(status))){
      return res.status(400).send('Parámetros inválidos');
    }
    const orders = await readJSON(ORDERS_FILE);
    const order = orders.find(o => o.id === String(orderId));
    if(!order) return res.status(404).send('Pedido no encontrado');
    const prev = order.paymentStatus;
    order.paymentStatus = String(status);
    order.paymentUpdated = Date.now();
    if(order.paymentStatus === 'approved' && order.estado === 'espera'){
      order.estado = 'preparando';
      order.fechaCambio = Date.now();
    }
    if(order.paymentStatus === 'rejected'){
      await reponerStock(order);
    }
    await writeJSON(ORDERS_FILE, orders);
    logApp('vexor.simulated.callback', { orderId: order.id, status: order.paymentStatus, previous: prev });
    const pago = order.paymentStatus === 'approved' ? 'success' : (order.paymentStatus === 'rejected' ? 'failure' : 'pending');
    const back = `${dynamicBase}/?pago=${pago}&order_id=${order.id}`;
    res.redirect(back);
  } catch(e){ res.status(500).send('Error simulando pago'); }
});

// ======= Pagos Mercado Pago (PLACEHOLDER) =======
// NOTA: Para producción instalar SDK oficial y usar Access Token real.
// Este endpoint simula la creación de una preferencia y devuelve un init_point ficticio.

app.post('/api/payments/preference', async (req, res) => {
  try {
    const { orderId } = req.body;
    if(!orderId) return res.status(400).json({ error: 'orderId requerido' });
    const orders = await readJSON(ORDERS_FILE);
    const order = orders.find(o => o.id === orderId);
    if(!order) return res.status(404).json({ error: 'Pedido no encontrado' });
    
    // Validar que el pedido tenga items y total válido
    if(!order.items || order.items.length === 0) {
      return res.status(400).json({ error: 'Pedido sin items' });
    }
    if(!order.importe || order.importe <= 0) {
      return res.status(400).json({ error: 'Pedido con importe inválido' });
    }
    
    // Generar external_reference si no existe
    if(!order.externalReference){
      order.externalReference = 'ref_' + order.id + '_' + Date.now();
      await writeJSON(ORDERS_FILE, orders);
    }

    const token = process.env.MP_ACCESS_TOKEN;
    if(!token){
      // Fallback simulación con datos más completos
      const init_point = `https://sandbox.mercadopago.com/checkout?pref_id=${order.id}&amount=${order.importe}`;
      logApp('payment.preference.simulated', { orderId: order.id, total: order.importe, items: order.items.length });
      return res.json({ 
        init_point, 
        external_reference: order.externalReference, 
        simulated: true,
        total: order.importe,
        items_count: order.items.length
      });
    }
    
    // Nueva configuración SDK v2
    let mpClient;
    try {
      mpClient = new MercadoPagoConfig({ accessToken: token });
    } catch(confErr){
      logApp('payment.preference.config.error', { orderId: order.id, message: confErr.message });
      return res.status(500).json({ error:'Error configurando SDK', detail: confErr.message });
    }

    // Armar items desde el pedido con validación de precios
    const items = order.items.map(it => {
      const unitPrice = Number(it.precioUnitario);
      const quantity = Number(it.cantidad);
      
      if(!unitPrice || unitPrice <= 0) {
        throw new Error(`Precio unitario inválido para ${it.nombre}: ${unitPrice}`);
      }
      if(!quantity || quantity <= 0) {
        throw new Error(`Cantidad inválida para ${it.nombre}: ${quantity}`);
      }
      
      return {
        title: it.nombre,
        quantity: quantity,
        currency_id: 'ARS',
        unit_price: unitPrice
      };
    });

    // Validar que el total calculado coincida
    const calculatedTotal = items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
    if(Math.abs(calculatedTotal - order.importe) > 0.01) {
      logApp('payment.preference.total.mismatch', { 
        orderId: order.id, 
        orderTotal: order.importe, 
        calculatedTotal, 
        items 
      });
      return res.status(400).json({ 
        error: 'Error en cálculo de total', 
        orderTotal: order.importe, 
        calculatedTotal,
        detail: 'Los totales no coinciden'
      });
    }

    const back_urls = {
      success: process.env.MP_BACK_SUCCESS || `${dynamicBase}/?pago=success&order_id=${order.id}`,
      failure: process.env.MP_BACK_FAILURE || `${dynamicBase}/?pago=failure&order_id=${order.id}`,
      pending: process.env.MP_BACK_PENDING || `${dynamicBase}/?pago=pending&order_id=${order.id}`
    };
    
    const preference = {
      external_reference: order.externalReference,
      items,
      back_urls,
      notification_url: process.env.MP_WEBHOOK || `${dynamicBase}/webhooks/mercadopago`,
      purpose: 'wallet_purchase',
      auto_return: 'approved',
      payment_methods: {
        excluded_payment_types: [],
        installments: 12
      },
      payer: {
        name: order.cliente || 'Cliente',
        surname: '',
        email: 'cliente@example.com'
      }
    };
    
    logApp('payment.preference.request', { 
      orderId: order.id, 
      total: order.importe,
      items_count: items.length,
      external_reference: order.externalReference
    });
    
    let prefResp;
    try {
      const pref = new Preference(mpClient);
      prefResp = await pref.create({ body: preference });
    } catch(sdkErr){
      logApp('payment.preference.sdk.error', { orderId: order.id, message: sdkErr.message, stack: sdkErr.stack });
      return res.status(502).json({ error: 'Fallo SDK Mercado Pago', detail: sdkErr.message });
    }
    
    logApp('payment.preference.raw', { 
      orderId: order.id, 
      keys: Object.keys(prefResp||{}), 
      init_point: prefResp?.init_point, 
      sandbox_init_point: prefResp?.sandbox_init_point 
    });
    
    const init_point = prefResp?.init_point || prefResp?.sandbox_init_point;
    if(!init_point){
      logApp('payment.preference.missing.init_point', { orderId: order.id, resp: prefResp });
      return res.status(500).json({ error: 'Respuesta de Mercado Pago sin init_point', resp: prefResp });
    }
    
    // Marcar pedido como "procesando pago"
    order.paymentStatus = 'processing';
    order.paymentCreated = Date.now();
    await writeJSON(ORDERS_FILE, orders);
    
    logApp('payment.preference.created', { 
      orderId: order.id, 
      externalReference: order.externalReference, 
      total: order.importe,
      mp: true, 
      simulated: false 
    });
    
    res.json({ 
      init_point, 
      external_reference: order.externalReference, 
      simulated: false,
      total: order.importe,
      items_count: items.length,
      order_id: order.id
    });
  } catch(e){
    logApp('error.payment.preference', { message: e.message, stack: e.stack });
    res.status(500).json({ error: 'Error creando preferencia', detail: e.message, stack: e.stack });
  }
});

// Webhook Mercado Pago - Procesamiento automático de pagos
// Mercado Pago enviará notificaciones cuando cambie el estado del pago
app.post('/webhooks/mercadopago', async (req, res) => {
  try {
    const body = req.body || {};
    logWebhook('webhook.received', { body, headers: req.headers });
    
    // MercadoPago puede enviar diferentes tipos de notificaciones
    const { type, data, external_reference, status } = body;
    
    // Si es una notificación de payment
    if (type === 'payment' && data?.id) {
      const paymentId = data.id;
      logWebhook('webhook.payment.notification', { paymentId });
      
      // En producción, aquí consultarías la API de MercadoPago para obtener el estado real
      // const payment = await mercadopago.payment.findById(paymentId);
      // Por ahora simulamos la respuesta
      const simulatedPayment = {
        id: paymentId,
        status: 'approved', // approved, rejected, pending, cancelled
        external_reference: external_reference || `ref_${paymentId}`,
        transaction_amount: 0
      };
      
      return await procesarPago(simulatedPayment, res);
    }
    
    // Si es notificación directa con external_reference (formato alternativo)
    if (external_reference) {
      const paymentData = {
        external_reference,
        status: status || 'approved',
        transaction_amount: body.transaction_amount || 0
      };
      return await procesarPago(paymentData, res);
    }
    
    // Respuesta genérica para otros tipos de webhook
    logWebhook('webhook.unhandled', { type, body });
    res.json({ ok: true, message: 'Webhook recibido pero no procesado' });
    
  } catch(e) {
    logWebhook('error.webhook.mercadopago', { message: e.message, stack: e.stack });
    res.status(500).json({ error: 'Error procesando webhook', detail: e.message });
  }
});

// Función auxiliar para procesar pagos automáticamente
async function procesarPago(paymentData, res) {
  const { external_reference, status, transaction_amount } = paymentData;
  
  if (!external_reference) {
    return res.status(400).json({ error: 'external_reference faltante' });
  }
  
  const orders = await readJSON(ORDERS_FILE);
  const order = orders.find(o => o.externalReference === external_reference);
  
  if (!order) {
    logWebhook('webhook.order.not_found', { external_reference });
    return res.status(404).json({ error: 'Pedido no encontrado para external_reference' });
  }
  
  // Validar monto si está disponible
  if (transaction_amount > 0 && Math.abs(transaction_amount - order.importe) > 0.01) {
    logWebhook('webhook.amount.mismatch', { 
      external_reference, 
      expected: order.importe, 
      received: transaction_amount 
    });
  }
  
  const previousStatus = order.paymentStatus;
  
  // Procesar según el estado del pago
  switch (status) {
    case 'approved':
      order.paymentStatus = 'approved';
      order.paymentAmount = transaction_amount || order.importe;
      // Auto-mover a preparando si estaba en espera
      if (order.estado === 'espera') {
        order.estado = 'preparando';
        order.fechaCambio = Date.now();
      }
      break;
      
    case 'rejected':
    case 'cancelled':
      order.paymentStatus = 'rejected';
      // Reponer stock si el pago fue rechazado
      await reponerStock(order);
      break;
      
    case 'pending':
    case 'in_process':
      order.paymentStatus = 'pending';
      break;
      
    default:
      order.paymentStatus = status;
  }
  
  order.paymentUpdated = Date.now();
  await writeJSON(ORDERS_FILE, orders);
  
  logWebhook('webhook.payment.processed', { 
    external_reference, 
    status, 
    orderId: order.id, 
    paymentStatus: order.paymentStatus,
    previousStatus,
    orderState: order.estado
  });
  
  res.json({ 
    ok: true, 
    order_id: order.id,
    payment_status: order.paymentStatus,
    order_state: order.estado
  });
}

// Función para reponer stock cuando se rechaza un pago
async function reponerStock(order) {
  try {
    const products = await readJSON(PRODUCTS_FILE);
    let updated = false;
    
    for (const item of order.items) {
      const product = products.find(p => p.id === item.productId);
      if (product) {
        product.stock += item.cantidad;
        updated = true;
        logApp('stock.restored', { 
          productId: item.productId, 
          cantidad: item.cantidad, 
          newStock: product.stock,
          orderId: order.id
        });
      }
    }
    
    if (updated) {
      await writeJSON(PRODUCTS_FILE, products);
    }
  } catch (e) {
    logApp('error.stock.restore', { orderId: order.id, message: e.message });
  }
}

// ================== SERVIDOR DE IMÁGENES OPTIMIZADO ==================
// Características:
// - Cache-Control largo (1 año) con immutable
// - Negociación AVIF > WebP > original
// - Parámetro ?v= para cache busting (sólo cambia la URL)
// - Sirve también placeholders.json (no cache infinito para poder regenerar)
// - Sólo sirve archivos dentro de la carpeta permitida
const DEFAULT_IMAGES_DIR = path.join(__dirname, '..', 'InicioInterfaz', 'detalle-productos', 'IMAGENES COMIDA');
const DEFAULT_LEGACY_IMAGES_DIR = path.join(__dirname, '..', 'InicioInterfaz', 'detalle de los productos', 'IMAGENES COMIDA');
const IMAGES_DIR = process.env.IMAGES_DIR || DEFAULT_IMAGES_DIR;
// Carpeta de imágenes para el sitio legacy/frontend (para fallback sin backend)
const FRONTEND_IMAGES_DIR = path.join(__dirname, '..', 'frontend', 'detalle-productos', 'IMAGENES COMIDA');
const LEGACY_IMAGES_DIR = process.env.LEGACY_IMAGES_DIR || DEFAULT_LEGACY_IMAGES_DIR;

// Asegurar directorio de imágenes
try { if(!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true }); } catch {}
try { if(!existsSync(IMAGES_DIR)) mkdirSync(IMAGES_DIR, { recursive: true }); } catch {}
try { if(!existsSync(FRONTEND_IMAGES_DIR)) mkdirSync(FRONTEND_IMAGES_DIR, { recursive: true }); } catch {}
try { if(!existsSync(LEGACY_IMAGES_DIR)) mkdirSync(LEGACY_IMAGES_DIR, { recursive: true }); } catch {}

// ================== SUBIDA DE IMÁGENES ==================
// Configuración de multer para recibir archivos en memoria y decidir nombre
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, IMAGES_DIR);
  },
  filename: function (req, file, cb) {
    // Sanitizar nombre: mantener extensión original, reemplazar espacios
    const safe = (file.originalname||'archivo').replace(/[^A-Za-z0-9_.\-\s]/g,'').replace(/\s+/g,' ').trim();
    cb(null, safe);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const ok = /\.(png|jpg|jpeg|webp|avif)$/i.test(file.originalname||'');
    if(!ok) return cb(new Error('Formato no permitido (png, jpg, jpeg, webp, avif)'));
    cb(null, true);
  }
});

// Admin: subir imagen y opcionalmente asociarla a un producto
app.post('/api/products/:id/image', requireAdmin, upload.single('imagen'), async (req, res) => {
  try {
    const { id } = req.params;
    const products = await readJSON(PRODUCTS_FILE);
    const idx = products.findIndex(p => p.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Producto no encontrado' });
    if (!req.file) return res.status(400).json({ error: 'Archivo requerido con campo "imagen"' });
    const fileName = req.file.filename;
    const ext = path.extname(fileName).toLowerCase();
    const baseNoExt = fileName.replace(ext, '');
    const targetPng = baseNoExt + '.png';
    const targetWebp = baseNoExt + '.webp';
    const targetAvif = baseNoExt + '.avif';
    // Guardar ruta relativa que usa el frontend: "IMAGENES COMIDA/<archivo>"
    const relativePath = `IMAGENES COMIDA/${fileName}`;
    products[idx].imagen = relativePath;
    await writeJSON(PRODUCTS_FILE, products);
    // Generar variantes .png, .webp y .avif junto a la original (negociación en /imagenes)
    try {
      const src = path.join(IMAGES_DIR, fileName);
      await Promise.all([
        sharp(src).png().toFile(path.join(IMAGES_DIR, targetPng)).catch(()=>{}),
        sharp(src).webp({ quality: 85 }).toFile(path.join(IMAGES_DIR, targetWebp)).catch(()=>{}),
        sharp(src).avif({ quality: 50 }).toFile(path.join(IMAGES_DIR, targetAvif)).catch(()=>{})
      ]);
    } catch(convErr){
      console.warn('[UPLOAD][CONVERT] No se pudieron generar variantes:', convErr.message);
    }
    // Copiar también a las carpetas legacy para que file:// o el sitio viejo vean la imagen
    try {
      const srcOriginal = path.join(IMAGES_DIR, fileName);
      const srcPng = path.join(IMAGES_DIR, targetPng);
      const dstFrontend = path.join(FRONTEND_IMAGES_DIR, fileName);
      const dstLegacy = path.join(LEGACY_IMAGES_DIR, fileName);
      const dstFrontendPng = path.join(FRONTEND_IMAGES_DIR, targetPng);
      const dstLegacyPng = path.join(LEGACY_IMAGES_DIR, targetPng);
      // Copiar original
      await fs.copyFile(srcOriginal, dstFrontend).catch(()=>{});
      await fs.copyFile(srcOriginal, dstLegacy).catch(()=>{});
      // Copiar PNG (más compatible) si fue generado
      await fs.copyFile(srcPng, dstFrontendPng).catch(()=>{});
      await fs.copyFile(srcPng, dstLegacyPng).catch(()=>{});
    } catch(copyErr){
      // No romper la respuesta por fallo de copia secundaria
      console.warn('[UPLOAD][COPY-FRONTEND] No se pudo copiar imagen a carpetas secundarias:', copyErr.message);
    }
    res.json({ ok: true, imagen: relativePath });
  } catch (e) {
    res.status(500).json({ error: 'Error subiendo imagen', detail: e.message });
  }
});

app.get('/imagenes/placeholders.json', (req, res) => {
  try {
    const file = path.join(IMAGES_DIR, 'placeholders.json');
  if(!existsSync(file)) return res.status(404).json({ error: 'No generado (ejecuta optimize-images)' });
    // Cache corto para permitir regenerar (ej. 5 minutos)
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.type('application/json');
  createReadStream(file).pipe(res);
  } catch(e){
    res.status(500).json({ error: 'Error sirviendo placeholders', detail: e.message });
  }
});

app.get('/imagenes/:file', async (req, res) => {
  try {
    const raw = req.params.file || '';
    if(raw.includes('..')) return res.status(400).end();
    const baseName = raw.replace(/\/+/, '');
    const ext = path.extname(baseName).toLowerCase();
    const allowed = ['.png', '.jpg', '.jpeg', '.webp', '.avif'];
    if(!allowed.includes(ext)) return res.status(404).json({ error: 'Extensión no permitida' });
    let absOriginal = path.join(IMAGES_DIR, baseName);
    if(!existsSync(absOriginal) && existsSync(LEGACY_IMAGES_DIR)){
      const legacyCandidate = path.join(LEGACY_IMAGES_DIR, baseName);
      if(existsSync(legacyCandidate)){
        console.warn('[IMG][LEGACY-FALLBACK]', baseName, 'usando carpeta antigua — ejecutar npm run migrate-images');
        absOriginal = legacyCandidate;
      }
    }
    const accept = req.headers['accept'] || '';
    let chosen = absOriginal;
    if(ext !== '.avif' && accept.includes('image/avif')) {
      const avifCandidate = path.join(IMAGES_DIR, baseName.replace(ext, '.avif'));
      if(existsSync(avifCandidate)) chosen = avifCandidate;
    } else if(ext !== '.webp' && accept.includes('image/webp')) {
      const webpCandidate = path.join(IMAGES_DIR, baseName.replace(ext, '.webp'));
      if(existsSync(webpCandidate)) chosen = webpCandidate;
    }
    if(!existsSync(chosen)) return res.status(404).json({ error: 'Archivo no encontrado' });
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    const ctype = chosen.endsWith('.avif') ? 'image/avif'
      : chosen.endsWith('.webp') ? 'image/webp'
      : (ext === '.png' ? 'image/png' : (ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'application/octet-stream'));
    res.setHeader('Content-Type', ctype);
  createReadStream(chosen).pipe(res);
  } catch(e){
    res.status(500).json({ error: 'Error sirviendo imagen', detail: e.message });
  }
});

// Listar imágenes disponibles (diagnóstico)
app.get('/imagenes/_list', async (req, res) => {
  try {
    const scan = (dir) => { try { return existsSync(dir) ? require('fs').readdirSync(dir) : []; } catch { return []; } };
    const current = scan(IMAGES_DIR);
    const legacy = scan(LEGACY_IMAGES_DIR);
    res.json({
      currentDir: IMAGES_DIR,
      legacyDir: LEGACY_IMAGES_DIR,
      current,
      legacy
    });
  } catch(e){ res.status(500).json({ error: 'Error listando', detail: e.message }); }
});

// Debug de un archivo específico para ver qué ruta se elegiría
app.get('/imagenes/_debug/:file', (req, res) => {
  try {
    const name = (req.params.file||'').replace(/\/+/, '');
    const variants = [];
    const baseExt = path.extname(name);
    const baseNoExt = name.replace(baseExt, '');
    const add = (label, p) => { variants.push({ label, path: p, exists: existsSync(p) }); };
    add('original-new', path.join(IMAGES_DIR, name));
    add('original-legacy', path.join(LEGACY_IMAGES_DIR, name));
    ['.avif','.webp'].forEach(ext=>{
      add('variant-new'+ext, path.join(IMAGES_DIR, baseNoExt+ext));
      add('variant-legacy'+ext, path.join(LEGACY_IMAGES_DIR, baseNoExt+ext));
    });
    res.json({ file: name, variants });
  } catch(e){ res.status(500).json({ error: 'Error debug', detail: e.message }); }
});

// ================== SERVIR FRONTEND ESTÁTICO ==================
const FRONT_DIR = path.join(__dirname, '..', 'InicioInterfaz');
app.use(express.static(FRONT_DIR, { extensions:['html'] }));

// Fallback básicos (si el usuario pega rutas directas al detalle con espacios codificados)
app.get(['/','/index'], (req,res)=>{
  res.sendFile(path.join(FRONT_DIR, 'index.html'));
});

// Asegurar acceso al detalle aunque se use otra carpeta anterior (legacy)
app.get('/detalle-productos/producto.html', (req,res)=>{
  res.sendFile(path.join(FRONT_DIR, 'detalle-productos', 'producto.html'));
});

app.listen(PORT, '127.0.0.1', () => {
  console.log('Backend escuchando en puerto', PORT);
  console.log('Sirviendo frontend estático desde', FRONT_DIR);
});
