#!/usr/bin/env node
// Script de verificación automática del backend
// Ejecuta pruebas básicas: health, products listado, producto individual, creación de pedido, preferencia de pago.
// Uso: node check.mjs  (o npm run check si se configura en package.json)

const BASE = process.env.BASE || 'http://localhost:4000/api';

async function req(path, options){
  const url = BASE + path;
  const t0 = performance.now();
  let res, body;
  try {
    res = await fetch(url, options);
    const text = await res.text();
    try { body = JSON.parse(text); } catch { body = text; }
  } catch(err){
    return { ok:false, url, status:null, ms: Math.round(performance.now()-t0), error: err.message };
  }
  return { ok: res.ok, url, status: res.status, ms: Math.round(performance.now()-t0), body };
}

function logResult(label, r){
  if(r.ok){
    console.log(`✔ ${label} (${r.status}) - ${r.ms}ms`);
  } else {
    console.log(`✖ ${label} (${r.status ?? 'ERR'}) - ${r.ms}ms -> ${r.error || JSON.stringify(r.body)}`);
  }
}

(async () => {
  const summary = { passed:0, failed:0 };

  const health = await req('/health');
  logResult('Health', health); health.ok ? summary.passed++ : summary.failed++;

  const products = await req('/products');
  logResult('Listado productos', products); products.ok ? summary.passed++ : summary.failed++;

  let firstId = null;
  if(products.ok && Array.isArray(products.body) && products.body.length){
    firstId = products.body[0].id;
    const one = await req('/products/' + encodeURIComponent(firstId));
    logResult('Producto individual', one); one.ok ? summary.passed++ : summary.failed++;
  } else {
    console.log('⚠ No hay productos para probar endpoint individual');
  }

  // Crear pedido de prueba si existe al menos 1 producto
  if(firstId){
    const order = await req('/orders', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ cliente:'CHECK_SCRIPT', items:[{ productId:firstId, cantidad:1 }] }) });
    logResult('Crear pedido', order); order.ok ? summary.passed++ : summary.failed++;

    if(order.ok && order.body && order.body.id){
      const pref = await req('/payments/preference', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ orderId: order.body.id }) });
      logResult('Crear preferencia pago', pref); pref.ok ? summary.passed++ : summary.failed++;
    } else {
      console.log('⚠ No se creó pedido, se omite preferencia de pago');
    }
  }

  console.log(`\nResumen: ${summary.passed} OK / ${summary.failed} FAIL`);
  process.exit(summary.failed ? 1 : 0);
})();
