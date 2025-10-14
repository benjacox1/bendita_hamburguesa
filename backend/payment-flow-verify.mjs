#!/usr/bin/env node
// Script: payment-flow-verify.mjs
// Objetivo: Verificar automáticamente el flujo de creación de pedido y preferencia.
// Pasos:
// 1. Obtener productos
// 2. Crear pedido con primer producto
// 3. Crear preferencia de pago
// 4. Mostrar resumen y sugerir abrir init_point
// Salida en JSON simplificada para uso en CI/manual.

import fetch from 'node-fetch';
import fs from 'fs';

// Intentar una lista de posibles bases: variable de entorno o puertos comunes alternos
const candidateBases = [];
if(process.env.BASE_URL) candidateBases.push(process.env.BASE_URL.replace(/\/$/, ''));
// Añadimos 4101 (instancia nueva), 4100 y 4000
candidateBases.push('http://localhost:4101','http://localhost:4100','http://localhost:4000');

function readOverride(){
  try {
    const p = 'base-url.override';
    if(fs.existsSync(p)){
      const txt = fs.readFileSync(p,'utf8').trim();
      if(/^https?:\/\//.test(txt)) return txt.replace(/\/$/,'');
    }
  } catch {}
  return null;
}

async function pickBase(){
  const override = readOverride();
  if(override) return override;
  for(const base of candidateBases){
    try {
      const hc = await fetch(base + '/api/health', { timeout: 2500 }).then(r=>r.json()).catch(()=>null);
      if(hc && hc.ok){
        return base;
      }
    } catch {}
  }
  return candidateBases[0];
}

async function main(){
  const chosenBase = await pickBase();
  console.log('[flow-verify][debug] candidateBases=', candidateBases);
  console.log('[flow-verify][debug] overrideFileExists=', fs.existsSync('base-url.override'));
  if(fs.existsSync('base-url.override')) console.log('[flow-verify][debug] overrideContent="'+fs.readFileSync('base-url.override','utf8').trim()+'"');
  console.log('[flow-verify][debug] chosenBase=', chosenBase);
  const API = chosenBase + '/api';
  const result = { base: chosenBase, steps: [] };
  try {
    // Health
  const health = await fetch(API.replace(/\/api$/, '/api/health')).then(r=>r.json()).catch(e=>({ error:e.message }));
    result.steps.push({ step:'health', ok: !!health.ok, data: health });

    // Productos
    const prodsResp = await fetch(API + '/products');
    if(!prodsResp.ok) throw new Error('Error productos HTTP '+prodsResp.status);
    const products = await prodsResp.json();
    if(!products.length) throw new Error('Sin productos disponibles');
    result.steps.push({ step:'products', ok:true, count: products.length });

    const first = products[0];

    // Crear pedido
    const orderBody = { cliente: 'FlowVerify '+new Date().toISOString(), items:[{ productId:first.id, cantidad:1 }] };
    const orderResp = await fetch(API + '/orders', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(orderBody) });
    const orderJson = await orderResp.json();
    if(!orderResp.ok) throw new Error('Error creando pedido: '+(orderJson.error||orderResp.status));
    if(!orderJson.id) throw new Error('Pedido sin id');
    result.orderId = orderJson.id;
    result.steps.push({ step:'order', ok:true, id: orderJson.id, importe: orderJson.importe });

    // Preferencia
    const prefResp = await fetch(API + '/payments/preference', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ orderId: orderJson.id }) });
    const prefJson = await prefResp.json();
    if(!prefResp.ok) throw new Error('Error preferencia: '+(prefJson.error||prefResp.status));
    if(!prefJson.init_point) throw new Error('Respuesta preferencia sin init_point');
    result.steps.push({ step:'preference', ok:true, simulated: !!prefJson.simulated });
    result.init_point = prefJson.init_point;
    result.external_reference = prefJson.external_reference;

    // Resumen final
    result.ok = true;
    console.log(JSON.stringify(result,null,2));
    console.log('\nINIT_POINT => '+ prefJson.init_point + '\n');
    console.log('Abre el init_point en tu navegador para completar el flujo.');
  } catch(e){
    result.ok = false;
    result.error = e.message;
    console.error(JSON.stringify(result,null,2));
    process.exitCode = 1;
  }
}

main();
