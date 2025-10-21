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
  // Compartir comprobante por WhatsApp: crea pedido y abre chat
  const btnWA = document.getElementById('btn-whatsapp');
  if (btnWA) {
    btnWA.addEventListener('click', async (e) => {
      try { e.preventDefault(); } catch {}
      const items = leerCarrito();
      if (items.length === 0) {
        alert('Tu carrito está vacío. Agrega productos antes de compartir comprobante.');
        window.open(btnWA.href, '_blank');
        return;
      }
      const nombre = (document.getElementById('nombre-cliente')?.value || '').trim();
      if (!nombre) {
        alert('Por favor ingresa tu nombre en el cuadro de texto antes de compartir el comprobante.');
        document.getElementById('nombre-cliente')?.focus();
        return;
      }
      const msg = document.getElementById('checkout-msg');
      if (msg) { msg.textContent = 'Preparando pedido para verificación...'; msg.className = 'mini'; }
      try {
        const validation = await validarCarrito(items);
        if (!validation.valid) {
          const texto = 'Revisa tu carrito:\n\n' + (validation.errors||[]).join('\n');
          alert(texto);
          if (msg) { msg.textContent = 'Corrige el carrito antes de enviar comprobante.'; msg.classList.add('error'); }
          return;
        }
        const pedido = await (async function crearPedidoConNombre(items, cliente){
          const payload = {
            cliente: cliente || '',
            items: items.map(i => ({ productId: i.id, cantidad: i.cantidad }))
          };
          const resp = await fetch(API_BASE + '/orders', {
            method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)
          });
          if(!resp.ok){ const err = await resp.json().catch(()=>({error:'Error'})); throw new Error(err.error || 'Error creando pedido'); }
          return resp.json();
        })(items, nombre);
        let url; try { url = new URL(btnWA.href); } catch { url = null; }
        const existingText = url ? (url.searchParams.get('text') || '') : '';
        const extra = `Pedido #${pedido.id} - Total $${Number(pedido.importe||0).toFixed(2)} - Nombre: ${nombre}`;
        const finalText = existingText ? (existingText + extra) : extra;
        let finalHref = btnWA.href;
        if (url) { url.searchParams.set('text', finalText); finalHref = url.toString(); }
        if (msg) { msg.textContent = `Pedido creado (#${pedido.id}) a nombre de ${nombre}. Ahora comparte tu comprobante por WhatsApp.`; msg.className = 'mini success'; }
        const adminBase = (window.APP_CONFIG?.BACKEND) || 'http://localhost:4000';
        const adminUrl = adminBase.replace(/\/$/, '') + '/PanelAdmin/index.html?q=' + encodeURIComponent(pedido.id);
        try {
          const toast = document.createElement('div');
          toast.className = 'toast-pedido';
          toast.innerHTML = `<strong>Pedido #${pedido.id}</strong><br>Nombre: ${nombre}<br>Total: $ ${Number(pedido.importe||0).toFixed(2)}<br><a href="${adminUrl}" target="_blank" rel="noopener" class="toast-link">Ver en Admin</a>`;
          document.body.appendChild(toast);
          setTimeout(()=> toast.classList.add('show'), 10);
          setTimeout(()=> { toast.classList.remove('show'); setTimeout(()=> toast.remove(), 300); }, 4500);
        } catch {}
  try { guardarCarrito([]); render(); } catch {}
  window.open(finalHref, '_blank');
      } catch (err) {
        console.warn('[WHATSAPP] No se pudo crear pedido, se abrirá chat igualmente:', err);
        if (msg) { msg.textContent = 'No se pudo registrar el pedido automáticamente. Puedes enviar el comprobante por WhatsApp.'; msg.className = 'mini error'; }
        window.open(btnWA.href, '_blank');
      }
    });
  }
  document.getElementById('btn-checkout').addEventListener('click', () => {
    const items = leerCarrito();
    const msg = document.getElementById('checkout-msg');
    msg.className='mini';
    if(items.length===0){ msg.textContent='Carrito vacío'; return; }
    // Mostrar overlay de instrucciones
    const ov = document.getElementById('instrucciones-overlay');
    if(ov){ ov.classList.add('show'); }
  });
  // Cerrar overlay
  document.querySelector('.instr-close')?.addEventListener('click', ()=>{
    document.getElementById('instrucciones-overlay')?.classList.remove('show');
  });
  document.getElementById('instrucciones-overlay')?.addEventListener('click', (e)=>{
    if(e.target.id==='instrucciones-overlay'){
      e.currentTarget.classList.remove('show');
    }
  });
  // Interceptar "Ir al link de pago" para intentar prellenar monto y nombre
  const payLink = document.querySelector('.instr-pay-link');
  if (payLink) {
    payLink.addEventListener('click', (e) => {
      try { e.preventDefault(); } catch {}
      const items = leerCarrito();
      if (!items.length) { alert('Tu carrito está vacío.'); return; }
      const nombre = (document.getElementById('nombre-cliente')?.value || '').trim();
      if (!nombre) {
        alert('Por favor ingresa tu nombre antes de ir al link de pago.');
        document.getElementById('nombre-cliente')?.focus();
        return;
      }
      const total = items.reduce((acc, it) => acc + (Number(it.precio)||0) * (Number(it.cantidad)||0), 0);
      let url; try { url = new URL(payLink.href); } catch { url = null; }
      let finalHref = payLink.href;
      if (url) {
        url.searchParams.set('amount', total.toFixed(2));
        url.searchParams.set('name', nombre);
        finalHref = url.toString();
      }
      window.open(finalHref, '_blank');
    });
  }
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
