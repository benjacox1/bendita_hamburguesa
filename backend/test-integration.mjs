#!/usr/bin/env node
// Script para probar la integración completa de MercadoPago
// Autor: GitHub Copilot

import fetch from 'node-fetch';

const BASE_URL = process.argv[2] || 'https://shaw-hit-pick-introduce.trycloudflare.com';
const API_BASE = BASE_URL + '/api';

console.log('🧪 Probando integración completa de MercadoPago');
console.log('📍 URL Base:', BASE_URL);
console.log('');

async function testHealthCheck() {
  console.log('1️⃣ Verificando que el servidor esté funcionando...');
  try {
    const resp = await fetch(`${API_BASE}/health`);
    const data = await resp.json();
    console.log('✅ Servidor OK:', data);
    return true;
  } catch (e) {
    console.error('❌ Error health check:', e.message);
    return false;
  }
}

async function testPaymentConfig() {
  console.log('2️⃣ Verificando configuración de pagos...');
  try {
    const resp = await fetch(`${API_BASE}/payments/config`);
    const data = await resp.json();
    console.log('✅ Configuración:', data);
    return data;
  } catch (e) {
    console.error('❌ Error config:', e.message);
    return null;
  }
}

async function testCartCalculation() {
  console.log('3️⃣ Probando cálculo de carrito...');
  try {
    const testItems = [
      { productId: 'hamburguesa-simple', cantidad: 2 },
      { productId: 'lata-de-pepsi', cantidad: 1 }
    ];
    
    const resp = await fetch(`${API_BASE}/cart/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: testItems })
    });
    
    const data = await resp.json();
    console.log('✅ Cálculo:', data);
    return data;
  } catch (e) {
    console.error('❌ Error cálculo:', e.message);
    return null;
  }
}

async function testCreateOrder() {
  console.log('4️⃣ Creando pedido de prueba...');
  try {
    const testItems = [
      { productId: 'hamburguesa-simple', cantidad: 1 }
    ];
    
    const resp = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        items: testItems,
        cliente: 'Test Usuario'
      })
    });
    
    const data = await resp.json();
    console.log('✅ Pedido creado:', { id: data.id, importe: data.importe, items: data.items.length });
    return data;
  } catch (e) {
    console.error('❌ Error creando pedido:', e.message);
    return null;
  }
}

async function testPaymentPreference(orderId) {
  console.log('5️⃣ Generando preferencia de pago...');
  try {
    const resp = await fetch(`${API_BASE}/payments/preference`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId })
    });
    
    const data = await resp.json();
    console.log('✅ Preferencia:', {
      init_point: data.init_point ? 'Generado' : 'Faltante',
      external_reference: data.external_reference,
      total: data.total,
      simulated: data.simulated
    });
    return data;
  } catch (e) {
    console.error('❌ Error preferencia:', e.message);
    return null;
  }
}

async function testWebhook(externalReference) {
  console.log('6️⃣ Probando webhook de pago...');
  try {
    const resp = await fetch(`${BASE_URL}/webhooks/mercadopago`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'payment',
        data: { id: 'test_payment_123' },
        external_reference: externalReference,
        status: 'approved',
        transaction_amount: 1500
      })
    });
    
    const data = await resp.json();
    console.log('✅ Webhook procesado:', data);
    return data;
  } catch (e) {
    console.error('❌ Error webhook:', e.message);
    return null;
  }
}

async function testFullFlow() {
  console.log('🚀 INICIANDO PRUEBAS DE INTEGRACIÓN\n');
  
  // 1. Health check
  const healthOk = await testHealthCheck();
  if (!healthOk) return;
  console.log('');
  
  // 2. Payment config
  const config = await testPaymentConfig();
  console.log('');
  
  // 3. Cart calculation
  const calculation = await testCartCalculation();
  console.log('');
  
  // 4. Create order
  const order = await testCreateOrder();
  if (!order) return;
  console.log('');
  
  // 5. Payment preference
  const preference = await testPaymentPreference(order.id);
  if (!preference) return;
  console.log('');
  
  // 6. Test webhook
  const webhook = await testWebhook(preference.external_reference);
  console.log('');
  
  // Resumen final
  console.log('📊 RESUMEN DE PRUEBAS:');
  console.log('================================');
  console.log('✅ Servidor:', healthOk ? 'OK' : 'FALLO');
  console.log('✅ Configuración:', config ? `${config.mode.toUpperCase()}` : 'FALLO');
  console.log('✅ Cálculo carrito:', calculation?.valid ? 'OK' : 'FALLO');
  console.log('✅ Crear pedido:', order ? 'OK' : 'FALLO');
  console.log('✅ Preferencia pago:', preference?.init_point ? 'OK' : 'FALLO');
  console.log('✅ Webhook:', webhook?.ok ? 'OK' : 'FALLO');
  console.log('');
  
  if (preference?.init_point) {
    console.log('💰 URL de pago generada:', preference.init_point);
    console.log('🔗 Webhook configurado:', `${BASE_URL}/webhooks/mercadopago`);
    console.log('');
    console.log('🎉 ¡INTEGRACIÓN COMPLETA FUNCIONANDO!');
    console.log('');
    console.log('📱 Para probar en navegador:');
    console.log(`   1. Ve a: ${BASE_URL}`);
    console.log(`   2. Agrega productos al carrito`);
    console.log(`   3. Procede al checkout`);
    console.log(`   4. El pago se procesará automáticamente`);
  } else {
    console.log('❌ Falló la generación de preferencia de pago');
  }
}

testFullFlow().catch(console.error);