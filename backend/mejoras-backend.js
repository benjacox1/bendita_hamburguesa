// 🚀 MEJORAS DE BACKEND - Funciones adicionales para server.js

// ===== SISTEMA DE NOTIFICACIONES ===== 
app.post('/api/notifications/send', async (req, res) => {
  try {
    const { orderId, type, message } = req.body;
    
    // Simular envío de notificación
    const notification = {
      id: nanoid(8),
      orderId,
      type, // 'order_created', 'payment_approved', 'order_ready'
      message,
      timestamp: Date.now(),
      sent: true
    };
    
    logApp('notification.sent', notification);
    
    // Aquí integrarías con WhatsApp API, Email, etc.
    
    res.json({ success: true, notification });
  } catch (e) {
    res.status(500).json({ error: 'Error enviando notificación', detail: e.message });
  }
});

// ===== SISTEMA DE CUPONES DE DESCUENTO =====
app.post('/api/coupons/validate', async (req, res) => {
  try {
    const { code, orderTotal } = req.body;
    
    // Base de datos simulada de cupones
    const cupones = {
      'DESCUENTO10': { discount: 10, type: 'percentage', minOrder: 1000 },
      'PRIMERA20': { discount: 20, type: 'percentage', minOrder: 1500, oneTime: true },
      'FIJO500': { discount: 500, type: 'fixed', minOrder: 2000 }
    };
    
    const cupon = cupones[code.toUpperCase()];
    
    if (!cupon) {
      return res.status(404).json({ error: 'Cupón no válido' });
    }
    
    if (orderTotal < cupon.minOrder) {
      return res.status(400).json({ 
        error: `Pedido mínimo de $${cupon.minOrder} para usar este cupón` 
      });
    }
    
    const descuento = cupon.type === 'percentage' 
      ? (orderTotal * cupon.discount / 100)
      : cupon.discount;
    
    const nuevoTotal = Math.max(0, orderTotal - descuento);
    
    res.json({
      valid: true,
      discount: descuento,
      newTotal: nuevoTotal,
      code: code.toUpperCase()
    });
    
  } catch (e) {
    res.status(500).json({ error: 'Error validando cupón', detail: e.message });
  }
});

// ===== ANALYTICS Y REPORTES =====
app.get('/api/analytics/dashboard', async (req, res) => {
  try {
    const orders = await readJSON(ORDERS_FILE);
    const products = await readJSON(PRODUCTS_FILE);
    
    // Calcular métricas
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    
    const pedidosHoy = orders.filter(o => {
      const fechaPedido = new Date(o.fechaCreacion);
      return fechaPedido.toDateString() === hoy.toDateString();
    });
    
    const pedidosMes = orders.filter(o => {
      const fechaPedido = new Date(o.fechaCreacion);
      return fechaPedido >= inicioMes;
    });
    
    const ventasHoy = pedidosHoy
      .filter(o => o.paymentStatus === 'approved')
      .reduce((sum, o) => sum + (o.importe || 0), 0);
    
    const ventasMes = pedidosMes
      .filter(o => o.paymentStatus === 'approved')
      .reduce((sum, o) => sum + (o.importe || 0), 0);
    
    // Productos más vendidos
    const productosVendidos = {};
    orders.forEach(order => {
      if (order.paymentStatus === 'approved') {
        order.items.forEach(item => {
          productosVendidos[item.nombre] = 
            (productosVendidos[item.nombre] || 0) + item.cantidad;
        });
      }
    });
    
    const topProductos = Object.entries(productosVendidos)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);
    
    res.json({
      resumenHoy: {
        pedidos: pedidosHoy.length,
        ventas: ventasHoy
      },
      resumenMes: {
        pedidos: pedidosMes.length,
        ventas: ventasMes
      },
      topProductos,
      stockBajo: products.filter(p => p.stock <= 5),
      totalProductos: products.length,
      pedidosPendientes: orders.filter(o => 
        ['espera', 'preparando'].includes(o.estado)
      ).length
    });
    
  } catch (e) {
    res.status(500).json({ error: 'Error generando analytics', detail: e.message });
  }
});

// ===== SISTEMA DE REVIEWS =====
app.post('/api/products/:id/reviews', async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment, customerName } = req.body;
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating debe ser entre 1 y 5' });
    }
    
    const review = {
      id: nanoid(8),
      productId: id,
      rating: Number(rating),
      comment: comment || '',
      customerName: customerName || 'Anónimo',
      date: Date.now()
    };
    
    // En un sistema real, guardarías en base de datos
    // Por ahora, solo logueamos
    logApp('review.created', review);
    
    res.status(201).json(review);
    
  } catch (e) {
    res.status(500).json({ error: 'Error guardando review', detail: e.message });
  }
});

// ===== SISTEMA DE BACKUP AUTOMÁTICO =====
app.post('/api/admin/backup', async (req, res) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, 'backups', timestamp);
    
    // Crear directorio de backup
    await fs.mkdir(backupDir, { recursive: true });
    
    // Copiar archivos de datos
    await fs.copyFile(PRODUCTS_FILE, path.join(backupDir, 'products.json'));
    await fs.copyFile(ORDERS_FILE, path.join(backupDir, 'orders.json'));
    
    logApp('backup.created', { timestamp, path: backupDir });
    
    res.json({ 
      success: true, 
      backup: timestamp,
      message: 'Backup creado exitosamente'
    });
    
  } catch (e) {
    res.status(500).json({ error: 'Error creando backup', detail: e.message });
  }
});

// ===== WEBHOOK MEJORADO CON MÁS VALIDACIONES =====
app.post('/webhooks/mercadopago/validate', async (req, res) => {
  try {
    const { payment_id, external_reference } = req.body;
    
    // En producción, aquí consultarías la API de MercadoPago
    // para validar que el pago es real
    /*
    const mpClient = new MercadoPagoConfig({ 
      accessToken: process.env.MP_ACCESS_TOKEN 
    });
    const payment = await mpClient.payment.get({ id: payment_id });
    */
    
    // Simulación de validación
    const paymentData = {
      id: payment_id,
      status: 'approved', // approved, rejected, pending
      external_reference,
      transaction_amount: 1500,
      payment_method_id: 'visa',
      payer_email: 'cliente@example.com'
    };
    
    logWebhook('payment.validated', paymentData);
    
    res.json({ 
      valid: true, 
      payment: paymentData 
    });
    
  } catch (e) {
    logWebhook('error.payment.validation', { message: e.message });
    res.status(500).json({ error: 'Error validando pago', detail: e.message });
  }
});

// ===== ENDPOINT DE SALUD AVANZADO =====
app.get('/api/health/detailed', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Verificar archivos de datos
    const [productsExists, ordersExists] = await Promise.all([
      fs.access(PRODUCTS_FILE).then(() => true).catch(() => false),
      fs.access(ORDERS_FILE).then(() => true).catch(() => false)
    ]);
    
    // Verificar memoria
    const memoryUsage = process.memoryUsage();
    
    const responseTime = Date.now() - startTime;
    
    res.json({
      status: 'healthy',
      timestamp: Date.now(),
      uptime: process.uptime(),
      responseTime,
      version: process.version,
      memory: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB'
      },
      files: {
        products: productsExists,
        orders: ordersExists
      },
      environment: process.env.NODE_ENV || 'development'
    });
    
  } catch (e) {
    res.status(500).json({ 
      status: 'unhealthy', 
      error: e.message 
    });
  }
});