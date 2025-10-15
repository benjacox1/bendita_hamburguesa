// Carrito: vista y checkout
// Usa localStorage para items y backend para crear un pedido único al pagar.

const BACKEND = (window.APP_CONFIG?.BACKEND) || 'http://localhost:4000';
const API_BASE = (window.APP_CONFIG?.API_BASE) || (BACKEND + '/api');
const LS_CARRITO = 'carrito_items_v1';
let modoFallback = false; // si no se puede contactar backend al intentar pagar
let paymentConfig = null;
const SS_LAST_ORDER = 'last_order_info_v1'; // sessionStorage clave para guardar info del último pedido

function leerCarrito(){ try { return JSON.parse(localStorage.getItem(LS_CARRITO)) || []; } catch { return []; } }
function guardarCarrito(arr){ localStorage.setItem(LS_CARRITO, JSON.stringify(arr)); }

function formatearPrecio(p){ return '$ ' + Number(p).toFixed(2); }

function render(){
  const items = leerCarrito();
  const tbody = document.getElementById('tbody');
  const totalSpan = document.getElementById('total');
  tbody.innerHTML='';
  let total=0;
  items.forEach(it => {
    const tr = document.createElement('tr');
    const subtotal = it.precio * it.cantidad;
    total += subtotal;
  tr.innerHTML = `\n      <td class="prod-cell">${it.imagen?`<img class=inline-img src="${(window.APP_CONFIG?.BACKEND||'http://localhost:4000') + '/imagenes/' + encodeURIComponent(((it.imagen||'').replace(/^\/*/, '').split('/').pop()))}" alt="">`:''}<span>${it.nombre}</span></td>\n      <td>${formatearPrecio(it.precio)}</td>\n      <td><input type=number min=1 value="${it.cantidad}" data-id="${it.id}" class="inp-cant" /></td>\n      <td>${formatearPrecio(subtotal)}</td>\n      <td><button data-del="${it.id}" title="Eliminar">✕</button></td>`;
    tbody.appendChild(tr);
  });
  totalSpan.textContent = formatearPrecio(total);
  document.getElementById('btn-checkout').disabled = items.length === 0;
  document.getElementById('estado').style.display = 'none';
  document.getElementById('carrito').style.display = 'block';
}

async function validarCarrito(items) {
  // Validar carrito antes de crear pedido
  const payload = {
    items: items.map(i => ({ productId: i.id, cantidad: i.cantidad }))
  };
  const resp = await fetch(API_BASE + '/cart/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'Error validando carrito' }));
    throw new Error(err.error || 'Error validando carrito');
  }
  return resp.json();
}

async function crearPedidoBackend(items){
  // items: [{id, nombre, precio, cantidad}]
  const payload = {
    cliente: '',
    items: items.map(i => ({ productId: i.id, cantidad: i.cantidad }))
  };
  const resp = await fetch(API_BASE + '/orders', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  });
  if(!resp.ok){
    const err = await resp.json().catch(()=>({error:'Error'}));
    throw new Error(err.error || 'Error creando pedido');
  }
  return resp.json();
}

async function crearPreferencia(orderId){
  const r = await fetch(API_BASE + '/payments/preference', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ orderId })
  });
  if(!r.ok){
    const err = await r.json().catch(()=>({error:'Error'}));
    throw new Error(err.error || 'Error preferencia');
  }
  return r.json();
}

async function crearSesionVexor(orderId){
  const r = await fetch(API_BASE + '/payments/vexor/session', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ orderId })
  });
  if(!r.ok){
    const err = await r.json().catch(()=>({error:'Error'}));
    throw new Error(err.error || 'Error creando sesión Vexor');
  }
  return r.json();
}

function initEventos(){
  const main = document.getElementById('main');
  main.addEventListener('input', e => {
    if(e.target.classList.contains('inp-cant')){
      const id = e.target.dataset.id;
      let val = parseInt(e.target.value||'1');
      if(val<=0) val=1;
      const items = leerCarrito();
      const it = items.find(x=>x.id===id);
      if(it){ it.cantidad = val; guardarCarrito(items); render(); }
    }
  });
  main.addEventListener('click', e => {
    const del = e.target.getAttribute('data-del');
    if(del){
      const items = leerCarrito().filter(i=>i.id !== del);
      guardarCarrito(items);
      render();
    }
  });
  document.getElementById('btn-vaciar').addEventListener('click', () => {
    if(confirm('Vaciar carrito?')){ guardarCarrito([]); render(); }
  });
  document.getElementById('btn-checkout').addEventListener('click', async () => {
    const msg = document.getElementById('checkout-msg');
    msg.className='mini';
    const items = leerCarrito();
    if(items.length===0){ msg.textContent='Carrito vacío'; return; }
    
    msg.textContent='Validando carrito...';
    try {
      // Primero validar el carrito
      const validation = await validarCarrito(items);
      console.log('[CHECKOUT] validación carrito', validation);
      
      if (!validation.valid) {
        msg.textContent = 'Errores en carrito: ' + validation.errors.join(', ');
        msg.classList.add('error');
        
        // Mostrar errores detallados
        if (validation.errors.length > 0) {
          alert('Problemas con tu carrito:\n\n' + validation.errors.join('\n\n') + '\n\nPor favor revisa los productos y cantidades.');
        }
        return;
      }
      
      msg.textContent = `Creando pedido (Total: $${validation.total.toFixed(2)})...`;
      
      const pedido = await crearPedidoBackend(items);
      
      // Validar que el total coincida
      if (Math.abs(pedido.importe - validation.total) > 0.01) {
        msg.textContent = 'Error: Los totales no coinciden';
        msg.classList.add('error');
        console.error('[CHECKOUT] Total mismatch', { backend: pedido.importe, frontend: validation.total });
        return;
      }
      
      if (paymentConfig?.provider === 'vexor') {
        msg.textContent='Creando sesión de pago (Vexor)...';
        const ses = await crearSesionVexor(pedido.id);
        console.log('[CHECKOUT] sesión Vexor', ses);
        if(!ses || !ses.checkout_url){
          msg.textContent='No se recibió URL de pago Vexor';
          msg.classList.add('error');
          return;
        }
        msg.textContent = `Redirigiendo a pago Vexor (${ses.simulated ? 'SIMULADO' : 'REAL'})...`;
        try {
          sessionStorage.setItem(SS_LAST_ORDER, JSON.stringify({
            orderId: pedido.id,
            external_reference: 'vexor_'+pedido.id,
            total: pedido.importe,
            items_count: pedido.items.length,
            created: Date.now(),
            simulated: !!ses.simulated,
            provider: 'vexor'
          }));
        } catch {}
        setTimeout(()=>{ window.location.href = ses.checkout_url; }, 800);
        msg.classList.add('success');
        return;
      } else {
        msg.textContent='Generando preferencia de pago...';
        const pref = await crearPreferencia(pedido.id);
        console.log('[CHECKOUT] respuesta preferencia', pref);
        if(!pref || !pref.init_point){
          msg.textContent='No se recibió URL de pago del backend';
          msg.classList.add('error');
          return;
        }
        // Verificar datos de la preferencia
        if (pref.total && Math.abs(pref.total - pedido.importe) > 0.01) {
          msg.textContent = 'Error: Total de pago incorrecto';
          msg.classList.add('error');
          console.error('[CHECKOUT] Payment total mismatch', { preference: pref.total, order: pedido.importe });
          return;
        }
        msg.textContent = `Redirigiendo a pago (${pref.simulated ? 'SIMULADO' : 'REAL'})...`;
        try {
          sessionStorage.setItem(SS_LAST_ORDER, JSON.stringify({
            orderId: pedido.id,
            external_reference: pref.external_reference,
            total: pedido.importe,
            items_count: pedido.items.length,
            created: Date.now(),
            simulated: pref.simulated,
            provider: 'mercadopago'
          }));
        } catch {}
        setTimeout(()=>{ window.location.href = pref.init_point; }, 800);
        msg.classList.add('success');
      }
      
    } catch(e){
      console.error('[CHECKOUT] Error:', e);
      msg.textContent='Error en checkout: '+e.message;
      msg.classList.add('error');
    }
  });
}

function checkPaymentReturn() {
  // Verificar si venimos de un pago
  const urlParams = new URLSearchParams(window.location.search);
  const pago = urlParams.get('pago');
  const orderId = urlParams.get('order_id');
  
  if (pago && orderId) {
    const msg = document.getElementById('checkout-msg');
    
    switch (pago) {
      case 'success':
        msg.textContent = `¡Pago exitoso! Pedido #${orderId} confirmado`;
        msg.className = 'mini success';
        // Limpiar carrito automáticamente
        guardarCarrito([]);
        render();
        // Limpiar URL
        setTimeout(() => {
          window.history.replaceState({}, '', window.location.pathname);
        }, 3000);
        break;
        
      case 'failure':
        msg.textContent = `Pago rechazado para pedido #${orderId}. Intenta de nuevo.`;
        msg.className = 'mini error';
        break;
        
      case 'pending':
        msg.textContent = `Pago pendiente para pedido #${orderId}. Te notificaremos cuando se confirme.`;
        msg.className = 'mini';
        break;
    }
    
    return true;
  }
  
  return false;
}

async function consultarEstadoPedido(orderId) {
  try {
    const resp = await fetch(`${API_BASE}/orders/${orderId}`);
    if (resp.ok) {
      const order = await resp.json();
      console.log('[CHECKOUT] Estado del pedido:', order);
      return order;
    }
  } catch (e) {
    console.warn('[CHECKOUT] Error consultando pedido:', e);
  }
  return null;
}

async function init(){
  // Verificar si venimos de un pago primero
  const isPaymentReturn = checkPaymentReturn();
  
  render();
  initEventos();
  
  try {
    const r = await fetch(API_BASE + '/payments/config');
    if(r.ok){
      paymentConfig = await r.json();
      const msg = document.getElementById('checkout-msg');
      
      if (!isPaymentReturn) {
        if (paymentConfig.provider === 'vexor') {
          msg.textContent = paymentConfig.vexor?.publishableKeyPresent ? 'Vexor activado' : 'Vexor en modo simulado (falta clave secreta)';
          msg.classList.add(paymentConfig.vexor?.publishableKeyPresent ? 'success' : 'error');
        } else if(paymentConfig.mode === 'real'){
          msg.textContent = 'Modo pago REAL activado - MercadoPago configurado';
          msg.classList.add('success');
        } else {
          msg.textContent = 'Modo pago SIMULADO (configurar MP_ACCESS_TOKEN para pagos reales)';
          msg.classList.add('error');
        }
      }
    }
  } catch(e){ 
    console.warn('[CHECKOUT] no config pago', e.message); 
    if (!isPaymentReturn) {
      const msg = document.getElementById('checkout-msg');
      msg.textContent = 'Error conectando con backend';
      msg.classList.add('error');
    }
  }
  
  // Verificar si hay un pedido previo en sessionStorage
  try {
    const lastOrderInfo = sessionStorage.getItem(SS_LAST_ORDER);
    if (lastOrderInfo && !isPaymentReturn) {
      const orderData = JSON.parse(lastOrderInfo);
      const timeSince = Date.now() - orderData.created;
      
      // Si han pasado menos de 30 minutos, consultar estado
      if (timeSince < 30 * 60 * 1000) {
        const orderStatus = await consultarEstadoPedido(orderData.orderId);
        if (orderStatus && orderStatus.paymentStatus === 'approved') {
          // El pago fue aprobado, limpiar carrito
          guardarCarrito([]);
          render();
          
          const msg = document.getElementById('checkout-msg');
          msg.textContent = `Pedido #${orderStatus.id} pagado exitosamente`;
          msg.className = 'mini success';
          
          // Limpiar sessionStorage
          sessionStorage.removeItem(SS_LAST_ORDER);
        }
      }
    }
  } catch (e) {
    console.warn('[CHECKOUT] Error verificando pedido previo:', e);
  }
}

init();
